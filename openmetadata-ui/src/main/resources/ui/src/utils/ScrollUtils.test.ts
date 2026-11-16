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
import { isNearScrollBottom } from './ScrollUtils';

describe('isNearScrollBottom', () => {
  it('is true at an exact integer bottom', () => {
    expect(
      isNearScrollBottom({
        scrollHeight: 1500,
        scrollTop: 1000,
        clientHeight: 500,
      })
    ).toBe(true);
  });

  it('is true with a fractional scrollTop (Windows display scaling)', () => {
    // scrollHeight - scrollTop - clientHeight = 0.4, which the old `=== 500`
    // check missed, stalling infinite scroll on scaled displays.
    expect(
      isNearScrollBottom({
        scrollHeight: 1500,
        scrollTop: 999.6,
        clientHeight: 500,
      })
    ).toBe(true);
  });

  it('is false when not near the bottom', () => {
    expect(
      isNearScrollBottom({
        scrollHeight: 1500,
        scrollTop: 200,
        clientHeight: 500,
      })
    ).toBe(false);
  });
});
