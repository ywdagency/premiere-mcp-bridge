const test = require('node:test');
const assert = require('node:assert/strict');
const { apiFixture } = require('./helpers/api-fixture.cjs');
const deadline = () => Date.now() + 5000;

function folderOperations(f, folder) {
  folder.items ??= [];
  folder.getItems = async () => folder.items;
  folder.createRemoveItemAction = (item) => {
    f.nativeFactories++;
    return f.action(() => {
      folder.items = folder.items.filter((entry) => entry !== item);
    });
  };
  folder.createMoveItemAction = (item, newParent) => {
    f.nativeFactories++;
    return f.action(() => {
      folder.items = folder.items.filter((entry) => entry !== item);
      newParent.items.push(item);
    });
  };
}

async function createOwnedBin(f, name) {
  const root = await f.read('Project#getRootItem', (await f.context()).project);
  await f.api.actions({
    projectId: f.project.guid,
    actions: [{ memberId: 'FolderItem#createBinAction', target: root.$ref,
      parameters: { name, makeUnique: true } }],
  }, deadline());
  const bin = f.root.items.find((item) => item.name === name);
  const id = bin.getId();
  bin.getId = () => id;
  folderOperations(f, bin);
  return bin;
}

async function folderFixture() {
  const f = apiFixture();
  f.nativeFactories = 0;
  folderOperations(f, f.root);
  const bin = await createOwnedBin(f, 'Owned bin');
  return { f, bin };
}

async function binHandles(f, bin) {
  const context = await f.context();
  const root = await f.read('Project#getRootItem', context.project);
  const items = await f.read('FolderItem#getItems', root);
  const item = items.items.find((entry) => entry.scope.assetId === bin.getId());
  const folder = await f.read('FolderItem.cast', null, { projectItem: { $ref: item.$ref } });
  return { context, root, item, folder };
}

test('an owned receiver bin never authorizes removing or moving a protected item', async (t) => {
  for (const kind of ['source sequence', 'pre-existing unused media']) {
    for (const operation of ['createRemoveItemAction', 'createMoveItemAction']) {
      await t.test(`${operation}: ${kind}`, async () => {
        const { f, bin } = await folderFixture();
        const nativeItem = kind === 'source sequence'
          ? await f.source.getProjectItem()
          : { kind: 'clip', name: 'Existing fixture media', getId: () => 'existing-unused' };
        // A manual project-bin change must not transfer ownership to its contents.
        bin.items.push(nativeItem);
        const { context, root, folder } = await binHandles(f, bin);
        if (kind === 'source sequence')
          await f.read('Sequence#getProjectItem', context.sequence);
        const contents = await f.read('FolderItem#getItems', folder);
        const item = contents.items[0];
        assert.equal(folder.scope.editable, true);
        assert.equal(item.scope.editable, false);
        const transactions = f.transactions.length;
        const parameters = operation === 'createMoveItemAction'
          ? { newParent: { $ref: root.$ref }, item: { $ref: item.$ref } }
          : { item: { $ref: item.$ref } };
        await assert.rejects(f.api.actions({
          projectId: f.project.guid,
          actions: [{ memberId: `FolderItem#${operation}`, target: folder.$ref, parameters }],
        }, deadline()), { code: 'SOURCE_SEQUENCE_PROTECTED' });
        assert.equal(f.nativeFactories, 0);
        assert.equal(f.transactions.length, transactions);
        assert.deepEqual(bin.items, [nativeItem]);
        assert.equal(f.sequences.includes(f.source), true);
      });
    }
  }
});

test('owned items can still be removed or moved from an unowned root bin', async (t) => {
  for (const operation of ['createRemoveItemAction', 'createMoveItemAction']) {
    await t.test(operation, async () => {
      const { f, bin } = await folderFixture();
      const destination = await createOwnedBin(f, 'Destination');
      const { root, item } = await binHandles(f, bin);
      const destinationItem = (await f.read('FolderItem#getItems', root)).items
        .find((entry) => entry.scope.assetId === destination.getId());
      const destinationFolder = await f.read('FolderItem.cast', null, {
        projectItem: { $ref: destinationItem.$ref },
      });
      assert.equal(root.scope.editable, false);
      assert.equal(item.scope.editable, true);
      const parameters = operation === 'createMoveItemAction'
        ? { newParent: { $ref: destinationFolder.$ref }, item: { $ref: item.$ref } }
        : { item: { $ref: item.$ref } };
      await f.api.actions({ projectId: f.project.guid,
        actions: [{ memberId: `FolderItem#${operation}`, target: root.$ref, parameters }],
      }, deadline());
      assert.equal(f.nativeFactories, 1);
      assert.equal(f.root.items.includes(bin), false);
      if (operation === 'createMoveItemAction') assert.equal(destination.items.includes(bin), true);
      assert.equal(f.sequences.includes(f.source), true);
    });
  }
});

test('an owned bin containing an unowned child remains protected from removal', async () => {
  const { f, bin } = await folderFixture();
  bin.items.push({ kind: 'clip', getId: () => 'unowned-child' });
  const { root, item } = await binHandles(f, bin);
  await assert.rejects(f.api.actions({ projectId: f.project.guid,
    actions: [{ memberId: 'FolderItem#createRemoveItemAction', target: root.$ref,
      parameters: { item: { $ref: item.$ref } } }],
  }, deadline()), { code: 'SOURCE_ASSET_PROTECTED' });
  assert.equal(f.nativeFactories, 0);
  assert.equal(f.root.items.includes(bin), true);
});

async function exportFixture() {
  const f = apiFixture(), sequence = await f.working(), context = await f.context(sequence);
  const time = await f.read('TickTime.createWithTicks', null, { ticks: '0' });
  const args = { projectId: f.project.guid, memberId: 'Exporter.exportSequenceFrame',
    parameters: { sequence: { $ref: context.sequence.$ref }, time: { $ref: time.$ref },
      filename: 'exports/fixture.png', filepath: 'exports', width: 320, height: 180 } };
  return { f, sequence, args };
}

test('final job preflight failures leave no running job or sequence-deletion block', async (t) => {
  for (const mode of ['editing disabled', 'expired', 'project changed', 'project getter failed']) {
    await t.test(mode, async (t) => {
      const { f, sequence, args } = await exportFixture();
      let now = Date.now(), projectChecks = 0, nativeCalls = 0;
      const expiresAt = now + 1000;
      t.mock.method(Date, 'now', () => now);
      f.module.Exporter.exportSequenceFrame = () => { nativeCalls++; return Promise.resolve(true); };
      const getProject = f.apiHost.getActiveProject;
      f.apiHost.getActiveProject = async () => {
        if (++projectChecks === 2) {
          if (mode === 'editing disabled') f.setEnabled(false);
          if (mode === 'expired') now = expiresAt;
          if (mode === 'project changed') return { ...f.project, guid: 'different-fixture-project' };
          if (mode === 'project getter failed') throw new Error('Fixture project getter failed');
        }
        return f.project;
      };
      const expected = {
        'editing disabled': { code: 'WRITES_DISABLED' },
        expired: { code: 'REQUEST_EXPIRED' },
        'project changed': { code: 'ACTIVE_CONTEXT_CHANGED' },
        'project getter failed': { message: 'Fixture project getter failed' },
      }[mode];
      await assert.rejects(f.api.startJob(args, expiresAt), expected);
      assert.equal(projectChecks, 2);
      assert.equal(nativeCalls, 0);
      f.apiHost.getActiveProject = getProject;
      f.setEnabled(true);
      await f.api.deleteWorking({ projectId: f.project.guid, sequenceId: sequence.guid }, deadline());
      assert.equal(f.sequences.includes(sequence), false);
    });
  }
});

test('a synchronously rejected native job still cleans up its running record', async () => {
  const { f, sequence, args } = await exportFixture();
  f.module.Exporter.exportSequenceFrame = () => { throw new Error('Fixture native rejection'); };
  await assert.rejects(f.api.startJob(args, deadline()), { code: 'OPERATION_OUTCOME_UNKNOWN' });
  await f.api.deleteWorking({ projectId: f.project.guid, sequenceId: sequence.guid }, deadline());
  assert.equal(f.sequences.includes(sequence), false);
});
