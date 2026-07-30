/*
 *  Copyright 2025 Collate.
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
import { FilterCondition } from './FiltersConfigForm.types';
import { conditionToRegex, parseRegexPattern } from './FiltersConfigForm.utils';

// The ingestion side evaluates these patterns with Python's start-anchored
// re.match (metadata/utils/filters.py), so every emitted regex must encode its
// operator explicitly: a bare pattern behaves as startsWith, and `value$`
// behaves as an exact match, never as endsWith.
describe('conditionToRegex', () => {
  const condition = (
    op: FilterCondition['op'],
    value: string
  ): FilterCondition => ({ op, value });

  it('anchors "is" on both ends', () => {
    expect(conditionToRegex(condition('is', 'Wine'))).toBe('^Wine$');
  });

  it('anchors "startsWith" at the start', () => {
    expect(conditionToRegex(condition('startsWith', 'Wine'))).toBe('^Wine');
  });

  it('wraps "contains" so re.match cannot read it as a prefix', () => {
    expect(conditionToRegex(condition('contains', 'Wine'))).toBe('.*Wine.*');
  });

  it('prefixes "endsWith" so re.match cannot read it as an exact match', () => {
    expect(conditionToRegex(condition('endsWith', 'Wine'))).toBe('.*Wine$');
  });

  it('escapes regex specials in the value', () => {
    expect(conditionToRegex(condition('contains', 'my.model'))).toBe(
      String.raw`.*my\.model.*`
    );
  });

  it('passes "regex" values through untouched', () => {
    expect(conditionToRegex(condition('regex', '.*Wine.*'))).toBe('.*Wine.*');
  });

  it('re-emits a parsed pattern verbatim via sourceRegex', () => {
    expect(
      conditionToRegex({ op: 'contains', sourceRegex: 'Wine', value: 'Wine' })
    ).toBe('Wine');
  });
});

describe('parseRegexPattern', () => {
  it.each([
    ['^Wine$', 'is'],
    ['^Wine', 'startsWith'],
    ['^Wine.*', 'startsWith'],
    ['^Wine.*$', 'startsWith'],
    ['.*Wine.*', 'contains'],
    ['^.*Wine.*$', 'contains'],
    ['.*Wine$', 'endsWith'],
    ['^.*Wine$', 'endsWith'],
  ])('labels %s as %s', (regex, op) => {
    expect(parseRegexPattern(regex)).toMatchObject({
      op,
      sourceRegex: regex,
      value: 'Wine',
    });
  });

  it('labels a bare pattern as startsWith, matching re.match behavior', () => {
    expect(parseRegexPattern('Wine')).toMatchObject({
      op: 'startsWith',
      value: 'Wine',
    });
  });

  it('labels a bare pattern with trailing $ as is, matching re.match behavior', () => {
    expect(parseRegexPattern('Wine$')).toMatchObject({
      op: 'is',
      value: 'Wine',
    });
  });

  it('falls back to regex for patterns with unescaped syntax', () => {
    expect(parseRegexPattern('Wine|Beer')).toMatchObject({ op: 'regex' });
  });

  it('round-trips every operator through conditionToRegex', () => {
    const ops: FilterCondition['op'][] = [
      'is',
      'startsWith',
      'endsWith',
      'contains',
    ];
    for (const op of ops) {
      const emitted = conditionToRegex({ op, value: 'Wine' });

      expect(parseRegexPattern(emitted)).toMatchObject({
        op,
        value: 'Wine',
      });
    }
  });
});
