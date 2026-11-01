import { BinAction, BridgeArgs, BridgeError, validateArgs } from './bridge-protocol';

interface OrganizationHost {
  module: Record<string, any>;
  getActiveProject(): Promise<any>;
}
interface Item {
  id: string;
  name: string;
  parentBinId: string | null;
  native: any; // ProjectItem, including for bins; never a timeline/ClipProjectItem wrapper.
  folder: any | null;
}
interface Inventory { root: Item; items: Map<string, Item> }
const MAX_ITEMS = 10000;
const MAX_DEPTH = 64;

function callable(receiver: any, name: string): void {
  if (typeof receiver?.[name] !== 'function')
    throw new BridgeError('HOST_MEMBER_UNAVAILABLE', `Project organization requires ${name}.`);
}
function itemId(native: any): string {
  callable(native, 'getId');
  const id = native.getId();
  if (typeof id !== 'string' || !id.length || id.length > 128 || id.includes('\u0000'))
    throw new BridgeError('PROJECT_ITEMS_UNVERIFIABLE', 'Premiere returned an invalid project-item identity.');
  return id;
}
async function sameProject(host: OrganizationHost, projectId: unknown): Promise<void> {
  if ((await host.getActiveProject())?.guid.toString() !== projectId)
    throw new BridgeError('ACTIVE_CONTEXT_CHANGED', 'The requested project is no longer active.');
}

// Only fixed documented getters. No media paths, timeline APIs or filesystem access.
async function inventory(host: OrganizationHost, project: any, check: () => void): Promise<Inventory> {
  callable(project, 'getRootItem');
  callable(host.module.ProjectItem, 'cast');
  callable(host.module.FolderItem, 'cast');
  const folder = await project.getRootItem();
  const rootNative = host.module.ProjectItem.cast(folder);
  const root: Item = { id: itemId(rootNative), name: rootNative.name, parentBinId: null, native: rootNative, folder };
  const items = new Map<string, Item>([[root.id, root]]);
  const visit = async (parent: Item, depth: number): Promise<void> => {
    check();
    if (depth > MAX_DEPTH)
      throw new BridgeError('PROJECT_ITEMS_LIMIT', 'Project organization supports at most 64 bin levels.');
    callable(parent.folder, 'getItems');
    const children = await parent.folder.getItems();
    if (!Array.isArray(children) || children.length > MAX_ITEMS)
      throw new BridgeError('PROJECT_ITEMS_LIMIT', 'The project inventory exceeds its supported bound.');
    for (const native of children) {
      check();
      const id = itemId(native);
      if (items.has(id))
        throw new BridgeError('PROJECT_ITEMS_UNVERIFIABLE', 'The project hierarchy contains a repeated identity or cycle.');
      if (items.size > MAX_ITEMS)
        throw new BridgeError('PROJECT_ITEMS_LIMIT', 'Project organization supports at most 10000 items.');
      let bin = null;
      // Adobe casts reject non-bins. Never use the 27.0 FolderItem.type enum on 26.x.
      try { bin = host.module.FolderItem.cast(native); } catch {}
      if (bin) callable(bin, 'getItems');
      if (typeof native.name !== 'string' || native.name.length > 256 || native.name.includes('\u0000'))
        throw new BridgeError('PROJECT_ITEMS_UNVERIFIABLE', 'A project-item name cannot be represented safely.');
      const item: Item = { id, name: native.name, parentBinId: parent.id, native, folder: bin };
      items.set(id, item);
      if (bin) await visit(item, depth + 1);
    }
  };
  await visit(root, 0);
  return { root, items };
}
function view(item: Item): Record<string, unknown> {
  return { id: item.id, name: item.name, parentBinId: item.parentBinId, kind: item.folder ? 'bin' : 'item' };
}
export async function getProjectItems(
  host: OrganizationHost, project: any, args: BridgeArgs, check: () => void,
): Promise<Record<string, unknown>> {
  validateArgs('get_project_items', args);
  const tree = await inventory(host, project, check);
  await sameProject(host, args.projectId);
  const items = [...tree.items.values()].filter((item) => item !== tree.root);
  const offset = args.offset ?? 0, limit = args.limit ?? 50;
  const page = items.slice(offset, offset + limit).map(view);
  return { readOnly: true, projectId: args.projectId, rootBin: view(tree.root), items: page,
    page: { offset, limit, returned: page.length, totalItems: items.length,
      nextOffset: offset + page.length < items.length ? offset + page.length : null } };
}

/** An explicit, non-destructive Project-panel operation; grants no asset ownership. */
export async function organizeProject(
  host: OrganizationHost, project: any, args: BridgeArgs, check: () => void, invalidate: () => void,
): Promise<Record<string, unknown>> {
  validateArgs('organize_project', args);
  check();
  const before = await inventory(host, project, check);
  const actions = args.actions as BinAction[];
  const touched = new Set<string>();
  const guards = new Set<Item>();
  const parents = new Map([...before.items].map(([id, item]) => [id, item.parentBinId]));
  const names = new Map([...before.items].map(([id, item]) => [id, item.name]));
  const requireItem = (id: string): Item => {
    const item = before.items.get(id);
    if (!item) throw new BridgeError('PROJECT_ITEM_NOT_FOUND', 'An exact item ID is absent from this project. Read the inventory again.');
    return item;
  };
  const requireBin = (id: string): Item => {
    const item = requireItem(id);
    if (!item.folder) throw new BridgeError('NOT_A_BIN', 'The specified parent/destination is not a bin.');
    return item;
  };
  const guardAncestors = (item: Item): void => {
    let next: Item | undefined = item;
    while (next && !guards.has(next)) {
      guards.add(next);
      next = next.parentBinId === null ? undefined : requireBin(next.parentBinId);
    }
  };
  const factories: Array<() => any> = [];
  const created: Array<Extract<BinAction, { type: 'create_bin' }>> = [];
  for (const action of actions) {
    if (action.type === 'create_bin') {
      const parent = requireBin(action.parentBinId);
      guardAncestors(parent);
      callable(parent.folder, 'createBinAction');
      created.push(action);
      factories.push(() => parent.folder.createBinAction(action.name, false));
      continue;
    }
    const item = requireItem(action.type === 'move_item' ? action.itemId : action.binId);
    if (item === before.root)
      throw new BridgeError('PROJECT_ROOT_PROTECTED', 'The project root cannot be moved or renamed.');
    if (touched.has(item.id))
      throw new BridgeError('INVALID_REQUEST', 'Each existing item may be targeted only once per organization batch.');
    touched.add(item.id);
    guardAncestors(item);
    if (action.type === 'move_item') {
      if (item.parentBinId !== action.expectedParentBinId)
        throw new BridgeError('PROJECT_ITEM_CHANGED', 'An item is no longer in its expected parent bin. Read the inventory again.');
      const source = requireBin(action.expectedParentBinId), destination = requireBin(action.destinationBinId);
      if (source === destination)
        throw new BridgeError('INVALID_REQUEST', 'The item is already in the destination bin.');
      guardAncestors(destination);
      parents.set(item.id, destination.id);
      callable(source.folder, 'createMoveItemAction');
      factories.push(() => source.folder.createMoveItemAction(item.native, destination.folder));
    } else {
      requireBin(item.id);
      if (item.name !== action.expectedName)
        throw new BridgeError('PROJECT_ITEM_CHANGED', 'A bin no longer has its expected name. Read the inventory again.');
      names.set(item.id, action.name);
      callable(item.folder, 'createRenameBinAction');
      factories.push(() => item.folder.createRenameBinAction(action.name));
    }
  }
  // Validate the combined result, including cross-action cycles and name collisions.
  const checkDepth = (id: string, addingChild = false): void => {
    const seen = new Set<string>();
    let next: string | null = id;
    let depth = 0;
    while (next !== null) {
      if (seen.has(next)) throw new BridgeError('BIN_CYCLE', 'A bin cannot be moved into itself or one of its descendants.');
      if (++depth > MAX_DEPTH + 1 - (addingChild ? 1 : 0)) throw new BridgeError('PROJECT_ITEMS_LIMIT', 'The resulting hierarchy would exceed 64 bin levels.');
      seen.add(next);
      next = parents.get(next) ?? null;
    }
  };
  for (const item of before.items.values()) if (item.folder) checkDepth(item.id);
  for (const action of created) checkDepth(action.parentBinId, true);
  if (before.items.size - 1 + created.length > MAX_ITEMS)
    throw new BridgeError('PROJECT_ITEMS_LIMIT', 'The resulting inventory would exceed 10000 items.');
  const occupied = new Map<string, string>();
  for (const item of before.items.values()) {
    if (!item.folder || item === before.root) continue;
    const key = JSON.stringify([parents.get(item.id), names.get(item.id)]);
    const other = occupied.get(key);
    if (other && (touched.has(item.id) || touched.has(other)))
      throw new BridgeError('BIN_NAME_CONFLICT', 'The organization would create duplicate sibling bin names. Use distinct names.');
    occupied.set(key, item.id);
  }
  for (const action of created) {
    const key = JSON.stringify([action.parentBinId, action.name]);
    if (occupied.has(key))
      throw new BridgeError('BIN_NAME_CONFLICT', 'A bin with that name already exists in the destination. Reuse its ID or choose another name.');
    occupied.set(key, 'new');
  }
  for (const item of guards) if (item !== before.root) callable(item.native, 'getParentBin');
  callable(project, 'lockedAccess');
  callable(project, 'executeTransaction');
  await sameProject(host, args.projectId);
  check();
  let started = false;
  let accepted: unknown;
  try {
    project.lockedAccess(() => {
      check();
      // Synchronous getters close the await-to-lock race without async lock callbacks.
      for (const item of guards) {
        if (item === before.root) continue;
        const parent = item.native.getParentBin();
        if (!parent || itemId(host.module.ProjectItem.cast(parent)) !== item.parentBinId || item.native.name !== item.name)
          throw new BridgeError('PROJECT_ITEM_CHANGED', 'The project hierarchy changed before the transaction. Read it again.');
      }
      accepted = project.executeTransaction((compound: any) => {
        for (const factory of factories) {
          started = true;
          compound.addAction(factory());
        }
      }, 'MCP: organize project bins');
    });
    if (accepted !== true) throw new Error('Unconfirmed transaction');
    // Read actual host state. Never roll back concurrent human edits from a snapshot.
    const after = await inventory(host, project, () => {});
    await sameProject(host, args.projectId);
    const results: Array<Record<string, unknown>> = [];
    for (const action of actions) {
      if (action.type === 'create_bin') {
        const matches = [...after.items.values()].filter((item) =>
          !before.items.has(item.id) && item.folder && item.parentBinId === action.parentBinId && item.name === action.name);
        if (matches.length !== 1) throw new Error('Unverified new bin');
        results.push({ type: action.type, ...view(matches[0]) });
      } else {
        const id = action.type === 'move_item' ? action.itemId : action.binId;
        const item = after.items.get(id);
        if (!item || item.parentBinId !== parents.get(id) || item.name !== names.get(id))
          throw new Error('Unverified item organization');
        results.push({ type: action.type, ...view(item) });
      }
    }
    return { readOnly: false, projectId: args.projectId, results, verified: true, saved: false,
      invalidatedScope: { projectId: args.projectId }, assetOwnershipGranted: false };
  } catch (error) {
    if (!started && error instanceof BridgeError) throw error;
    throw new BridgeError('OPERATION_OUTCOME_UNKNOWN', 'Project organization was not fully confirmed. Inspect the inventory and recover with the exact same operationId and payload; do not resubmit under a new UUID.');
  } finally {
    if (started) invalidate();
  }
}
