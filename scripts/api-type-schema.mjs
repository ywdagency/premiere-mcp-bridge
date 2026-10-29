import ts from 'typescript';
export function typeSchema(raw) {
  const type = raw
    .replace(/\\([{}<>|\[\]])/g, '$1')
    .replace(/\bor\b/g, '|')
    .replace(/\bArray\.< /g, 'Array<');
  const file = ts.createSourceFile('type.ts', `type T = ${type};`, ts.ScriptTarget.Latest, true);
  function parse(n) {
    if (!n) return { kind: 'unknown' };
    if (ts.isParenthesizedTypeNode(n)) return parse(n.type);
    if (ts.isArrayTypeNode(n)) return { kind: 'array', items: parse(n.elementType) };
    if (ts.isTupleTypeNode(n))
      return {
        kind: 'tuple',
        types: n.elements.map((e) => parse(ts.isNamedTupleMember(e) ? e.type : e)),
      };
    if (ts.isUnionTypeNode(n)) return { kind: 'union', types: n.types.map(parse) };
    if (ts.isLiteralTypeNode(n))
      return {
        kind: 'literal',
        value:
          n.literal.kind === ts.SyntaxKind.NullKeyword
            ? null
            : ts.isStringLiteral(n.literal)
              ? n.literal.text
              : ts.isNumericLiteral(n.literal)
                ? Number(n.literal.text)
                : n.literal.kind === ts.SyntaxKind.TrueKeyword,
      };
    if (ts.isTypeReferenceNode(n)) {
      const name = n.typeName.getText(file);
      if (['Promise', 'Array', 'ReadonlyArray'].includes(name))
        return name === 'Promise'
          ? parse(n.typeArguments?.[0])
          : { kind: 'array', items: parse(n.typeArguments?.[0]) };
      if (name === 'Record') return { kind: 'record', values: parse(n.typeArguments?.[1]) };
      return { kind: name.startsWith('Constants.') ? 'enum' : 'ref', name };
    }
    if (ts.isTypeLiteralNode(n)) {
      const fields = {};
      for (const m of n.members) {
        if (!m.name || !('type' in m)) continue;
        fields[m.name.getText(file).replace(/^['"]|['"]$/g, '')] = {
          schema: parse(m.type),
          optional: !!m.questionToken,
        };
      }
      return { kind: 'object', fields };
    }
    if (ts.isFunctionTypeNode(n) || ts.isConstructorTypeNode(n)) return { kind: 'callback' };
    return {
      kind:
        {
          [ts.SyntaxKind.StringKeyword]: 'string',
          [ts.SyntaxKind.NumberKeyword]: 'number',
          [ts.SyntaxKind.BooleanKeyword]: 'boolean',
          [ts.SyntaxKind.VoidKeyword]: 'void',
          [ts.SyntaxKind.UndefinedKeyword]: 'undefined',
          [ts.SyntaxKind.NullKeyword]: 'null',
          [ts.SyntaxKind.ObjectKeyword]: 'record',
          [ts.SyntaxKind.AnyKeyword]: 'unknown',
          [ts.SyntaxKind.UnknownKeyword]: 'unknown',
        }[n.kind] ?? 'unknown',
    };
  }
  return parse(file.statements.find(ts.isTypeAliasDeclaration)?.type);
}
