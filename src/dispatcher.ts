import { COMMAND_LIST, BridgeCommand } from './command-catalog';
import { BridgeError, ReadRequest, ReadCommand, validateArgs, PLUGIN_VERSION } from './bridge-protocol';
import { InspectionHost, inspectPremiere } from './premiere-inspection';
import { PremiereApi } from './api-runtime';
import { PremiereControl } from './premiere-control';
import { ImportDiagnostics } from './import-diagnostics';
type Handler = (request: ReadRequest) => Promise<Record<string, unknown>>;
export function createDispatcher(
  host: InspectionHost,
  control?: PremiereControl,
  api?: PremiereApi,
): Handler {
  const read =
    (command: ReadCommand): Handler =>
    (request) =>
      inspectPremiere(host, command, request.args);
  const write =
    (command: BridgeCommand): Handler =>
    async (request) => {
      if (!control)
        throw new BridgeError('WRITES_DISABLED', 'This plugin instance exposes inspection only.');
      const diagnostics = command === 'import_media' ? new ImportDiagnostics() : undefined;
      try {
        const before =
          command === 'import_media' && api
            ? await api.importSnapshot(request.args.paths as string[], request.args.projectId, diagnostics)
            : undefined;
        const result = await control.execute(command, request.args, request.expiresAt, diagnostics);
        diagnostics?.at('result_registration', 'capture_imports');
        if (before) await api!.captureImports(before, diagnostics);
        diagnostics?.at('result_registration', 'invalidate_handles');
        api?.afterLegacyWrite(request.args);
        return { readOnly: false, operationId: request.args.operationId, ...result };
      } catch (error) {
        throw diagnostics ? diagnostics.failure(error) : error;
      }
    };
  const native =
    (method: keyof PremiereApi): Handler =>
    async (request) => {
      if (!api)
        throw new BridgeError(
          'API_ADAPTER_UNAVAILABLE',
          'This plugin instance has no native API adapter.',
        );
      let result;
      try {
        result = await (api[method] as Function).call(api, request.args, request.expiresAt);
      } catch (error) {
        if (error instanceof BridgeError) throw error;
        const readOnly = COMMAND_LIST.find((spec) => spec.command === request.command)!.readOnly;
        throw new BridgeError(
          readOnly ? 'HOST_API_ERROR' : 'OPERATION_OUTCOME_UNKNOWN',
          'The native adapter did not return a confirmed result. Inspect Premiere before another write.',
        );
      }
      return {
        ...result,
        ...(request.args.operationId ? { operationId: request.args.operationId } : {}),
      };
    };
  // Adding a catalog entry without a handler is a TypeScript error.
  const handlers: Record<BridgeCommand, Handler> = {
    get_capabilities: async () => ({
      bridgeVersion: PLUGIN_VERSION,
      protocolVersion: 1,
      host: { name: host.name, version: host.version, uxpVersion: host.uxpVersion },
      writesEnabled: false,
      mediaFolderGranted: false,
      workingSequences: [],
      ...control?.capabilities(),
      ...api?.capabilities(),
      commands: COMMAND_LIST.map(({ command, readOnly, minVersion }) => ({
        name: `premiere_${command}`,
        readOnly,
        minVersion,
      })),
    }),
    get_project: read('get_project'),
    get_active_sequence: read('get_active_sequence'),
    get_sequence_clips: read('get_sequence_clips'),
    get_sequences: async ({ args }) => {
      const project = await host.getActiveProject();
      const sequences = project ? await project.getSequences() : [];
      const offset = args.offset ?? 0,
        limit = args.limit ?? 50;
      const page = sequences
        .slice(offset, offset + limit)
        .map((seq) => ({
          id: seq.guid.toString(),
          name: seq.name.slice(0, 256),
          editable: control?.mayEdit(project!.guid.toString(), seq.guid.toString()) ?? false,
        }));
      if ((await host.getActiveProject())?.guid.toString() !== project?.guid.toString()) {
        throw new BridgeError(
          'ACTIVE_CONTEXT_CHANGED',
          'The active project changed during the sequence inventory.',
        );
      }
      return {
        readOnly: true,
        projectId: project?.guid.toString() ?? null,
        sequences: page,
        page: {
          offset,
          limit,
          returned: page.length,
          totalSequences: sequences.length,
          nextOffset: offset + page.length < sequences.length ? offset + page.length : null,
        },
      };
    },
    api_load_text: native('loadText'),
    api_subscribe_events: native('subscribe'),
    api_poll_events: native('pollEvents'),
    api_unsubscribe_events: native('unsubscribe'),
    api_context: native('context'),
    api_read: native('read'),
    api_construct: native('construct'),
    api_probe: native('probe'),
    api_release: native('release'),
    api_apply_actions: native('actions'),
    api_mutate: native('mutate'),
    api_start_job: native('startJob'),
    api_get_job: native('job'),
    sequence_from_media: native('sequenceFromMedia'),
    sequence_from_preset: native('sequenceFromPreset'),
    delete_working_sequence: native('deleteWorking'),
    save_project: native('save'),
    save_project_as: native('saveAs'),
    project_open: native('openProject'),
    create_sequence: write('create_sequence'),
    duplicate_sequence: write('duplicate_sequence'),
    open_sequence: write('open_sequence'),
    import_media: write('import_media'),
    move_clip: write('move_clip'),
    trim_clip: write('trim_clip'),
  };
  return async (request) => {
    validateArgs(request.command, request.args);
    const spec = COMMAND_LIST.find((entry) => entry.command === request.command)!;
    const [major, minor] = host.version.split('.').map(Number);
    const [minimumMajor, minimumMinor] = spec.minVersion.split('.').map(Number);
    if (
      !Number.isInteger(major) ||
      !Number.isInteger(minor) ||
      major < minimumMajor ||
      (major === minimumMajor && minor < minimumMinor)
    ) {
      throw new BridgeError(
        'UNSUPPORTED_HOST',
        `This command requires Premiere ${spec.minVersion} or newer.`,
      );
    }
    return handlers[request.command](request);
  };
}
