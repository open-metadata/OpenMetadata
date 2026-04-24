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

import { Operation } from '../generated/api/policies/createPolicy';

const isViewOperation = (operation: Operation) => operation.startsWith('View');

const isEditOperation = (operation: Operation) => operation.startsWith('Edit');

/**
 * Matches server-side PolicyRepository.filterRedundantOperations so the policy
 * rule editor stays consistent with stored policy rules.
 */
export const filterRedundantPolicyOperations = (
  operations: Operation[]
): Operation[] => {
  let result = [...operations];
  if (result.includes(Operation.ViewAll)) {
    result = result.filter(
      (o) => o === Operation.ViewAll || !isViewOperation(o)
    );
  }
  if (result.includes(Operation.EditAll)) {
    result = result.filter(
      (o) => o === Operation.EditAll || !isEditOperation(o)
    );
  }
  return result;
};
