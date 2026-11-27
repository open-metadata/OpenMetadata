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
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { URL } from 'node:url';
import { ESLint } from 'eslint';

const eslint = new ESLint();
const duplicateLiteralJsx = `
  const iconNames = [
    'database-icon',
    'database-icon',
    'database-icon',
  ];
  const Component = () => (
    <>
      <span>database-icon</span>
      <span>database-icon</span>
      <span>database-icon</span>
    </>
  );
`;
const duplicateLiteralTypescript = `
  const iconNames = [
    'database-icon',
    'database-icon',
    'database-icon',
  ];
`;

test('suppresses string warnings in test TSX files', async () => {
  const [result] = await eslint.lintText(duplicateLiteralJsx, {
    filePath: 'src/Component.test.tsx',
  });
  const stringRuleMessages = result.messages.filter(({ ruleId }) =>
    [
      'i18next/no-literal-string',
      'sonarjs/no-duplicate-string',
      'openmetadata-i18n/no-duplicate-string',
    ].includes(ruleId)
  );

  assert.deepEqual(stringRuleMessages, []);
});

test('suppresses string warnings in test TS files', async () => {
  const filePath = 'src/Component.test.ts';
  const config = await eslint.calculateConfigForFile(filePath);
  const [result] = await eslint.lintText(duplicateLiteralTypescript, {
    filePath,
  });
  const stringRuleMessages = result.messages.filter(({ ruleId }) =>
    [
      'i18next/no-literal-string',
      'sonarjs/no-duplicate-string',
      'openmetadata-i18n/no-duplicate-string',
    ].includes(ruleId)
  );

  assert.equal(config.rules['i18next/no-literal-string']?.[0], 0);
  assert.equal(config.rules['openmetadata-i18n/no-duplicate-string']?.[0], 0);
  assert.deepEqual(stringRuleMessages, []);
});

test('keeps string warnings enabled in production TSX files', async () => {
  const [result] = await eslint.lintText(duplicateLiteralJsx, {
    filePath: 'src/Component.tsx',
  });
  const reportedRuleIds = new Set(result.messages.map(({ ruleId }) => ruleId));

  assert.equal(reportedRuleIds.has('i18next/no-literal-string'), true);
  assert.equal(
    reportedRuleIds.has('openmetadata-i18n/no-duplicate-string'),
    true
  );
});

for (const extension of ['ts', 'tsx', 'js', 'jsx']) {
  test(`applies unit-test policy only to .test.${extension} files`, async () => {
    const config = await eslint.calculateConfigForFile(
      `src/Example.test.${extension}`
    );

    assert.equal(config.rules['jest/no-focused-tests']?.[0], 2);
    assert.equal(config.rules['jest/valid-describe-callback']?.[0], 2);
    assert.equal(config.rules['jsx-a11y/control-has-associated-label']?.[0], 0);
    assert.equal(config.rules['sonarjs/cognitive-complexity']?.[0], 0);
    assert.equal(config.rules['@typescript-eslint/no-require-imports']?.[0], 0);
    assert.equal(config.rules['@typescript-eslint/no-explicit-any']?.[0], 2);
    assert.equal(config.rules['react-hooks/rules-of-hooks']?.[0], 2);
  });
}

test('keeps production JSX checks and excludes Jest rules from production', async () => {
  const config = await eslint.calculateConfigForFile('src/Example.tsx');

  assert.equal(config.rules['jsx-a11y/control-has-associated-label']?.[0], 2);
  assert.equal(config.rules['sonarjs/cognitive-complexity']?.[0], 2);
  assert.equal(config.rules['jest/no-focused-tests'], undefined);
});

test('rejects focused tests and asynchronous describe callbacks', async () => {
  const [result] = await eslint.lintText(
    "describe('suite', async () => { it.only('checks value', () => { expect(true).toBe(true); }); });",
    { filePath: 'src/Example.test.ts' }
  );
  const ruleIds = result.messages.map(({ ruleId }) => ruleId);

  assert.ok(ruleIds.includes('jest/no-focused-tests'));
  assert.ok(ruleIds.includes('jest/valid-describe-callback'));
});

test('accepts deliberately simplified mock JSX without disable directives', async () => {
  const [result] = await eslint.lintText(
    "it('renders mock', () => { const Mock = () => <div onClick={() => {}}>mock</div>; expect(Mock).toBeDefined(); });",
    { filePath: 'src/Example.test.tsx' }
  );

  assert.deepEqual(
    result.messages.filter(({ ruleId }) => ruleId?.startsWith('jsx-a11y/')),
    []
  );
});

test('does not apply unit-test assertion rules to Playwright or setup files', async () => {
  for (const filePath of [
    'playwright/e2e/example.spec.ts',
    'src/setupTests.js',
  ]) {
    const config = await eslint.calculateConfigForFile(filePath);

    assert.equal(config.rules['jest/no-focused-tests'], undefined);
    assert.equal(config.rules['jest/valid-expect'], undefined);
  }
});

test('reports stale disable directives as errors in unit tests', async () => {
  const [result] = await eslint.lintText(
    "// eslint-disable-next-line no-console\nit('checks value', () => { expect(true).toBe(true); });",
    { filePath: 'src/Example.test.ts' }
  );

  assert.ok(
    result.messages.some(
      ({ ruleId, severity, message }) =>
        ruleId === null &&
        severity === 2 &&
        message.includes('Unused eslint-disable')
    )
  );
});

test('keeps bulk suppressions aligned with enabled error rules', async () => {
  // The CLI rejects stale bulk entries even when lint reports no findings.
  const suppressions = JSON.parse(
    await readFile(
      new URL('../eslint-suppressions.json', import.meta.url),
      'utf8'
    )
  );

  for (const [filePath, rules] of Object.entries(suppressions)) {
    const config = await eslint.calculateConfigForFile(filePath);

    for (const ruleId of Object.keys(rules)) {
      assert.equal(
        config?.rules[ruleId]?.[0],
        2,
        `${filePath} retains a bulk suppression for inactive error rule ${ruleId}`
      );
    }
  }
});
