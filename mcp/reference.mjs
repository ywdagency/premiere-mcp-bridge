import { readFileSync } from 'node:fs';
import { ResourceTemplate } from '@modelcontextprotocol/server';
import * as z from 'zod/v4';
import policy from '../build/lib/api-policy.cjs';
const catalog = JSON.parse(
  readFileSync(new URL('../data/adobe-api.json', import.meta.url), 'utf8'),
);
const members = [...catalog.classes.flatMap((c) => c.members), ...catalog.constants];
const index = new Map(members.map((m) => [m.id, m]));
let verified = { members: [] };
try {
  verified = JSON.parse(
    readFileSync(new URL('../data/live-verification.json', import.meta.url), 'utf8'),
  );
} catch {}
const toolFor = {
  read: 'premiere_api_read',
  construct: 'premiere_api_construct',
  action: 'premiere_api_apply_actions',
  mutate: 'premiere_api_mutate',
  job: 'premiere_api_start_job',
};
function describeMember(m, hostVersion) {
  const p = policy.apiPolicy(m);
  return {
    ...m,
    execution: {
      ...p,
      tool: p.tool ?? toolFor[p.mode] ?? null,
      ...(m.kind === 'property' && m.access?.includes('W')
        ? { writeTool: 'premiere_api_mutate', writeRequires: 'Owned draft/value object' }
        : {}),
      versionCompatible: hostVersion ? policy.versionSupported(hostVersion, m.since) : null,
      liveVerified: verified.members.includes(m.id)
        ? {
            hostVersion: verified.hostVersion,
            checkedAt: verified.checkedAt,
            report: verified.report,
          }
        : false,
      observedUnavailable: (verified.unavailable ?? []).find((item) => item.id === m.id) ?? null,
      notice:
        'Catalog presence and policy eligibility do not prove native availability. Probe the connected runtime; current object scope and editing/file grants also apply.',
    },
  };
}
export function search({ query = '', className, mode, offset = 0, limit = 20, hostVersion } = {}) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  const found = members.filter(
    (m) =>
      (!className || m.className === className) &&
      (!mode || policy.apiPolicy(m).mode === mode) &&
      words.every((w) =>
        `${m.id} ${m.description} ${m.parameters.map((p) => p.name).join(' ')}`
          .toLowerCase()
          .includes(w),
      ),
  );
  return {
    provenance: catalog.provenance,
    members: found
      .slice(offset, offset + limit)
      .map((m) => ({
        id: m.id,
        kind: m.kind,
        since: m.since,
        description: m.description?.slice(0, 220),
        execution: describeMember(m, hostVersion).execution,
      })),
    page: {
      offset,
      limit,
      total: found.length,
      nextOffset: offset + limit < found.length ? offset + limit : null,
    },
  };
}
export function describe({ id, offset = 0, limit = 25, hostVersion }) {
  if (index.has(id)) return describeMember(index.get(id), hostVersion);
  const cls = catalog.classes.find((c) => c.name === id);
  if (!cls) throw new Error('Use a documented class name or exact member ID from api_search.');
  return {
    ...cls,
    members: cls.members.slice(offset, offset + limit).map((m) => describeMember(m, hostVersion)),
    page: {
      offset,
      limit,
      total: cls.members.length,
      nextOffset: offset + limit < cls.members.length ? offset + limit : null,
    },
  };
}
export function coverage({ hostVersion } = {}) {
  const counts = {};
  for (const m of members) {
    const mode = policy.apiPolicy(m).mode;
    counts[mode] = (counts[mode] ?? 0) + 1;
  }
  return {
    provenance: catalog.provenance,
    types: catalog.classes.length,
    members: members.length,
    constants: catalog.constants.length,
    byPolicy: counts,
    versionEligible: hostVersion
      ? members.filter((m) => policy.versionSupported(hostVersion, m.since)).length
      : null,
    liveVerification: verified,
    classes: catalog.classes.map((c) => ({
      name: c.name,
      members: c.members.length,
      source: c.source,
    })),
    limitations: [
      'Only Adobe Premiere DOM API is executable. General UXP JavaScript, shell, network, UI DOM and arbitrary code are excluded.',
      'Native timeline writes require bridge-created working sequences. Media source changes require an explicitly tracked newly imported asset.',
      'Callback/lifetime APIs use bridge-owned transactions, selections and event subscriptions. Project close and unsupported lifecycle/output-reference overloads remain documented only.',
      'API presence is probed at runtime. Newer documented APIs may not exist in the installed Premiere.',
      'Native Promise success does not guarantee queued AME rendering is finished.',
    ],
  };
}
export function registerReference(server) {
  const host = z
    .string()
    .regex(/^\d+\.\d+(\.\d+)?$/)
    .optional();
  const definitions = [
    [
      'search',
      {
        query: z.string().max(200).optional(),
        className: z.string().max(80).optional(),
        mode: z
          .enum(['read', 'construct', 'action', 'mutate', 'job', 'dedicated', 'reference'])
          .optional(),
        offset: z.number().int().min(0).max(10000).optional(),
        limit: z.number().int().min(1).max(30).optional(),
        hostVersion: host,
      },
      search,
      'Search the pinned complete official Adobe Premiere DOM API, including methods, properties, events and constants. Works without Premiere. Use English API terms. Eligibility is distinct from live verification.',
    ],
    [
      'describe',
      {
        id: z.string().min(1).max(256),
        offset: z.number().int().min(0).max(10000).optional(),
        limit: z.number().int().min(1).max(25).optional(),
        hostVersion: host,
      },
      describe,
      'Read the exact documented signature, named parameter schemas, returns, version correction, official source and execution policy. IDs: Class#instanceMethod, Class.staticMethod, Class@property, new Class, Constants.Enum.MEMBER. A class name returns a paged class reference.',
    ],
    [
      'coverage',
      { hostVersion: host },
      coverage,
      'Read full catalog coverage, provenance, class inventory and separate live-verification evidence. No Premiere connection is required.',
    ],
  ];
  for (const [name, fields, fn, description] of definitions)
    server.registerTool(
      `premiere_api_${name}`,
      {
        description,
        inputSchema: z.object(fields).strict(),
        annotations: {
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: false,
        },
      },
      async (args) => {
        try {
          const value = fn(args);
          return {
            content: [{ type: 'text', text: JSON.stringify(value) }],
            structuredContent: value,
          };
        } catch {
          return {
            isError: true,
            content: [
              { type: 'text', text: 'Unknown documented API identifier. Use premiere_api_search.' },
            ],
          };
        }
      },
    );
  server.registerResource(
    'premiere-api-index',
    'premiere://api/index',
    {
      mimeType: 'application/json',
      description:
        'Pinned official Adobe API index, provenance, execution coverage and live test evidence.',
    },
    async (uri) => ({
      contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(coverage()) }],
    }),
  );
  server.registerResource(
    'premiere-api-member',
    new ResourceTemplate('premiere://api/member/{id}', { list: undefined }),
    {
      mimeType: 'application/json',
      description: 'Exact member/class reference. URI-encode the ID, including #, @ and spaces.',
    },
    async (uri, variables) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(describe({ id: decodeURIComponent(String(variables.id)) })),
        },
      ],
    }),
  );
}
