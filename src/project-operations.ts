import { BridgeArgs, BridgeError, validateArgs } from "./bridge-protocol";

export type ProjectOperation =
  | "import_ae_comps"
  | "import_all_ae_comps"
  | "import_sequences"
  | "project_close"
  | "close_sequence"
  | "project_set_growing_media_paused";

export interface ProjectOperationHost {
  module: Record<string, any>;
  writesEnabled(): boolean;
  getActiveProject(): Promise<any>;
  path(relative: string, mode: "read"): Promise<string>;
}

export const PROJECT_OPERATION_MEMBERS: Record<ProjectOperation, string> = {
  import_ae_comps: "Project#importAEComps",
  import_all_ae_comps: "Project#importAllAEComps",
  import_sequences: "Project#importSequences",
  project_close: "Project#close",
  close_sequence: "Project#closeSequence",
  project_set_growing_media_paused: "Project#pauseGrowing",
};

function callable(receiver: any, name: string): void {
  if (typeof receiver?.[name] !== "function")
    throw new BridgeError(
      "HOST_MEMBER_UNAVAILABLE",
      `${name} is unavailable in this host.`,
    );
}

function inputPath(value: unknown, extension: string): string {
  if (
    typeof value !== "string" ||
    value.length > 1024 ||
    !value.toLowerCase().endsWith(extension) ||
    /[\\:\u0000]/.test(value) ||
    value.split("/").some((part) => !part || part === "." || part === "..")
  )
    throw new BridgeError(
      "INVALID_API_ARGUMENT",
      `Use a granted relative ${extension} file path.`,
    );
  return value;
}

/** Prepare only documented named calls; never grants ownership of imported contents. */
export async function prepareProjectOperation(
  kind: ProjectOperation,
  args: BridgeArgs,
  host: ProjectOperationHost,
  resolveBin: (id: string, projectId: string) => Promise<any>,
  expiresAt: number,
): Promise<{
  memberId: string;
  projectId: string;
  invoke(): Promise<boolean>;
}> {
  validateArgs(kind, args);
  const check = () => {
    if (!host.writesEnabled())
      throw new BridgeError("WRITES_DISABLED", "Launch the bridge first.");
    if (Date.now() >= expiresAt)
      throw new BridgeError("REQUEST_EXPIRED", "The operation expired.");
  };
  check();
  const project = await host.getActiveProject();
  if (!project || project.guid.toString() !== args.projectId)
    throw new BridgeError(
      "ACTIVE_CONTEXT_CHANGED",
      "The requested project is no longer active.",
    );
  const memberId = PROJECT_OPERATION_MEMBERS[kind];
  const method = memberId.split("#")[1];
  callable(project, method);
  let nativeArgs: unknown[];
  if (kind === "close_sequence") {
    const sequence = (await project.getSequences()).find(
      (item: any) => item.guid.toString() === args.sequenceId,
    );
    if (!sequence)
      throw new BridgeError(
        "SEQUENCE_NOT_FOUND",
        "The requested sequence is not in this project.",
      );
    nativeArgs = [sequence];
  } else if (kind === "project_close") {
    if (args.confirm !== true)
      throw new BridgeError(
        "EXPLICIT_AUTHORIZATION_REQUIRED",
        "Closing a project must be deliberate.",
      );
    const Options = host.module.CloseProjectOptions;
    if (typeof Options !== "function")
      throw new BridgeError(
        "HOST_MEMBER_UNAVAILABLE",
        "CloseProjectOptions is unavailable.",
      );
    const options = new Options();
    for (const [setter, property, value] of [
      ["setPromptIfDirty", "promptIfDirty", true],
      ["setShowCancelButton", "showCancelButton", true],
      ["setSaveWorkspace", "saveWorkspace", false],
      ["setIsAppBeingPreparedToQuit", "isAppBeingPreparedToQuit", false],
    ] as const) {
      callable(options, setter);
      options[setter](value);
      if (options[property] !== value)
        throw new BridgeError(
          "CLOSE_OPTIONS_UNVERIFIABLE",
          "Safe close options could not be verified.",
        );
    }
    // Dirty-project decisions belong to Premiere's native prompt, never implicit save/discard.
    nativeArgs = [options];
  } else if (kind === "project_set_growing_media_paused") {
    if (typeof args.paused !== "boolean")
      throw new BridgeError(
        "INVALID_API_ARGUMENT",
        "paused must be a boolean.",
      );
    nativeArgs = [args.paused];
  } else if (kind === "import_sequences") {
    const relative = inputPath(args.path, ".prproj");
    const ids = args.sequenceIds;
    if (
      args.allSequences === true
        ? ids !== undefined
        : !Array.isArray(ids) || !ids.length
    )
      throw new BridgeError(
        "INVALID_API_ARGUMENT",
        "Choose sequenceIds or explicit allSequences=true, exclusively.",
      );
    let nativeIds: unknown[] | undefined;
    if (ids !== undefined) {
      if (
        !Array.isArray(ids) ||
        ids.length > 50 ||
        new Set(ids).size !== ids.length ||
        !ids.every(
          (id) =>
            typeof id === "string" &&
            /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id),
        )
      )
        throw new BridgeError(
          "INVALID_API_ARGUMENT",
          "Provide 1–50 distinct documented source sequence GUIDs.",
        );
      callable(host.module.Guid, "fromString");
      nativeIds = ids.map((id) => host.module.Guid.fromString(id));
    }
    const path = await host.path(relative, "read");
    if (
      project.path &&
      String(project.path).replace(/\\/g, "/") === path.replace(/\\/g, "/")
    )
      throw new BridgeError(
        "INVALID_API_ARGUMENT",
        "Import from a different project file.",
      );
    nativeArgs = nativeIds ? [path, nativeIds] : [path];
  } else {
    const relative = inputPath(args.path, ".aep");
    if (
      kind === "import_ae_comps" &&
      (!Array.isArray(args.compNames) ||
        !args.compNames.length ||
        args.compNames.length > 50 ||
        new Set(args.compNames).size !== args.compNames.length ||
        !args.compNames.every(
          (name) =>
            typeof name === "string" &&
            name.length > 0 &&
            name.length <= 256 &&
            !name.includes("\u0000"),
        ))
    )
      throw new BridgeError(
        "INVALID_API_ARGUMENT",
        "Provide 1–50 distinct exact composition names.",
      );
    const path = await host.path(relative, "read");
    // Explicit root target avoids relying on older hosts' inconsistent default-bin behavior.
    const bin = args.targetBin
      ? await resolveBin(args.targetBin as string, project.guid.toString())
      : await host.module.ProjectItem.cast(await project.getRootItem());
    nativeArgs =
      kind === "import_ae_comps" ? [path, args.compNames, bin] : [path, bin];
  }
  if ((await host.getActiveProject())?.guid.toString() !== args.projectId)
    throw new BridgeError(
      "ACTIVE_CONTEXT_CHANGED",
      "The project changed during preparation.",
    );
  check();
  return {
    memberId,
    projectId: project.guid.toString(),
    invoke() {
      check();
      return project[method](...nativeArgs);
    },
  };
}
