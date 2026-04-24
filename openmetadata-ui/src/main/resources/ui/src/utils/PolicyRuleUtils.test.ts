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
import { filterRedundantPolicyOperations } from './PolicyRuleUtils';

describe('PolicyRuleUtils', () => {
  it('keeps ViewBasic when it is the only view operation', () => {
    const result = filterRedundantPolicyOperations([Operation.ViewBasic]);
    expect(result).toEqual([Operation.ViewBasic]);
  });

  it('removes other view operations when ViewAll is present', () => {
    const result = filterRedundantPolicyOperations([
      Operation.Create,
      Operation.ViewAll,
      Operation.ViewBasic,
      Operation.ViewUsage,
    ]);
    expect(result).toEqual([Operation.Create, Operation.ViewAll]);
  });

  it('does not remove view operations when ViewAll is absent', () => {
    const result = filterRedundantPolicyOperations([
      Operation.Create,
      Operation.ViewBasic,
      Operation.ViewUsage,
    ]);
    expect(result).toEqual([
      Operation.Create,
      Operation.ViewBasic,
      Operation.ViewUsage,
    ]);
  });
});
