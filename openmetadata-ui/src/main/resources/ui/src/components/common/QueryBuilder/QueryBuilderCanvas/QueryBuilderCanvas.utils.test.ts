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
  toGroupFieldNodes,
} from './QueryBuilderCanvas.utils';

const FIELDS = {
  name: { label: 'Name' },
  tags: {
    label: 'Tags',
    subfields: {
      tagFQN: { label: 'Tag' },
      nested: { label: 'Nested', subfields: { leaf: { label: 'Leaf' } } },
    },
  },
};

describe('toFieldNodes', () => {
  it('should address every field by the dotted path RAQB uses', () => {
    const [name, tags] = toFieldNodes(FIELDS);

    expect(name).toEqual({ key: 'name', label: 'Name', path: 'name' });
    expect(tags.path).toBe('tags');
    expect(tags.items?.map((item) => item.path)).toEqual([
      'tags.tagFQN',
      'tags.nested',
    ]);
    expect(tags.items?.[1].items?.[0].path).toBe('tags.nested.leaf');
  });

  it('should fall back to the key when a field carries no label', () => {
    expect(toFieldNodes({ owners: {} })).toEqual([
      { key: 'owners', label: 'owners', path: 'owners' },
    ]);
  });

  it('should tolerate a missing field map', () => {
    expect(toFieldNodes(undefined)).toEqual([]);
  });
});

describe('toGroupFieldNodes', () => {
  it('should offer the top level whether or not a field owns subfields', () => {
    // A semantic rule is as often built on a plain field (Description) as on
    // one with subfields (Owners); RAQB switches the node type to match.
    expect(toGroupFieldNodes(FIELDS).map((item) => item.path)).toEqual(
      Object.keys(FIELDS)
    );
  });

  it('should offer a plain field with no subfields', () => {
    expect(toGroupFieldNodes({ name: { label: 'Name' } })).toEqual([
      { key: 'name', label: 'Name', path: 'name' },
    ]);
  });

  it('should not offer subfields, which belong to the rules inside', () => {
    expect(
      toGroupFieldNodes({
        tags: { label: 'Tags', subfields: { tagFQN: {} } },
      }).map((item) => item.path)
    ).toEqual(['tags']);
  });

  it('should fall back to the key when a groupable field carries no label', () => {
    expect(toGroupFieldNodes({ tags: { subfields: { tagFQN: {} } } })).toEqual([
      { key: 'tags', label: 'tags', path: 'tags' },
    ]);
  });

  it('should tolerate a missing field map', () => {
    expect(toGroupFieldNodes(undefined)).toEqual([]);
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
