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
import { formatEntityVersion } from './EntityVersionUtilsPure';

describe('formatEntityVersion', () => {
  it.each([
    [0.1, '0.1'],
    [1, '1.0'],
    ['0.30000000000000004', '0.3'],
    [undefined, '1.0'],
  ])('shows %p as %p', (version, expected) => {
    expect(formatEntityVersion(version)).toBe(expected);
  });
});
