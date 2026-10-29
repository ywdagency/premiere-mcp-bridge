const { controlFixture, tick } = require('./control-fixture.cjs');
const { PremiereControl, PremiereApi } = require('../../build/lib/runtime.cjs');
function apiFixture() {
  const f = controlFixture();
  let depth = 0,
    sequenceSerial = 0;
  const originalLock = f.project.lockedAccess;
  f.project.lockedAccess = (cb) =>
    originalLock(() => {
      depth++;
      try {
        return cb();
      } finally {
        depth--;
      }
    });
  const action = (fn) => {
    if (!depth) throw new Error('Action must be created inside lockedAccess');
    return fn;
  };
  const media = {
    kind: 'clip',
    name: 'Source media',
    getId: () => 'media-1',
    getMediaFilePath: async () => '/granted/source.mov',
    createSetNameAction: (name) =>
      action(() => {
        media.name = name;
      }),
  };
  const root = {
    kind: 'folder',
    name: 'Root',
    getId: () => 'root',
    items: [media],
    getItems: async () => root.items,
    createBinAction: (name) =>
      action(() =>
        root.items.push({
          kind: 'folder',
          name,
          getId: () => `bin-${root.items.length}`,
          getItems: async () => [],
        }),
      ),
    createRemoveItemAction: (item) =>
      action(() => {
        root.items = root.items.filter((v) => v !== item);
      }),
  };
  const settings = {
    value: 24,
    getVideoFrameRate() {
      return { value: this.value };
    },
    setVideoFrameRate(value) {
      this.value = value.value;
      return true;
    },
  };
  function prepareSequence(seq) {
    const item = {
      kind: 'clip',
      getId: () => `item-${seq.guid}`,
      createSetNameAction: (name) =>
        action(() => {
          seq.name = name;
        }),
    };
    seq.getProjectItem = async () => item;
    seq.getSettings = async () => ({ ...settings });
    const track = { name: 'Video 1', getTrackItems: () => seq.items };
    seq.getVideoTrack = async () => track;
    for (const clip of seq.items) {
      clip.getProjectItem = async () => media;
      clip.isDisabled = async () => !!clip.state.disabled;
      clip.createSetDisabledAction = (disabled) =>
        action(() => {
          clip.state.disabled = disabled;
        });
      clip.createSetNameAction = (name) =>
        action(() => {
          clip.state.name = name;
        });
    }
    return seq;
  }
  prepareSequence(f.source);
  f.project.getRootItem = async () => root;
  f.project.deleteSequence = async (seq) => {
    const i = f.sequences.indexOf(seq);
    if (i < 0) return false;
    f.sequences.splice(i, 1);
    return true;
  };
  const oldCreate = f.project.createSequence;
  f.project.createSequence = async (name) => prepareSequence(await oldCreate(name));
  let resolveJob;
  const callbacks = new Set();
  const emitted = [];
  const module = {
    Project: { getActiveProject: () => f.host.getActiveProject() },
    ProjectItem: { cast: (item) => item },
    ClipProjectItem: {
      cast: (item) => {
        if (item.kind !== 'clip') throw new Error('bad cast');
        return item;
      },
    },
    FolderItem: {
      cast: (item) => {
        if (item.kind !== 'folder') throw new Error('bad cast');
        return item;
      },
    },
    TickTime: { createWithTicks: tick },
    Constants: {
      TrackItemType: { CLIP: 1 },
      MediaType: { VIDEO: 'video', AUDIO: 'audio', ANY: 'any' },
      ProjectEvent: { DIRTY: 'dirty' },
    },
    FrameRate: { createWithValue: (value) => ({ value }) },
    Color: class {
      constructor(red = 0, green = 0, blue = 0, alpha = 1) {
        Object.assign(this, { red, green, blue, alpha });
      }
    },
    TrackItemSelection: {
      createEmptySelection: (cb) => {
        let valid = true;
        const items = [];
        cb({
          addItem: (item) => {
            if (!valid) throw new Error('Expired selection');
            items.push(item);
          },
          getTrackItems: () => {
            if (!valid) throw new Error('Expired selection');
            return items;
          },
        });
        valid = false;
        return true;
      },
    },
    SequenceEditor: {
      getEditor: (sequence) => ({
        createRemoveItemsAction: (selection) => {
          const items = selection.getTrackItems();
          return action(() => {
            sequence.items = sequence.items.filter((item) => !items.includes(item));
          });
        },
      }),
    },
    Exporter: {
      exportSequenceFrame: () =>
        new Promise((resolve) => {
          resolveJob = resolve;
        }),
    },
    Transcript: { transcribeClipProjectItem: () => Promise.resolve(true) },
    EventManager: {
      addGlobalEventListener: (name, cb) => {
        callbacks.add(cb);
        emitted.push('add');
      },
      removeGlobalEventListener: (name, cb) => {
        callbacks.delete(cb);
        emitted.push('remove');
      },
    },
  };
  const control = new PremiereControl(f.host);
  const apiHost = {
    module,
    version: '26.5.0',
    getActiveProject: f.host.getActiveProject,
    writesEnabled: f.host.writesEnabled,
    path: async (path, mode) => {
      if (path.startsWith('/') || path.includes('..')) throw new Error('path rejected');
      return '/granted/' + path;
    },
    readText: async () => 'x'.repeat(20000),
  };
  const api = new PremiereApi(apiHost, control);
  async function working() {
    const seq = prepareSequence(f.sequence(`Working ${++sequenceSerial}`));
    control.markWorking(f.project, seq);
    return seq;
  }
  async function context(seq = f.source) {
    return api.context({ sequenceId: seq.guid });
  }
  async function read(id, target, parameters = {}) {
    return (
      await api.read({
        memberId: id,
        ...(target ? { target: typeof target === 'string' ? target : target.$ref } : {}),
        parameters,
      })
    ).value;
  }
  async function clip(seq = f.source) {
    const c = await context(seq),
      track = await read('Sequence#getVideoTrack', c.sequence, { trackIndex: 0 });
    const clips = await read('VideoTrack#getTrackItems', track, {
      trackItemType: { $enum: 'Constants.TrackItemType.CLIP' },
      includeEmptyTrackItems: false,
    });
    return { c, track, clip: clips.items[0] };
  }
  return {
    ...f,
    root,
    media,
    module,
    control,
    api,
    apiHost,
    working,
    context,
    read,
    clipRef: clip,
    action,
    finishJob: () => resolveJob?.(true),
    callbacks,
    emitted,
  };
}
module.exports = { apiFixture };
