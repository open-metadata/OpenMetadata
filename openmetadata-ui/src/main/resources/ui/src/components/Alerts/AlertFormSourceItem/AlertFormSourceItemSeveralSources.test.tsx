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
import { getAlertSourceChanges } from '../../../pages/AddObservabilityPage/components/ObservabilityAlertForm.utils';

describe('Classic alert source transitions', () => {
  it('invalidates filters without resetting destinations when a source is added', () => {
    expect(getAlertSourceChanges(['table', 'topic'], ['table'])).toEqual({
      resources: ['table', 'topic'],
      input: {},
    });
  });

  it('resets destinations when any source is removed or replaced', () => {
    expect(getAlertSourceChanges(['topic'], ['table', 'topic'])).toEqual({
      resources: ['topic'],
      input: {},
      destinations: [],
    });
    expect(getAlertSourceChanges(['dashboard'], ['table'])).toEqual({
      resources: ['dashboard'],
      input: {},
      destinations: [],
    });
  });
});
