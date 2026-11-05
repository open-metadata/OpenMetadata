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
      // Aliased import of the Operation enum: `import { Operation as Op }`
      // must be tracked and exempted the same as the plain identifier.
      {
        code: "import { Operation as Op } from '../generated/entity/policies/policy'; if (Op.EditAll) { run(); }",
      },
      // Destructuring directly off the Operation enum is exempt (rare, but
      // symmetric with the MemberExpression exemption).
      { code: 'const { EditAll } = Operation;' },
      // Computed/bracket access is a documented, intentional limitation —
      // it is the sanctioned dynamic-key pattern in the permission core.
      { code: 'const x = perms[Operation.EditAll];' },
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
      // Optional chaining still reaches the underlying MemberExpression.
      {
        code: 'if (tablePermissions?.EditAll) { run(); }',
        errors: [{ messageId: 'rawPermissionAccess' }],
      },
      // Destructuring off a non-Operation object is the same violation as
      // member access.
      {
        code: 'const { EditAll } = tablePermissions;',
        errors: [{ messageId: 'rawPermissionAccess' }],
      },
      {
        code: 'const { ViewAll, ViewBasic } = perms;',
        errors: [
          { messageId: 'rawPermissionAccess' },
          { messageId: 'rawPermissionAccess' },
        ],
      },
    ],
  });
});
