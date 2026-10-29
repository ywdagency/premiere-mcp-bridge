import ts from 'typescript';
import { typeSchema } from './api-type-schema.mjs';
import { readFile, readdir, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
export const clean = (text = '') =>
  text
    .replace(/\[((?:[^\[\]]|\[[^\]]*\])*)\]\([^)]*\)/g, '$1')
    .replace(/\\([<>|])/g, '$1')
    .replace(/[*`]/g, '')
    .replace(/<\/?(?:br|p|HorizontalLine|code|span)\b[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
function rows(text) {
  return text
    .split('\n')
    .filter((l) => /^\s*\|/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\||\|$/g, '')
        .split(/(?<!\\)\|/)
        .map(clean),
    )
    .filter((r) => r[0] && !/^:?-/.test(r[0]) && !['Name', 'Property'].includes(r[0]));
}
function version(text, fallback = '25.6') {
  return /Since:\s*\*?(\d+\.\d+(?:\.\d+)?)/.exec(text)?.[1] ?? fallback;
}
function description(text) {
  return clean(text.split(/\n(?:Since:|Returns:|#### |<HorizontalLine|\|)/)[0]).slice(0, 2000);
}
export function sdkSignatures(source) {
  const file = ts.createSourceFile('premierepro.d.ts', source, ts.ScriptTarget.Latest, true);
  const out = Object.create(null);
  for (const node of file.statements) {
    if (!ts.isTypeAliasDeclaration(node) || !ts.isTypeLiteralNode(node.type)) continue;
    const type = node.name.text;
    out[type] = Object.create(null);
    for (const member of node.type.members) {
      if (
        ts.isMethodSignature(member) ||
        ts.isConstructSignatureDeclaration(member) ||
        ts.isCallSignatureDeclaration(member)
      ) {
        const name = member.name?.getText(file).replace(/^['"]|['"]$/g, '') ?? 'constructor';
        out[type][name] = {
          parameters: member.parameters.map((p) => ({
            name: p.name.getText(file),
            type: p.type?.getText(file) ?? 'unknown',
            optional: !!p.questionToken || !!p.initializer,
          })),
          returns: member.type?.getText(file) ?? 'void',
        };
      }
    }
  }
  return out;
}
export function parseClass(markdown, filename, signatures) {
  const name = /^# (.+)$/m.exec(markdown)?.[1]?.trim();
  if (!name) throw new Error(`Missing class heading: ${filename}`);
  const since = version(markdown);
  const source = `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/${filename.replace(/\.md$/, '')}`;
  const members = [];
  let section = '';
  const parts = markdown.split(/^(#{2,3} .+)$/m);
  for (let i = 1; i < parts.length; i += 2) {
    const heading = parts[i],
      body = parts[i + 1] ?? '';
    if (heading.startsWith('## ')) {
      section = heading.slice(3).trim();
      if (section === 'Properties')
        for (const r of rows(body)) {
          if (r.length < 4) continue;
          members.push({
            id: `${name}@${r[0]}`,
            className: name,
            name: r[0],
            kind: 'property',
            type: r[1],
            access: r[2],
            since: r[3] || since,
            description: r[4] ?? '',
            parameters: [],
            returns: r[1],
            source: `${source}#properties`,
          });
        }
      if (section === 'Constructor') {
        const sig = signatures[`${name}Static`]?.constructor ?? { parameters: [], returns: name };
        const doc = rows(body);
        members.push({
          id: `new ${name}`,
          className: name,
          name: 'constructor',
          kind: 'constructor',
          since: version(body, since),
          description: description(body),
          parameters: doc.length
            ? doc.map((r, j) => ({
                name: r[0],
                type: r[1],
                description: r[2] ?? '',
                optional: sig.parameters[j]?.optional ?? false,
              }))
            : sig.parameters,
          returns: name,
          source: `${source}#constructor`,
        });
      }
      if (section === 'Events')
        for (const r of rows(body))
          members.push({
            id: `${name}!${r[0]}`,
            className: name,
            name: r[0],
            kind: 'event',
            since: r[1] || since,
            description: r[2] ?? '',
            parameters: [],
            returns: 'event',
            source: `${source}#events`,
          });
      continue;
    }
    if (!['Static Methods', 'Instance Methods'].includes(section)) continue;
    const method = heading.slice(4).trim(),
      isStatic = section === 'Static Methods';
    const sig = signatures[`${name}${isStatic ? 'Static' : ''}`]?.[method];
    const table = /#### Parameters([\s\S]*)/.exec(body)?.[1] ?? '';
    const parameters = rows(table).map((r, j) => ({
      name: r[0] === 'undefined' ? (sig?.parameters[j]?.name ?? r[0]) : r[0],
      type: r[1] || sig?.parameters[j]?.type || 'unknown',
      description: r[2] ?? '',
      optional: sig?.parameters[j]?.optional ?? /optional/i.test(r[2] ?? ''),
    }));
    const returns = clean(/^Returns:\s*(.+)$/m.exec(body)?.[1] ?? sig?.returns ?? 'void');
    members.push({
      id: `${name}${isStatic ? '.' : '#'}${method}`,
      className: name,
      name: method,
      kind: isStatic ? 'static' : 'method',
      since: version(body, since),
      description: description(body),
      parameters,
      returns,
      source: `${source}#${method.toLowerCase()}`,
    });
  }
  return { name, since, source, members };
}
export function parseConstants(markdown) {
  const constants = [];
  const sections = markdown.split(/^### (.+)$/m);
  for (let i = 1; i < sections.length; i += 2) {
    const name = sections[i].trim(),
      body = sections[i + 1];
    const since = version(body);
    for (const row of rows(body))
      constants.push({
        id: `Constants.${name}.${row[0]}`,
        className: 'Constants',
        name: row[0],
        enum: name,
        kind: 'constant',
        since: row[1] || since,
        description: row[2] ?? '',
        parameters: [],
        returns: `Constants.${name}`,
        source: `https://developer.adobe.com/premiere-pro/uxp/ppro-reference/constants/#${name.toLowerCase()}`,
      });
  }
  return constants;
}
export async function generateReference(cache = 'build/adobe-reference') {
  const provenance = JSON.parse(await readFile(join(cache, 'provenance.json'), 'utf8'));
  const signatures = sdkSignatures(
    await readFile('node_modules/@adobe/premierepro/src/premierepro.d.ts', 'utf8'),
  );
  const root = join(cache, 'pages/src/pages/ppro-reference');
  const classes = [];
  for (const section of ['classes', 'events']) {
    for (const file of (await readdir(join(root, section)))
      .filter((n) => n.endsWith('.md') && n !== 'index.md')
      .sort())
      classes.push(
        parseClass(
          await readFile(join(root, section, file), 'utf8'),
          `${section}/${file}`,
          signatures,
        ),
      );
  }
  const constants = parseConstants(await readFile(join(root, 'constants/index.md'), 'utf8'));
  const overrides = {
    'Transcript.transcribeClipProjectItem': '26.5',
    'Transcript.isLanguagePackAvailable': '26.5',
    'Media#getDuration': '26.5',
    'Media#getStart': '26.5',
    'Marker@guid': '26.3',
    'Sequence#setSelection': '26.3',
    'Project#createSequenceWithPresetPath': '26.3',
    'AudioTrack#createSetNameAction': '26.3',
    'VideoTrack#createSetNameAction': '26.3',
    'CaptionTrack#createSetNameAction': '26.3',
    'ClipProjectItem#createSubClipAction': '26.3',
    'EncoderManager#launchEncoder': '26.3',
    'EncoderManager#setEmbeddedXMPEnabled': '26.3',
    'EncoderManager#setSidecarXMPEnabled': '26.3',
    'EncoderManager#startBatchEncode': '26.3',
    'ProjectConverter.exportAAF': '26.3',
    'SourceMonitor.setPosition': '26.3',
    'Transcript.querySupportedLanguages': '26.3',
    'Transcript.hasTranscript': '26.3',
  };
  for (const cls of classes)
    for (const m of cls.members) {
      const v =
        overrides[m.id] ??
        (['MediaManager', 'WorkAreaUtils', 'C2PAService'].includes(cls.name)
          ? '26.5'
          : cls.name === 'ObjectMaskUtils'
            ? '26.3'
            : undefined);
      if (v && v.localeCompare(m.since, undefined, { numeric: true }) > 0) {
        m.documentedSince = m.since;
        m.since = v;
        m.compatibilityNote =
          'Minimum corrected against the official Adobe UXP changelog; the reference page has an older Since label.';
      }
      m.result = typeSchema(m.returns);
      for (const p of m.parameters) {
        if (p.name.endsWith('?')) {
          p.name = p.name.slice(0, -1);
          p.optional = true;
        }
        p.schema = typeSchema(p.type);
      }
    }
  const sdkVersion = JSON.parse(
    await readFile('node_modules/@adobe/premierepro/package.json', 'utf8'),
  ).version;
  const catalog = {
    schemaVersion: 1,
    provenance: { ...provenance, license: 'Apache-2.0', sdkVersion },
    classes,
    constants,
  };
  await mkdir('data', { recursive: true });
  await writeFile('data/adobe-api.json', JSON.stringify(catalog, null, 2) + '\n');
  await copyFile(join(cache, 'LICENSE'), 'data/ADOBE-LICENSE.txt');
  await copyFile(join(cache, 'COPYRIGHT'), 'data/ADOBE-COPYRIGHT.txt');
  const contracts = classes.map((c) => ({
    ...c,
    members: c.members.map(({ description, source, ...m }) => m),
  }));
  await mkdir('src/generated', { recursive: true });
  await writeFile(
    'src/generated/api-contracts.ts',
    '// Generated from the official Adobe documentation. Run npm run docs:sync.\n// Adobe Apache-2.0 notices: data/ADOBE-LICENSE.txt and data/ADOBE-COPYRIGHT.txt.\nimport type { ApiCatalog } from "../api-types";\nexport const API_CONTRACTS = ' +
      JSON.stringify({
        schemaVersion: 1,
        provenance: catalog.provenance,
        classes: contracts,
        constants: constants.map(({ description, source, ...m }) => m),
      }) +
      ' as unknown as ApiCatalog;\n',
  );
  console.log(
    JSON.stringify({
      classes: classes.length,
      members: classes.reduce((n, c) => n + c.members.length, 0),
      constants: constants.length,
      commit: provenance.commit,
    }),
  );
  return catalog;
}
