/*
 * Copyright 2026 Collate
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 * http://www.apache.org/licenses/LICENSE-2.0
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
'use strict';
// This inventory finds candidates for review; it cannot prove runtime stability,
// action causality, fixture independence, or server performance.
const fs = require('node:fs');
const path = require('node:path');
const cp = require('node:child_process');
const repository = path.resolve(__dirname, '../..');
process.chdir(repository);
const root = path.join(repository, 'openmetadata-ui/src/main/resources/ui');
const outputArg = process.argv.indexOf('--output');
const destination = path.resolve(
  outputArg < 0
    ? '.context/playwright-design-audit'
    : process.argv[outputArg + 1]
);
fs.mkdirSync(destination, { recursive: true });
const { createHash } = require('node:crypto');
const ts = require(path.join(root, 'node_modules/typescript'));
const files = [
  ...new Set(
    cp
      .execFileSync(
        'git',
        [
          'ls-files',
          '--cached',
          '--others',
          '--exclude-standard',
          '--',
          `${root}/playwright`,
          `${root}/playwright.config.ts`,
          `${root}/playwright.sso.config.ts`,
        ],
        { encoding: 'utf8' }
      )
      .trim()
      .split('\n')
      .filter((f) => /\.tsx?$/.test(f))
  ),
].sort();
const output = [];
const details = [];
const actionNames = new Set([
  'click',
  'dblclick',
  'fill',
  'press',
  'selectOption',
  'check',
  'uncheck',
  'dragTo',
  'goto',
  'reload',
  'goBack',
  'goForward',
  'post',
  'put',
  'patch',
  'delete',
]);
const nameOf = (n) =>
  ts.isPropertyAccessExpression(n)
    ? n.name.text
    : ts.isIdentifier(n)
    ? n.text
    : '';
const walk = (n, fn) => {
  fn(n);
  ts.forEachChild(n, (c) => walk(c, fn));
};
const enclosingFunction = (node) => {
  for (let p = node.parent; p; p = p.parent) if (ts.isFunctionLike(p)) return p;
  return node.getSourceFile();
};
for (const file of files) {
  const text = fs.readFileSync(file, 'utf8');
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true);
  const relative = path.relative(root, file);
  const findings = [];
  const calls = [];
  const tests = [];
  const imports = [];
  const add = (node, kind, detail = node.getText(source)) => {
    const pos = source.getLineAndCharacterOfPosition(node.getStart(source));
    const item = { file: relative, line: pos.line + 1, kind, detail };
    findings.push(item);
    details.push(item);
  };
  walk(source, (node) => {
    if (
      ts.isImportDeclaration(node) &&
      ts.isStringLiteral(node.moduleSpecifier)
    )
      imports.push(node.moduleSpecifier.text);
    if (ts.isCallExpression(node)) {
      const name = nameOf(node.expression);
      const expr = node.expression.getText(source);
      calls.push({
        name,
        expr,
        line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      });
      if (
        /^(test|it)(\.(skip|fixme|only))?$/.test(expr) &&
        node.arguments.some(
          (arg) => ts.isArrowFunction(arg) || ts.isFunctionExpression(arg)
        )
      )
        tests.push({
          line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1,
          title: node.arguments[0].getText(source),
        });
      if (name === 'toPass') add(node, 'assertion-block-poll');
      if ((name === 'poll' && expr.startsWith('expect')) || name === 'toPass') {
        const callback =
          name === 'poll'
            ? node.arguments[0]
            : node.expression.expression.arguments?.[0];
        if (callback)
          walk(callback, (candidate) => {
            if (
              ts.isCallExpression(candidate) &&
              actionNames.has(nameOf(candidate.expression))
            ) {
              add(candidate, 'action-inside-poll-candidate');
            }
          });
      }
      if (name === 'poll' && expr.startsWith('expect'))
        add(node, 'poll-callback');
      if (
        [
          'waitForTimeout',
          'waitForSelector',
          'boundingBox',
          'elementHandle',
          'elementHandles',
          'isVisible',
          'isHidden',
          'all',
          'count',
          'reload',
          'route',
          'newContext',
          'newPage',
        ].includes(name)
      )
        add(node, name);
      if (name === 'waitForResponse' || name === 'waitForResponseWithStatus') {
        add(node, 'response-wait');
        if (
          name === 'waitForResponse' &&
          /\.(?:status|ok)\(\)/.test(node.arguments[0]?.getText(source) ?? '')
        )
          add(node, 'status-filtered-response');
        let statement = node;
        while (
          statement.parent &&
          !ts.isBlock(statement.parent) &&
          !ts.isSourceFile(statement.parent)
        )
          statement = statement.parent;
        const siblings = statement.parent?.statements;
        const index = siblings?.indexOf(statement) ?? -1;
        if (index > 0) {
          const previous = siblings[index - 1];
          let precedingAction = false;
          walk(previous, (n) => {
            if (ts.isCallExpression(n) && actionNames.has(nameOf(n.expression)))
              precedingAction = true;
          });
          if (precedingAction)
            add(
              node,
              'listener-after-action-candidate',
              previous.getText(source) + '\n' + statement.getText(source)
            );
        }
      }
      if (name === 'catch') add(node, 'caught-promise');
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'force' &&
      node.initializer.kind === ts.SyntaxKind.TrueKeyword
    )
      add(node, 'forced-action');
    if (ts.isCatchClause(node)) add(node, 'catch-block');
    if (ts.isExpressionStatement(node)) {
      const call = ts.isAwaitExpression(node.expression)
        ? node.expression.expression
        : node.expression;
      if (
        ts.isCallExpression(call) &&
        [
          'isVisible',
          'isHidden',
          'isEnabled',
          'isDisabled',
          'isChecked',
          'isEditable',
        ].includes(nameOf(call.expression))
      )
        add(node, 'discarded-state-query');
    }
    if (
      (ts.isForStatement(node) ||
        ts.isWhileStatement(node) ||
        ts.isDoStatement(node)) &&
      /retry|attempt|catch|\bclick\(/i.test(node.getText(source))
    )
      add(node, 'loop-recovery-candidate');
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer &&
      ts.isCallExpression(node.initializer) &&
      ['waitForResponse', 'waitForResponseWithStatus'].includes(
        nameOf(node.initializer.expression)
      )
    ) {
      const scope = enclosingFunction(node);
      const name = node.name.text;
      const awaits = [];
      walk(scope, (n) => {
        if (
          ts.isAwaitExpression(n) &&
          ts.isIdentifier(n.expression) &&
          n.expression.text === name &&
          enclosingFunction(n) === scope
        )
          awaits.push(n);
      });
      if (awaits.length > 1)
        add(
          node,
          'reused-response-promise',
          JSON.stringify({
            variable: name,
            lines: awaits.map(
              (n) => source.getLineAndCharacterOfPosition(n.getStart()).line + 1
            ),
          })
        );
    }
  });
  output.push({
    file: relative,
    sha256: createHash('sha256').update(text).digest('hex'),
    lines: text.split('\n').length,
    declarations: tests,
    imports,
    calls,
    findings: findings.map(({ kind, line }) => ({ kind, line })),
  });
}

const counts = details.reduce((all, item) => {
  all[item.kind] = (all[item.kind] || 0) + 1;
  return all;
}, {});
const summary = {
  head: cp
    .execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' })
    .trim(),
  source: 'working tree (per-file SHA-256 recorded)',
  files: output.length,
  e2eSpecs: output.filter(
    (file) =>
      file.file.startsWith('playwright/e2e/') && file.file.endsWith('.spec.ts')
  ).length,
  browserHelperSpecs: output.filter(
    (file) =>
      file.file.startsWith('playwright/browser-tests/') &&
      file.file.endsWith('.spec.ts')
  ).length,
  testDeclarations: output.reduce(
    (total, file) => total + file.declarations.length,
    0
  ),
  counts,
  limitation:
    'Static pattern inventory, not a count of flaky tests or proof that every scenario is stable. Inspect candidates and validate behavior under CI concurrency.',
};
fs.writeFileSync(
  path.join(destination, 'summary.json'),
  JSON.stringify(summary, null, 2) + '\n'
);
fs.writeFileSync(
  path.join(destination, 'sources.json'),
  JSON.stringify(output, null, 2) + '\n'
);
fs.writeFileSync(
  path.join(destination, 'findings.json'),
  JSON.stringify(details, null, 2) + '\n'
);
const csv = (value) => '"' + String(value).replaceAll('"', '""') + '"';
const rows = [
  [
    'File',
    'SHA256',
    'Lines',
    'Static test declarations',
    'Pattern counts',
    'Review status',
  ],
  ...output.map((file) => [
    file.file,
    file.sha256,
    file.lines,
    file.declarations.length,
    Object.entries(
      file.findings.reduce((all, finding) => {
        all[finding.kind] = (all[finding.kind] || 0) + 1;
        return all;
      }, {})
    )
      .map(([kind, count]) => kind + ': ' + count)
      .join('; '),
    file.findings.length
      ? 'Static scan complete; matched patterns require contextual review'
      : 'Static scan complete; no matched patterns (runtime unverified)',
  ]),
];
fs.writeFileSync(
  path.join(destination, 'file-matrix.csv'),
  rows.map((row) => row.map(csv).join(',')).join('\n') + '\n'
);
const testRows = [
  ['File', 'Line', 'Title expression (parameterized cases expand at runtime)'],
  ...output.flatMap((file) =>
    file.declarations.map((test) => [file.file, test.line, test.title])
  ),
];
fs.writeFileSync(
  path.join(destination, 'tests.csv'),
  testRows.map((row) => row.map(csv).join(',')).join('\n') + '\n'
);
console.log(JSON.stringify(summary, null, 2));
