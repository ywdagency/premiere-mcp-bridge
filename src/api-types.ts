export interface ApiType {
  kind: string;
  name?: string;
  value?: unknown;
  items?: ApiType;
  types?: ApiType[];
  fields?: Record<string, { schema: ApiType; optional: boolean }>;
  values?: ApiType;
}
export interface ApiParameter {
  schema?: ApiType;
  name: string;
  type: string;
  optional: boolean;
  description?: string;
}
export interface ApiMember {
  id: string;
  className: string;
  name: string;
  kind: 'static' | 'method' | 'constructor' | 'property' | 'constant' | 'event';
  result?: ApiType;
  documentedSince?: string;
  compatibilityNote?: string;
  since: string;
  returns: string;
  parameters: ApiParameter[];
  type?: string;
  access?: string;
  enum?: string;
  description?: string;
  source?: string;
}
export interface ApiClass {
  name: string;
  since: string;
  source?: string;
  members: ApiMember[];
}
export interface ApiCatalog {
  schemaVersion: number;
  provenance: {
    repository: string;
    commit: string;
    tree: string;
    fetchedAt: string;
    license: string;
    sdkVersion: string;
  };
  classes: ApiClass[];
  constants: ApiMember[];
}
export type ApiMode =
  | 'read'
  | 'construct'
  | 'action'
  | 'mutate'
  | 'job'
  | 'dedicated'
  | 'reference';
export interface ApiPolicy {
  mode: ApiMode;
  scope?: 'value' | 'sequence' | 'asset' | 'project' | 'ui' | 'export';
  reason?: string;
  tool?: string;
}
export interface ApiScope {
  projectId?: string;
  sequenceId?: string;
  assetId?: string;
  ownedValue?: boolean;
  clip?: ClipObservation;
}
export interface ClipObservation {
  object: unknown;
  start: string;
  end: string;
  sourceIn: string;
  sourceOut: string;
  projectItemId: string;
}
export interface ApiHandle {
  id: string;
  types: string[];
  candidateTypes?: string[];
  native: any;
  scope: ApiScope;
  lastAccess: number;
}
