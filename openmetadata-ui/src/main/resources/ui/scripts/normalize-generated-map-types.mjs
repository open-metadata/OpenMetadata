/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
import {
  readFileSync,
  readdirSync,
  realpathSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export function normalizeGeneratedMapTypes(source, ts) {
  const file = ts.createSourceFile(
    'generated.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  const permitsUndefined = (type) =>
    [
      ts.SyntaxKind.AnyKeyword,
      ts.SyntaxKind.UnknownKeyword,
      ts.SyntaxKind.UndefinedKeyword,
    ].includes(type.kind) ||
    (ts.isUnionTypeNode(type) && type.types.some(permitsUndefined));
  const replacements = [];

  for (const declaration of file.statements) {
    if (
      !ts.isInterfaceDeclaration(declaration) ||
      declaration.heritageClauses
    ) {
      continue;
    }
    const indexes = declaration.members.filter(ts.isIndexSignatureDeclaration);
    const properties = declaration.members.filter(
      (member) => !ts.isIndexSignatureDeclaration(member)
    );
    if (
      !properties.some((property) => property.questionToken) ||
      !indexes.some((index) => !permitsUndefined(index.type))
    ) {
      continue;
    }

    // An intersection keeps optional properties without allowing undefined map values.
    const alias = ts.factory.createTypeAliasDeclaration(
      declaration.modifiers,
      declaration.name,
      declaration.typeParameters,
      ts.factory.createIntersectionTypeNode([
        ts.factory.createTypeLiteralNode(properties),
        ts.factory.createTypeLiteralNode(indexes),
      ])
    );
    ts.setTextRange(alias, declaration);
    ts.setEmitFlags(alias, ts.EmitFlags.NoLeadingComments);
    replacements.push({
      start: declaration.getStart(file),
      end: declaration.end,
      text: printer.printNode(ts.EmitHint.Unspecified, alias, file),
    });
  }

  for (const { start, end, text } of replacements.reverse()) {
    source = source.slice(0, start) + text + source.slice(end);
  }

  return source;
}

function normalizePath(path, ts) {
  if (statSync(path).isDirectory()) {
    for (const entry of readdirSync(path)) {
      normalizePath(join(path, entry), ts);
    }
  } else if (path.endsWith('.ts')) {
    const source = readFileSync(path, 'utf8');
    const normalized = normalizeGeneratedMapTypes(source, ts);
    if (source !== normalized) {
      writeFileSync(path, normalized);
    }
  }
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [quicktype, ...paths] = process.argv.slice(2);
  if (!quicktype || paths.length === 0) {
    throw new Error(
      'Usage: normalize-generated-map-types.mjs <quicktype binary> <generated file or directory>...'
    );
  }
  const ts = createRequire(realpathSync(quicktype))('typescript');
  for (const path of paths) {
    normalizePath(path, ts);
  }
}
