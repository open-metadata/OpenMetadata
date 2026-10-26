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
import {
  hashSubPathToView,
  isAccessControlViewAllowed,
  viewToSubPath,
} from './AccessControl.utils';

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

  it('edits a rule named like a route segment, and survives a malformed link', () => {
    const named = {
      type: 'policies-rule',
      fqn: 'OrgPolicy',
      name: 'OrgPolicy',
    };

    expect(hashSubPathToView('policies/OrgPolicy/rules/rules/edit')).toEqual({
      ...named,
      ruleName: 'rules',
    });
    expect(hashSubPathToView('policies/OrgPolicy/rules/add/edit')).toEqual({
      ...named,
      ruleName: 'add',
    });
    expect(hashSubPathToView('policies/OrgPolicy/rules/My%ZZ/edit')).toEqual({
      ...named,
      ruleName: 'My%ZZ',
    });
  });
});

describe('isAccessControlViewAllowed', () => {
  it('opens every view to an admin', () => {
    expect(isAccessControlViewAllowed('roles', true)).toBe(true);
    expect(isAccessControlViewAllowed('permission-debugger', true)).toBe(true);
  });

  it('keeps a non-admin audit-log reader to the landing and Audit Logs', () => {
    expect(isAccessControlViewAllowed('landing', false)).toBe(true);
    expect(isAccessControlViewAllowed('audit-logs', false)).toBe(true);
    expect(isAccessControlViewAllowed('roles', false)).toBe(false);
    expect(isAccessControlViewAllowed('policies', false)).toBe(false);
    expect(isAccessControlViewAllowed('permission-debugger', false)).toBe(
      false
    );
  });
});
