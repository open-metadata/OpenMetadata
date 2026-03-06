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
import { ResourceEntity } from '../../src/context/PermissionProvider/PermissionProvider.interface';
import {
  Effect,
  Operation,
} from '../../src/generated/entity/policies/accessControl/rule';
import { uuid } from '../utils/common';

type PolicyRule = {
  name: string;
  resources: string[];
  operations: string[];
  effect: string;
};

export const CREATE_TEST_CASE_POLICY: PolicyRule[] = [
  {
    name: `create-test-case-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.Create, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-table-policy-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
      Operation.CreateTests,
      Operation.EditTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `view-all-policy-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic, Operation.ViewAll],
    effect: Effect.Allow,
  },
];

export const VIEW_INCIDENTS_POLICY: PolicyRule[] = [
  {
    name: `view-incidents-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-incidents-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewAll, Operation.ViewTests, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-incidents-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const EDIT_INCIDENTS_POLICY: PolicyRule[] = [
  {
    name: `edit-incidents-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [
      Operation.EditTests,
      Operation.EditAll,
      Operation.ViewAll,
      Operation.ViewBasic,
    ],
    effect: Effect.Allow,
  },
  {
    name: `edit-incidents-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.EditTests,
      Operation.EditAll,
      Operation.ViewAll,
      Operation.ViewTests,
      Operation.ViewBasic,
    ],
    effect: Effect.Allow,
  },
  {
    name: `edit-incidents-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TABLE_VIEW_INCIDENTS_POLICY: PolicyRule[] = [
  {
    name: `table-view-incidents-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewTests, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `table-view-incidents-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `table-view-incidents-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TABLE_EDIT_INCIDENTS_POLICY: PolicyRule[] = [
  {
    name: `table-edit-incidents-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.EditTests,
      Operation.ViewAll,
      Operation.ViewTests,
      Operation.ViewBasic,
    ],
    effect: Effect.Allow,
  },
  {
    name: `table-edit-incidents-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [
      Operation.EditTests,
      Operation.EditAll,
      Operation.ViewAll,
      Operation.ViewBasic,
    ],
    effect: Effect.Allow,
  },
  {
    name: `table-edit-incidents-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const CONSUMER_LIKE_POLICY: PolicyRule[] = [
  {
    name: `consumer-like-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `consumer-like-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewAll, Operation.ViewTests, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `consumer-like-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const DELETE_TEST_CASE_POLICY: PolicyRule[] = [
  {
    name: `delete-test-case-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.Delete, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-table-policy-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewAll, Operation.ViewBasic, Operation.ViewTests],
    effect: Effect.Allow,
  },
];

export const TEST_SUITE_POLICY: PolicyRule[] = [
  {
    name: `test-suite-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_SUITE],
    operations: [
      Operation.Create,
      Operation.Delete,
      Operation.EditAll,
      Operation.ViewAll,
    ],
    effect: Effect.Allow,
  },
  {
    name: `test-suite-view-basic-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TEST_CASE_VIEW_BASIC_POLICY: PolicyRule[] = [
  {
    name: `test-case-view-basic-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `table-view-test-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewTests, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `all-view-basic-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewAll],
    effect: Effect.Allow,
  },
];

export const TABLE_CREATE_TESTS_POLICY: PolicyRule[] = [
  {
    name: `table-create-tests-policy-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.CreateTests,
      Operation.EditTests,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `view-all-basic-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic, Operation.ViewAll],
    effect: Effect.Allow,
  },
];

export const EDIT_TEST_CASE_POLICY: PolicyRule[] = [
  {
    name: `edit-test-case-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.EditAll, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `edit-view-table-policy-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
      Operation.EditTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `edit-view-all-policy-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TABLE_EDIT_TESTS_POLICY: PolicyRule[] = [
  {
    name: `table-edit-tests-policy-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.EditTests,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `table-edit-view-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const EDIT_TESTS_ON_TEST_CASE_POLICY: PolicyRule[] = [
  {
    name: `edit-tests-tc-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.EditTests, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `edit-tests-tc-view-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewAll, Operation.ViewBasic, Operation.ViewTests],
    effect: Effect.Allow,
  },
  {
    name: `edit-tests-tc-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const VIEW_ALL_TEST_CASE_POLICY: PolicyRule[] = [
  {
    name: `view-all-tc-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-all-tc-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewTests, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-all-tc-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TEST_SUITE_EDIT_ONLY_POLICY: PolicyRule[] = [
  {
    name: `suite-edit-only-policy-${uuid()}`,
    resources: [ResourceEntity.TEST_SUITE],
    operations: [Operation.EditAll, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `suite-edit-view-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const VIEW_RESULTS_POLICY: PolicyRule[] = [
  {
    name: `view-results-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-results-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewTests, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `view-results-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const EDIT_RESULTS_POLICY: PolicyRule[] = [
  {
    name: `edit-results-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.EditAll, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `edit-results-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.EditTests,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `edit-results-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const TABLE_EDIT_RESULTS_POLICY: PolicyRule[] = [
  {
    name: `table-edit-results-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.EditTests,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `table-edit-results-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const DELETE_RESULTS_POLICY: PolicyRule[] = [
  {
    name: `delete-results-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.Delete, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `delete-results-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.Delete,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `delete-results-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const PARTIAL_DELETE_TC_ONLY_POLICY: PolicyRule[] = [
  {
    name: `partial-del-tc-${uuid()}`,
    resources: [ResourceEntity.TEST_CASE],
    operations: [Operation.Delete, Operation.ViewAll, Operation.ViewBasic],
    effect: Effect.Allow,
  },
  {
    name: `partial-del-tc-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [Operation.ViewAll, Operation.ViewBasic, Operation.ViewTests],
    effect: Effect.Allow,
  },
  {
    name: `partial-del-tc-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];

export const PARTIAL_DELETE_TABLE_ONLY_POLICY: PolicyRule[] = [
  {
    name: `partial-del-table-${uuid()}`,
    resources: [ResourceEntity.TABLE],
    operations: [
      Operation.Delete,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewTests,
    ],
    effect: Effect.Allow,
  },
  {
    name: `partial-del-table-all-${uuid()}`,
    resources: [ResourceEntity.ALL],
    operations: [Operation.ViewBasic],
    effect: Effect.Allow,
  },
];
