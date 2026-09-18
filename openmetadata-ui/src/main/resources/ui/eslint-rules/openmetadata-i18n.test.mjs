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
import test, { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import plugin from './openmetadata-i18n.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2021, sourceType: 'module' },
});

const rule = plugin.rules['no-duplicate-string'];

test('exports the no-duplicate-string rule', () => {
  assert.equal(typeof rule.create, 'function');
});

ruleTester.run('no-duplicate-string', rule, {
  valid: [
    // i18n key passed to t() three times — ignored.
    {
      code: `t('label.display-name'); t('label.display-name'); t('label.display-name');`,
    },
    // string beginning with an i18n namespace, even outside t() — ignored.
    {
      code: `const a = 'server.entity-fetch-error';
             const b = 'server.entity-fetch-error';
             const c = 'server.entity-fetch-error';`,
    },
    // message namespace via a member-call t (e.g. i18n.t) — ignored.
    {
      code: `i18n.t('message.field-required'); i18n.t('message.field-required'); i18n.t('message.field-required');`,
    },
    // duplicated only twice — under threshold, not reported.
    {
      code: `const a = 'some-real-duplicated-class'; const b = 'some-real-duplicated-class';`,
    },
  ],
  invalid: [
    // a genuine non-i18n literal duplicated three times — still reported.
    {
      code: `const a = 'tw:border-teal-300';
             const b = 'tw:border-teal-300';
             const c = 'tw:border-teal-300';`,
      errors: 1,
    },
    // a non-i18n literal that merely contains a dot but is not an i18n namespace.
    {
      code: `const a = 'application/yaml'; const b = 'application/yaml'; const c = 'application/yaml';`,
      errors: 1,
    },
  ],
});
