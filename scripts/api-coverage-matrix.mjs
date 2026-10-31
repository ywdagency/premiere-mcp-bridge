import { readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import policy from "../build/lib/api-policy.cjs";

const catalog = JSON.parse(
  readFileSync(new URL("../data/adobe-api.json", import.meta.url), "utf8"),
);
const verification = JSON.parse(
  readFileSync(
    new URL("../data/live-verification.json", import.meta.url),
    "utf8",
  ),
);
const routes = {
  read: "premiere_api_read",
  construct: "premiere_api_construct",
  action: "premiere_api_apply_actions",
  mutate: "premiere_api_mutate",
  job: "premiere_api_start_job",
};
const internal = {
  "Project#lockedAccess":
    "Bridge-owned synchronous project lock; never a caller callback.",
  "Project#executeTransaction":
    "Bridge-owned synchronous transaction for api_apply_actions.",
  "CompoundAction#addAction":
    "Bridge consumes Actions inside its own transaction callback.",
  "TrackItemSelection.createEmptySelection":
    "Bridge-owned callback for inline $selection descriptors.",
  "TrackItemSelection#addItem":
    "Inline $selection builds a bounded selection during its callback.",
};
const alternatives = {
  "TrackItemSelection#removeItem":
    "Supply the desired selection without that clip in $selection; no persistent native selection mutation endpoint.",
  "TextSegments.importFromJSON":
    "Use Transcript.importFromJSON to obtain TextSegments; no callback source or escaped callback-scoped object.",
};
export const DOMAINS = [
  {
    id: "projects",
    classes: [
      "Project",
      "CloseProjectOptions",
      "OpenProjectOptions",
      "ProjectSettings",
      "ProjectColorSettings",
      "ProjectUtils",
      "PRProduction",
    ],
    scenario: "P01",
  },
  {
    id: "sequences",
    classes: [
      "Sequence",
      "SequenceSettings",
      "SequenceEditor",
      "SequenceUtils",
      "WorkAreaUtils",
      "TrackItemSelection",
    ],
    scenario: "P02",
  },
  {
    id: "video",
    classes: ["VideoClipTrackItem", "VideoTrack"],
    scenario: "P03",
  },
  {
    id: "audio",
    classes: ["AudioClipTrackItem", "AudioTrack"],
    scenario: "P04",
  },
  {
    id: "effects",
    classes: [
      "VideoComponentChain",
      "AudioComponentChain",
      "VideoFilterFactory",
      "AudioFilterFactory",
      "VideoFilterComponent",
      "AudioFilterComponent",
      "Component",
      "ComponentParam",
    ],
    scenario: "P05",
  },
  { id: "animation", classes: ["Keyframe", "PointKeyframe"], scenario: "P06" },
  {
    id: "transitions",
    classes: ["TransitionFactory", "VideoTransition", "AddTransitionOptions"],
    scenario: "P07",
  },
  {
    id: "media",
    classes: [
      "ProjectItem",
      "ClipProjectItem",
      "FolderItem",
      "ProjectItemSelection",
      "Media",
      "FootageInterpretation",
      "IngestSettings",
      "Metadata",
      "Properties",
    ],
    scenario: "P08",
  },
  { id: "graphics", classes: ["MogrtText", "MogrtComment"], scenario: "P09" },
  { id: "captions", classes: ["CaptionTrack"], scenario: "P10" },
  { id: "markers", classes: ["Marker", "Markers"], scenario: "P11" },
  {
    id: "transcripts",
    classes: ["Transcript", "TextSegments"],
    scenario: "P12",
  },
  {
    id: "exports",
    classes: [
      "EncoderManager",
      "Exporter",
      "ProjectConverter",
      "AAFExportOptions",
    ],
    scenario: "P13",
  },
  {
    id: "events",
    classes: [
      "EventManager",
      "OperationCompleteEvent",
      "ProjectClosedEvent",
      "ProjectEvent",
      "SnapEvent",
    ],
    scenario: "P14",
  },
  { id: "source-monitor", classes: ["SourceMonitor"], scenario: "P15" },
  {
    id: "application",
    classes: [
      "Application",
      "AppPreference",
      "MediaManager",
      "ScratchDiskSettings",
      "Utils",
    ],
    scenario: "P16",
  },
  {
    id: "inspection",
    classes: ["ObjectMaskUtils", "C2PAService"],
    scenario: "P17",
  },
  {
    id: "values",
    classes: [
      "Action",
      "CompoundAction",
      "Color",
      "FrameRate",
      "Guid",
      "PointF",
      "RectF",
      "TickTime",
      "TimeDisplay",
      "UniqueSerializeable",
    ],
    scenario: "P18",
  },
];

export function buildMatrix() {
  const members = [
    ...catalog.classes.flatMap((cls) => cls.members),
    ...catalog.constants,
  ];
  const records = members.map((member) => {
    const execution = policy.apiPolicy(member);
    const domain = DOMAINS.find((domain) =>
      domain.classes.includes(member.className),
    );
    if (!domain && member.kind !== "constant")
      throw new Error(`Unclassified API class: ${member.className}`);
    const unavailable = (verification.unavailable ?? []).find(
      (entry) => entry.id === member.id,
    );
    return {
      id: member.id,
      className: member.className,
      kind: member.kind,
      since: member.since,
      domain: member.kind === "constant" ? "constants" : domain.id,
      scenario: member.kind === "constant" ? "P18" : domain.scenario,
      policy: execution.mode,
      route: execution.tool ?? routes[execution.mode] ?? null,
      adapterStatus: internal[member.id]
        ? "internal"
        : alternatives[member.id]
          ? "declarative-alternative"
          : execution.mode === "reference"
            ? "not-adapted"
            : "routed-not-runtime-proof",
      ...(internal[member.id] || alternatives[member.id] || execution.reason
        ? {
            reason:
              internal[member.id] ??
              alternatives[member.id] ??
              execution.reason,
          }
        : {}),
      eligibleOn26_5: policy.versionSupported("26.5.0", member.since),
      verification: unavailable
        ? { state: "observed-unavailable", ...unavailable }
        : verification.members.includes(member.id)
          ? {
              state: "recorded-member-check",
              hostVersion: verification.hostVersion,
              report: verification.report,
              note: "A recorded member check is not verification of every argument, context or variant.",
            }
          : { state: "pending-live-check" },
      source: member.source,
    };
  });
  const count = (key) =>
    Object.fromEntries(
      [...new Set(records.map((entry) => entry[key]))]
        .sort()
        .map((value) => [
          value,
          records.filter((entry) => entry[key] === value).length,
        ]),
    );
  return {
    schemaVersion: 1,
    provenance: catalog.provenance,
    scope:
      "Pinned Premiere DOM only; routing policy is not proof of implementation behavior or native support.",
    counts: {
      types: catalog.classes.length,
      members: records.length,
      byAdapterStatus: count("adapterStatus"),
      byPolicy: count("policy"),
      recordedMemberChecks: records.filter(
        (entry) => entry.verification.state === "recorded-member-check",
      ).length,
      observedUnavailable: records.filter(
        (entry) => entry.verification.state === "observed-unavailable",
      ).length,
    },
    domains: DOMAINS,
    members: records,
  };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const matrix = buildMatrix();
  writeFileSync(
    new URL("../data/api-coverage-matrix.json", import.meta.url),
    JSON.stringify(matrix, null, 2) + "\n",
  );
  console.log(JSON.stringify(matrix.counts));
}
