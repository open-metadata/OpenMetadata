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
import { QUERY_BUILDER_SURFACE } from '../../../../utils/queryBuilder/types';
import {
  countRules,
  getSurfaceForDepth,
  toFieldNodes,
} from './QueryBuilderCanvas.utils';

const FIELDS = {
  name: { label: 'Name' },
  // a `!group`: carries subfields but is selectable itself
  tags: {
    label: 'Tags',
    type: '!group',
    subfields: { tagFQN: { label: 'Tag' } },
  },
  // a `!struct`: only groups its subfields
  extension: {
    label: 'Custom Properties',
    type: '!struct',
    subfields: { size: { label: 'Size' } },
  },
};

describe('toFieldNodes', () => {
  it('should keep a `!group` selectable rather than folding it into its subfields', () => {
    // The regression this guards: `OMFieldSelect` renders only leaves, so a
    // field turned into a parent disappears from the picker — which is how
    // Tags, Tier and Glossary Term went missing.
    const [name, tags] = toFieldNodes(FIELDS);

    expect(name).toEqual({ key: 'name', label: 'Name', path: 'name' });
    expect(tags).toEqual({ key: 'tags', label: 'Tags', path: 'tags' });
    expect(tags.items).toBeUndefined();
  });

  it('should group a `!struct` around its subfields, as RAQB does', () => {
    const struct = toFieldNodes(FIELDS)[2];

    expect(struct.path).toBe('extension');
    expect(struct.items?.map((item) => item.path)).toEqual(['extension.size']);
  });

  it('should fall back to the key when a field carries no label', () => {
    expect(toFieldNodes({ raw: {} })).toEqual([
      { key: 'raw', label: 'raw', path: 'raw' },
    ]);
  });

  it('should tolerate a missing field map', () => {
    expect(toFieldNodes(undefined)).toEqual([]);
  });
});

describe('countRules', () => {
  it('should count leaves at any depth, not the groups holding them', () => {
    expect(
      countRules({
        children1: [{ id: 'a' }, { children1: [{ id: 'b' }, { id: 'c' }] }],
      })
    ).toBe(3);
  });

  it('should count a lone rule and an absent tree', () => {
    expect(countRules({ id: 'only' })).toBe(1);
    expect(countRules(undefined)).toBe(0);
  });
});

describe('getSurfaceForDepth', () => {
  it.each([
    [QUERY_BUILDER_SURFACE.SUBTLE, 0, QUERY_BUILDER_SURFACE.SUBTLE],
    [QUERY_BUILDER_SURFACE.SUBTLE, 1, QUERY_BUILDER_SURFACE.PLAIN],
    [QUERY_BUILDER_SURFACE.SUBTLE, 2, QUERY_BUILDER_SURFACE.SUBTLE],
    [QUERY_BUILDER_SURFACE.PLAIN, 0, QUERY_BUILDER_SURFACE.PLAIN],
    [QUERY_BUILDER_SURFACE.PLAIN, 1, QUERY_BUILDER_SURFACE.SUBTLE],
  ])(
    'should alternate %s at depth %i to %s so nesting stays readable',
    (base, depth, expected) => {
      expect(getSurfaceForDepth(base, depth)).toBe(expected);
    }
  );
});
