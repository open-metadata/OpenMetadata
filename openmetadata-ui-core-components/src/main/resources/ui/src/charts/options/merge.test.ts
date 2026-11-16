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

import { describe, expect, it } from 'vitest';
import { mergeOption } from './merge';

describe('mergeOption', () => {
  it('merges nested objects key by key', () => {
    expect(
      mergeOption({ grid: { top: 1, left: 2 } }, { grid: { top: 9 } })
    ).toEqual({ grid: { top: 9, left: 2 } });
  });

  it('replaces arrays instead of merging them', () => {
    expect(mergeOption({ data: [1, 2, 3] }, { data: [4] })).toEqual({
      data: [4],
    });
  });

  it('keeps the base value where the override is undefined', () => {
    expect(mergeOption({ a: 1, b: 2 }, { a: undefined, b: 3 })).toEqual({
      a: 1,
      b: 3,
    });
  });

  it('does not mutate its inputs', () => {
    const base = { grid: { top: 1 } };
    mergeOption(base, { grid: { top: 2 } });

    expect(base).toEqual({ grid: { top: 1 } });
  });

  it('returns the base when there is no override', () => {
    const base = { a: 1 };

    expect(mergeOption(base)).toBe(base);
  });
});
