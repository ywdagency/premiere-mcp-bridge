const { hostFixture } = require('./bridge-fixture.cjs');
const TPS = 254016000000n;
function tick(ticks) { const value = BigInt(ticks); return { ticks: String(value), seconds: Number(value) / Number(TPS),
  add(other) { return tick(value + BigInt(other.ticks)); }, subtract(other) { return tick(value - BigInt(other.ticks)); } }; }
function controlFixture() {
  const inspection = hostFixture();
  let active, serial = 0, enabled = true, lockDepth = 0;
  function action(fn) { if (!lockDepth) throw new Error('Adobe requires action creation inside a project lock'); return fn; }
  const transactions = [], imports = [];
  function clip({ name = 'Clip', start = 0, end = 4, sourceIn = 20, itemId = 'media-1' } = {}) {
    const state = { name, start: tick(BigInt(start) * TPS), end: tick(BigInt(end) * TPS),
      sourceIn: tick(BigInt(sourceIn) * TPS), sourceOut: tick(BigInt(sourceIn + end - start) * TPS), speed: 1, reversed: false };
    return { state, getName: async () => state.name, getProjectItem: async () => ({ getId: () => itemId }),
      getStartTime: async () => state.start, getEndTime: async () => state.end,
      getDuration: async () => state.end.subtract(state.start), getInPoint: async () => state.sourceIn, getOutPoint: async () => state.sourceOut,
      getSpeed: async () => state.speed, isSpeedReversed: async () => state.reversed,
      createMoveAction: (shift) => action(() => { state.start = state.start.add(shift); state.end = state.end.add(shift); }),
      createSetStartAction: (time) => { const delta = time.subtract(state.start); return action(() => { state.start = state.start.add(delta); state.sourceIn = state.sourceIn.add(delta); }); }, createSetEndAction: (time) => { const delta = time.subtract(state.end); return action(() => { state.end = state.end.add(delta); state.sourceOut = state.sourceOut.add(delta); }); },
      createSetInPointAction: (time) => { const delta = time.subtract(state.sourceIn); return action(() => { state.sourceIn = state.sourceIn.add(delta); state.start = state.start.add(delta); }); }, createSetOutPointAction: (time) => { const delta = time.subtract(state.sourceOut); return action(() => { state.sourceOut = state.sourceOut.add(delta); state.end = state.end.add(delta); }); }
    };
  }
  const sequences = [];
  function sequence(name = 'Source', items = [clip()]) {
    const tracks = [{ name: 'Video 1', getTrackItems: () => items }];
    const value = { guid: `sequence-${++serial}`, name, items, getVideoTrack: async (i) => tracks[i],
      getAudioTrack: async () => ({ getTrackItems: () => [] }), getVideoTrackCount: async () => 1, getAudioTrackCount: async () => 0,
      getProjectItem: async () => ({ createSetNameAction: (next) => action(() => { value.name = next; }) }),
      createCloneAction: () => action(() => { sequence(`${name} Copy`, items.map((item) => clip({
        name: item.state.name, start: item.state.start.seconds, end: item.state.end.seconds, sourceIn: item.state.sourceIn.seconds
      }))); })
    };
    sequences.push(value);
    return value;
  }
  const source = sequence(); active = source;
  const project = { guid: 'project-control', name: 'Control fixture', getSequences: async () => sequences,
    getActiveSequence: async () => active, createSequence: async (name) => sequence(name, []),
    openSequence: async (seq) => { active = seq; return true; }, getRootItem: async () => ({ name: 'Root' }),
    importFiles: async (...args) => { imports.push(args); return true; }, lockedAccess: (callback) => { lockDepth++; try { callback(); } finally { lockDepth--; } },
    executeTransaction: (callback, label) => { const actions = []; callback({ addAction: (action) => actions.push(action) });
      transactions.push({ label, actions: actions.length }); for (const action of actions) action(); return true; }
  };
  const host = { getActiveProject: async () => project, tickTime: tick, clipType: 1, writesEnabled: () => enabled,
    resolveMedia: async (paths) => paths.map((path) => `/granted/${path}`), mediaGranted: () => true, projectItem: (root) => root };
  const inspectHost = { ...inspection, getActiveProject: async () => project };
  return { host, inspectHost, project, source, sequences, transactions, imports, tick, clip, sequence,
    setEnabled: (value) => { enabled = value; }, setActive: (seq) => { active = seq; } };
}
module.exports = { controlFixture, tick, TPS };
