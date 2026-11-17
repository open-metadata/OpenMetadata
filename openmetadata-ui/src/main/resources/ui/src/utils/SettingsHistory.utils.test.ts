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
import { pushesSettingsView } from './SettingsHistory.utils';

describe('pushesSettingsView', () => {
  it('pushes a view the user opens from a list or detail', () => {
    expect(pushesSettingsView({ type: 'list' }, { type: 'detail' })).toBe(true);
    expect(pushesSettingsView({ type: 'detail' }, { type: 'list' })).toBe(true);
    expect(pushesSettingsView({ type: 'list' }, { type: 'policy-add' })).toBe(
      true
    );
  });

  it('replaces when a form returns, so Back never reopens the form', () => {
    expect(pushesSettingsView({ type: 'policy-add' }, { type: 'list' })).toBe(
      false
    );
    expect(pushesSettingsView({ type: 'rule' }, { type: 'detail' })).toBe(
      false
    );
    expect(
      pushesSettingsView(
        { type: 'section', subPath: 'alerts/edit/a' },
        { type: 'section', subPath: 'alerts' }
      )
    ).toBe(false);
  });

  it('pushes from one form to another', () => {
    expect(pushesSettingsView({ type: 'edit' }, { type: 'import' })).toBe(true);
  });

  it('does not treat a name that merely contains a form word as a form', () => {
    expect(pushesSettingsView({ type: 'address-book' }, { type: 'list' })).toBe(
      true
    );
  });
});
