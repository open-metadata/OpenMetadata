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
import { hashSubPathToView, viewToSubPath } from './AccessControl.utils';

describe('access control rule routes', () => {
  it.each([
    [
      'policies/OrgPolicy/rules/add',
      { type: 'policies-rule', fqn: 'OrgPolicy', name: 'OrgPolicy' },
    ],
    [
      'policies/OrgPolicy/rules/Allow%20View/edit',
      {
        type: 'policies-rule',
        fqn: 'OrgPolicy',
        name: 'OrgPolicy',
        ruleName: 'Allow View',
      },
    ],
  ])('parses %s and builds it back', (subPath, view) => {
    expect(hashSubPathToView(subPath)).toEqual(view);
    expect(viewToSubPath(hashSubPathToView(subPath))).toBe(subPath);
  });

  it('keeps a plain policy FQN as the policy detail', () => {
    expect(hashSubPathToView('policies/OrgPolicy')).toEqual({
      type: 'policies-detail',
      fqn: 'OrgPolicy',
      name: 'OrgPolicy',
    });
    expect(hashSubPathToView('policies/add')).toEqual({ type: 'policies-add' });
  });
});
