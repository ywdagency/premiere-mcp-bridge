const fs = require("node:fs/promises");
const { join } = require("node:path");

function folderAdapter(directory) {
  function file(name, isFile = true) {
    return {
      name, isFile,
      read: () => fs.readFile(join(directory, name), "utf8"),
      write: async (text) => {
        // Emulate UXP's host-controlled file mode within the private folder.
        await fs.writeFile(join(directory, name), text, { mode: 0o644 });
        return text.length;
      },
      delete: () => fs.unlink(join(directory, name))
    };
  }
  return {
    getEntries: async () => (await fs.readdir(directory, { withFileTypes: true })).map((e) => file(e.name, e.isFile())),
    getEntry: async (name) => { await fs.stat(join(directory, name)); return file(name); },
    createFile: async (name, options = {}) => {
      const handle = await fs.open(join(directory, name), options.overwrite ? "w" : "wx", 0o644);
      await handle.close();
      return file(name);
    },
    renameEntry: async (entry, name) => fs.rename(join(directory, entry.name), join(directory, name))
  };
}

function hostFixture() {
  const time = (seconds) => ({ seconds, ticks: (BigInt(seconds) * 254016000000n).toString() });
  const clip = (name, start, end, sourceIn) => ({
    getProjectItem: async () => ({ getId: () => `item-${name}` }),
    getName: async () => name, getStartTime: async () => time(start), getEndTime: async () => time(end),
    getDuration: async () => time(end - start), getInPoint: async () => time(sourceIn),
    getOutPoint: async () => time(sourceIn + end - start), getSpeed: async () => 1, isSpeedReversed: async () => 0
  });
  const track = (name, clips) => ({ name, getTrackItems(type, includeEmpty) {
    if (type !== 1 || includeEmpty !== false) throw new Error("Only clips may be read");
    return clips;
  } });
  const videoTracks = [track("Video 1", [clip("Shot A", 0, 4, 20), clip("Shot B", 4, 10, 30)])];
  const audioTracks = [track("Voice", [clip("Voice take", 0, 10, 2)]), track("Audio 2", [])];
  const sequence = {
    guid: "sequence-fixture", name: "Read-only fixture",
    getEndTime: async () => ({ seconds: 10, ticks: "2540160000000" }),
    getPlayerPosition: async () => ({ seconds: 0, ticks: "0" }),
    getTimebase: async () => "10594584000",
    getVideoTrackCount: async () => 1, getAudioTrackCount: async () => 2,
    getVideoTrack: async (index) => videoTracks[index], getAudioTrack: async (index) => audioTracks[index],
    getZeroPoint: async () => time(0), getSequenceVideoTimeDisplayFormat: async () => ({ type: 110 })
  };
  const project = {
    guid: "project-fixture", name: "Transport fixture", path: "/test/private.prproj",
    getSequences: async () => [sequence], getActiveSequence: async () => sequence
  };
  return { name: "premierepro", version: "26.2.2", uxpVersion: "9.2.1", getActiveProject: async () => project,
    clipConstants: { clipType: 1, displayFormats: { FPS_23_976: 110, FRAMES: 109 } } };
}

module.exports = { folderAdapter, hostFixture };
