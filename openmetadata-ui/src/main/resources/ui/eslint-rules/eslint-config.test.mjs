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
import test from 'node:test';
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
    ['i18next/no-literal-string', 'sonarjs/no-duplicate-string'].includes(
      ruleId
    )
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
    ['i18next/no-literal-string', 'sonarjs/no-duplicate-string'].includes(
      ruleId
    )
  );

  assert.equal(config.rules['i18next/no-literal-string']?.[0], 0);
  assert.equal(config.rules['sonarjs/no-duplicate-string']?.[0], 0);
  assert.deepEqual(stringRuleMessages, []);
});

test('keeps string warnings enabled in production TSX files', async () => {
  const [result] = await eslint.lintText(duplicateLiteralJsx, {
    filePath: 'src/Component.tsx',
  });
  const reportedRuleIds = new Set(result.messages.map(({ ruleId }) => ruleId));

  assert.equal(reportedRuleIds.has('i18next/no-literal-string'), true);
  assert.equal(reportedRuleIds.has('sonarjs/no-duplicate-string'), true);
});
