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
  isNamedEntityWithTagsDiff,
  isNestedNamedEntityWithTagsDiff,
  parseVersionDiffArray,
  parseVersionDiffObject,
} from './EntityDiffPureUtils';

describe('parseVersionDiffArray', () => {
  it('returns an empty array for malformed or non-array values', () => {
    expect(parseVersionDiffArray('{invalid')).toEqual([]);
    expect(parseVersionDiffArray('{}')).toEqual([]);
    expect(parseVersionDiffArray('[null]')).toEqual([]);
    expect(parseVersionDiffArray('[{}]', isNamedEntityWithTagsDiff)).toEqual(
      []
    );
  });

  it('keeps valid entries alongside invalid ones', () => {
    expect(
      parseVersionDiffArray(
        '[{"name":"a"},{"name":"b","tags":[null]}]',
        isNamedEntityWithTagsDiff
      )
    ).toEqual([{ name: 'a' }]);
  });
});

describe('isNestedNamedEntityWithTagsDiff', () => {
  it('validates children recursively and rejects malformed nesting', () => {
    expect(isNestedNamedEntityWithTagsDiff({ name: 'a' })).toBe(true);
    expect(
      isNestedNamedEntityWithTagsDiff({ name: 'a', children: [{ name: 'b' }] })
    ).toBe(true);
    expect(isNestedNamedEntityWithTagsDiff({ name: 'a', children: {} })).toBe(
      false
    );
    expect(
      isNestedNamedEntityWithTagsDiff({ name: 'a', children: [{ tags: [] }] })
    ).toBe(false);
  });
});

describe('parseVersionDiffObject', () => {
  it('returns an empty object for malformed or non-object values', () => {
    expect(parseVersionDiffObject('{invalid')).toEqual({});
    expect(parseVersionDiffObject('[]')).toEqual({});
    expect(parseVersionDiffObject('null')).toEqual({});
  });

  it('returns the parsed object when valid', () => {
    expect(parseVersionDiffObject('{"name":"alice"}')).toEqual({
      name: 'alice',
    });
  });
});
