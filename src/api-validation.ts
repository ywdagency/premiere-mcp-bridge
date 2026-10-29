import { BridgeError, object, onlyKeys } from './bridge-protocol';
import { ApiType, ApiHandle, ApiMember } from './api-types';
export interface ValueResolver {
  handle(id: string): ApiHandle;
  constant(id: string): unknown;
}
const bad = (message: string): never => {
  throw new BridgeError('INVALID_API_ARGUMENT', message);
};
export function boundedJson(value: unknown, depth = 0, budget = { nodes: 0 }): void {
  if (depth > 10 || ++budget.nodes > 3000) bad('API input exceeds nesting or item limits.');
  if (value === null || typeof value === 'boolean') return;
  if (typeof value === 'number') {
    if (!Number.isFinite(value) || Math.abs(value) > 1e15) bad('Expected a bounded finite number.');
    return;
  }
  if (typeof value === 'string') {
    if (value.length > 8192 || value.includes('\u0000'))
      bad('API strings must be at most 8192 characters without NUL.');
    return;
  }
  if (Array.isArray(value)) {
    if (value.length > 128) bad('API arrays are limited to 128 items.');
    for (const v of value) boundedJson(v, depth + 1, budget);
    return;
  }
  const record = object(value);
  for (const [key, entry] of Object.entries(record)) {
    if (['__proto__', 'prototype', 'constructor'].includes(key))
      bad('Prototype keys are forbidden.');
    boundedJson(entry, depth + 1, budget);
  }
}
export function referenceIds(value: unknown): string[] {
  if (value === null || typeof value !== 'object') return [];
  if (Array.isArray(value)) return value.flatMap(referenceIds);
  const r = value as Record<string, unknown>;
  if (typeof r.$ref === 'string') return [r.$ref];
  if (Array.isArray(r.$selection)) return r.$selection as string[];
  return Object.values(r).flatMap(referenceIds);
}
export function resolveValue(value: unknown, schema: ApiType, resolver: ValueResolver): any {
  if (value === undefined) {
    if (['undefined', 'void', 'unknown'].includes(schema.kind)) return undefined;
    bad('A required API argument is missing.');
  }
  if (value === null) {
    if (['null', 'unknown'].includes(schema.kind)) return null;
  }
  if (schema.kind === 'union') {
    for (const type of schema.types ?? []) {
      try {
        return resolveValue(value, type, resolver);
      } catch (e) {
        if (!(e instanceof BridgeError) || e.code !== 'INVALID_API_ARGUMENT') throw e;
      }
    }
    return bad('Value does not match any documented parameter type.');
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const r = value as Record<string, unknown>;
    if ('$selection' in r) {
      onlyKeys(r, ['$selection']);
      if (
        schema.kind !== 'ref' ||
        schema.name !== 'TrackItemSelection' ||
        !Array.isArray(r.$selection) ||
        r.$selection.length > 100
      )
        bad('Inline selections require up to 100 track-item handle IDs.');
      for (const id of r.$selection as unknown[]) {
        if (typeof id !== 'string') bad('A selection requires handle IDs.');
        const h = resolver.handle(id as string);
        if (!h.types.some((t) => ['VideoClipTrackItem', 'AudioClipTrackItem'].includes(t)))
          bad('Selections accept clip handles only.');
      }
      return undefined;
    }
    if ('$ref' in r) {
      onlyKeys(r, ['$ref']);
      if (typeof r.$ref !== 'string') bad('Invalid object reference.');
      const h = resolver.handle(r.$ref as string);
      if (schema.kind === 'string' && h.types.includes('String') && typeof h.native === 'string')
        return h.native;
      if (schema.kind !== 'ref' && schema.kind !== 'unknown')
        bad('A native object reference cannot replace a primitive.');
      if (schema.kind === 'ref' && schema.name && !h.types.includes(schema.name))
        bad(`Expected a ${schema.name} reference, received ${h.types.join('|')}.`);
      return h.native;
    }
    if ('$enum' in r) {
      onlyKeys(r, ['$enum']);
      if (typeof r.$enum !== 'string') bad('Invalid enum reference.');
      if (schema.kind === 'enum' && !(r.$enum as string).startsWith(`${schema.name}.`))
        bad(`Expected ${schema.name}.`);
      const result = resolver.constant(r.$enum as string);
      return schema.kind === 'enum' ? result : resolveValue(result, schema, resolver);
    }
  }
  switch (schema.kind) {
    case 'string':
      if (typeof value === 'string') return value;
      break;
    case 'number':
      if (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= 1e15)
        return value;
      break;
    case 'boolean':
      if (typeof value === 'boolean') return value;
      break;
    case 'literal':
      if (value === schema.value) return value;
      break;
    case 'null':
      if (value === null) return null;
      break;
    case 'tuple':
      if (Array.isArray(value) && value.length === schema.types?.length)
        return value.map((v, i) => resolveValue(v, schema.types![i], resolver));
      break;
    case 'array':
      if (Array.isArray(value) && value.length <= 128)
        return value.map((v) => resolveValue(v, schema.items ?? { kind: 'unknown' }, resolver));
      break;
    case 'object': {
      const r = object(value);
      onlyKeys(r, Object.keys(schema.fields ?? {}));
      const result: Record<string, unknown> = {};
      for (const [name, field] of Object.entries(schema.fields ?? {})) {
        if (r[name] === undefined && field.optional) continue;
        result[name] = resolveValue(r[name], field.schema, resolver);
      }
      return result;
    }
    case 'record': {
      const r = object(value);
      return Object.fromEntries(
        Object.entries(r).map(([k, v]) => [
          k,
          resolveValue(v, schema.values ?? { kind: 'unknown' }, resolver),
        ]),
      );
    }
    case 'unknown':
      boundedJson(value);
      return value;
    case 'ref':
      return bad(`Use a typed {$ref:handleId} for ${schema.name}.`);
    case 'enum':
      return bad(`Use {$enum:'${schema.name}.MEMBER'} for an enumeration.`);
    case 'callback':
      return bad('Callback functions cannot be supplied through MCP.');
    case 'void':
    case 'undefined':
      if (value === undefined) return undefined;
  }
  return bad(`Expected documented type ${schema.name ?? schema.kind}.`);
}
export function parametersFor(member: ApiMember, value: unknown, resolver: ValueResolver): any[] {
  const args = object(value);
  onlyKeys(
    args,
    member.parameters.map((p) => p.name),
  );
  const result = member.parameters.map((p) =>
    args[p.name] === undefined && p.optional
      ? undefined
      : resolveValue(args[p.name], p.schema ?? { kind: 'unknown' }, resolver),
  );
  while (result.length && result[result.length - 1] === undefined) result.pop();
  if (
    member.id === 'TickTime.createWithTicks' &&
    (!/^-?(0|[1-9][0-9]{0,18})$/.test(String(result[0])) ||
      (String(result[0]).replace('-', '').length === 19 &&
        String(result[0]).replace('-', '') >
          (String(result[0]).startsWith('-') ? '9223372036854775808' : '9223372036854775807')))
  )
    bad('TickTime requires an integer string within signed 64-bit range.');
  if (member.id === 'FrameRate.createWithValue' && (result[0] <= 0 || result[0] > 1000))
    bad('Frame rate must be greater than zero and at most 1000.');
  return result;
}
