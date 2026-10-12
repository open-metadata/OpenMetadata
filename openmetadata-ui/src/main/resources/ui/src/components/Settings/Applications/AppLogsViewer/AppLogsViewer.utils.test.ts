/*
 *  Copyright 2023 Collate.
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

import { formatRecordCount } from './AppLogsViewer.utils';

describe('formatRecordCount', () => {
  it('preserves unavailable and zero counts', () => {
    expect(formatRecordCount(undefined)).toBeUndefined();
    expect(formatRecordCount(0)).toBe(0);
  });

  it('caps counts only above the specified overflow limit', () => {
    expect(formatRecordCount(99999999)).toBe(99999999);
    expect(formatRecordCount(100000000)).toBe('99999999+');
    expect(formatRecordCount(100, 99)).toBe('99+');
  });
});
