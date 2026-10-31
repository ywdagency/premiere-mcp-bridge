import { ApiMember, ApiPolicy } from './api-types';
export const VALUE_TYPES = new Set([
  'AAFExportOptions',
  'AddTransitionOptions',
  'CloseProjectOptions',
  'Color',
  'FrameRate',
  'Guid',
  'OpenProjectOptions',
  'PointF',
  'RectF',
  'TickTime',
  'Keyframe',
  'PointKeyframe',
  'MogrtText',
  'MogrtComment',
  'SequenceSettings',
  'TimeDisplay',
  'TextSegments',
  'FootageInterpretation',
  'IngestSettings',
  'ScratchDiskSettings',
]);
const DEDICATED: Record<string, string> = {
  'Project#closeSequence': 'premiere_close_sequence',
  'Project#importAEComps': 'premiere_import_ae_comps',
  'Project#importAllAEComps': 'premiere_import_all_ae_comps',
  'Project#importSequences': 'premiere_import_sequences',
  'Project#close': 'premiere_project_close',
  'Project#pauseGrowing': 'premiere_project_set_growing_media_paused',
  'Project.createProject': 'premiere_project_open',
  'Project.open': 'premiere_project_open',
  'Project#createSequence': 'premiere_create_sequence',
  'Project#createSequenceFromMedia': 'premiere_sequence_from_media',
  'Project#createSequenceWithPresetPath': 'premiere_sequence_from_preset',
  'Project#deleteSequence': 'premiere_delete_working_sequence',
  'Project#openSequence': 'premiere_open_sequence',
  'Project#setActiveSequence': 'premiere_open_sequence',
  'Project#importFiles': 'premiere_import_media',
  'Project#save': 'premiere_save_project',
  'Project#saveAs': 'premiere_save_project_as',
  'Sequence#createCloneAction': 'premiere_duplicate_sequence',
};
const PURE = new Set([
  'Guid.fromString',
  'Guid#toString',
  'FrameRate.createWithValue',
  'FrameRate#equals',
  'Color#equals',
  'PointF#distanceTo',
  'TickTime.createWithTicks',
  'TickTime.createWithSeconds',
  'TickTime.createWithFrameAndFrameRate',
  'TickTime.timecodeToTime',
  'TickTime.timeToTimecode',
  'TickTime#add',
  'TickTime#subtract',
  'TickTime#multiply',
  'TickTime#divide',
  'TickTime#equals',
  'TickTime#alignToFrame',
  'TickTime#alignToNearestFrame',
  'ComponentParam#createKeyframe',
  'AudioFilterFactory.createComponentByDisplayName',
  'VideoFilterFactory.createComponent',
  'TransitionFactory.createVideoTransition',
  'Transcript.importFromJSON',
]);
const JOBS = new Set([
  'Transcript.transcribeClipProjectItem',
  'EncoderManager#exportSequence',
  'EncoderManager#encodeProjectItem',
  'EncoderManager#encodeFile',
  'Exporter.exportSequenceFrame',
  'ProjectConverter.exportAAF',
  'ProjectConverter.exportAsFinalCutProXML',
  'ProjectConverter.exportAsOpenTimelineIO',
  'SequenceUtils.performSceneEditDetectionOnSelection',
]);
export function apiPolicy(m: ApiMember): ApiPolicy {
  if (m.id === 'TextSegments.importFromJSON')
    return {
      mode: 'reference',
      reason:
        'Native output-reference overload has no JSON adapter. Use Transcript.importFromJSON to construct TextSegments.',
    };
  if (m.kind === 'event')
    return {
      mode: 'dedicated',
      tool: 'premiere_api_subscribe_events',
      reason: 'Use bridge-owned event callbacks and a bounded poll buffer.',
    };
  if (m.className === 'EventManager')
    return {
      mode: 'dedicated',
      tool: /remove/.test(m.name)
        ? 'premiere_api_unsubscribe_events'
        : 'premiere_api_subscribe_events',
      reason: 'The bridge owns callback identity/lifetime; it never accepts callback code.',
    };
  if (
    m.parameters.some((p) => /=>|\bfunction\b|callback|Listener/i.test(p.type)) ||
    [
      'Project#executeTransaction',
      'Project#lockedAccess',
      'CompoundAction#addAction',
      'TrackItemSelection.createEmptySelection',
    ].includes(m.id)
  ) {
    return {
      mode: 'reference',
      reason:
        'Callback/lifetime API. The bridge supplies its own locked transactions and inline selection descriptors; it never accepts callback source.',
    };
  }
  if (DEDICATED[m.id])
    return {
      mode: 'dedicated',
      tool: DEDICATED[m.id],
      reason: 'This operation uses a dedicated scoped command.',
    };
  if (m.kind === 'constant') return { mode: 'read' };
  if (m.kind === 'constructor')
    return VALUE_TYPES.has(m.className)
      ? { mode: 'construct', scope: 'value' }
      : {
          mode: 'reference',
          reason: 'This native type is obtained from a documented getter, not constructed freely.',
        };
  if (m.kind === 'property')
    return {
      mode: 'read',
      reason: m.access?.includes('W')
        ? 'Adobe W denotes a readable/writable property. Assignment uses api_mutate and requires an owned draft/value.'
        : undefined,
    };
  if (
    PURE.has(m.id) ||
    m.name === 'cast' ||
    /^(get|is|has|are|can|query|find)/.test(m.name) ||
    m.id === 'Transcript.exportToJSON'
  )
    return { mode: 'read' };
  if (JOBS.has(m.id))
    return {
      mode: 'job',
      scope:
        m.className === 'Transcript'
          ? 'asset'
          : m.className === 'SequenceUtils' || m.className === 'ObjectMaskUtils'
            ? 'sequence'
            : 'export',
    };
  if (/^create.+Action$/.test(m.name))
    return {
      mode: 'action',
      scope: [
        'ClipProjectItem',
        'ProjectItem',
        'FolderItem',
        'Properties',
        'Metadata',
        'Transcript',
      ].includes(m.className)
        ? 'asset'
        : m.className === 'ProjectSettings'
          ? 'project'
          : 'sequence',
    };
  if (VALUE_TYPES.has(m.className) && /^set/.test(m.name))
    return { mode: 'mutate', scope: 'value' };
  if (['VideoTrack', 'AudioTrack', 'CaptionTrack', 'Sequence'].includes(m.className))
    return { mode: 'mutate', scope: 'sequence' };
  if (m.className === 'SequenceEditor') return { mode: 'mutate', scope: 'sequence' };
  if (m.className === 'WorkAreaUtils') return { mode: 'mutate', scope: 'sequence' };
  if (['EncoderManager', 'AppPreference', 'MediaManager'].includes(m.className))
    return {
      mode: 'mutate',
      scope: 'ui',
      reason:
        'Explicit application-wide operation; may affect preferences, caches or the existing AME queue.',
    };
  if (m.className === 'SourceMonitor') return { mode: 'mutate', scope: 'ui' };
  if (['ClipProjectItem', 'Transcript', 'Metadata'].includes(m.className))
    return { mode: 'mutate', scope: 'asset' };
  if (m.className === 'Project' && m.name === 'closeSequence')
    return { mode: 'mutate', scope: 'sequence' };
  return {
    mode: 'reference',
    reason:
      'Application-wide, callback-based or lifecycle operation has no safe generic adapter. Its complete documented signature remains discoverable.',
  };
}
export function versionSupported(current: string, minimum: string): boolean {
  const a = current.split('.').map(Number),
    b = minimum.split('.').map(Number);
  if (!a.length || a.some((n) => !Number.isFinite(n))) return false;
  for (let i = 0; i < 3; i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  }
  return true;
}
