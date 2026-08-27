/*
 *  Copyright 2025 Collate.
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
import { describe, it } from 'node:test';
import { RuleTester } from 'eslint';
import { rules } from './openmetadata-permissions.mjs';

// Repo convention (see openmetadata-performance.test.mjs:18-19): wire the
// RuleTester into node:test for per-case reporting.
RuleTester.describe = describe;
RuleTester.it = it;

const tester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

describe('no-raw-permission-access', () => {
  tester.run('no-raw-permission-access', rules['no-raw-permission-access'], {
    valid: [
      { code: 'can(Operation.EditAll);' },
      { code: 'const x = Operation.ViewBasic;' },
      { code: 'const { canEditTags } = useEntityPermissions(r, fqn);' },
    ],
    invalid: [
      {
        code: 'if (tablePermissions.EditAll) { run(); }',
        errors: [{ messageId: 'rawPermissionAccess' }],
      },
      {
        code: 'const ok = perms.ViewAll || perms.ViewBasic;',
        errors: [
          { messageId: 'rawPermissionAccess' },
          { messageId: 'rawPermissionAccess' },
        ],
      },
    ],
  });
});
