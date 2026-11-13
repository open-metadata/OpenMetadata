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
import type {
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import {
  getJsonTreeFromQueryFilter,
  getJsonTreePropertyFromQueryFilter,
  getSelectEqualsNotEqualsProperties,
  isQueryFilterFullyRepresentable,
} from './QueryBuilderPureUtils';

type RuleProperties = {
  valueType: string[];
  asyncListValues?: { key: string; value: string; children: string }[];
};

const getRuleProperties = (
  value: unknown,
  operator: string
): RuleProperties => {
  const result = getSelectEqualsNotEqualsProperties(
    [],
    'field',
    value as string,
    operator
  );

  return (Object.values(result)[0] as { properties: RuleProperties })
    .properties;
};

describe('getSelectEqualsNotEqualsProperties valueType and asyncListValues branch', () => {
  it('uses the boolean value type for an equality op on a boolean value', () => {
    const properties = getRuleProperties(true, 'equal');

    expect(properties.valueType).toEqual(['boolean']);
    expect(properties.asyncListValues).toBeUndefined();
  });

  it('uses the text value type for an equality op on a non-boolean value', () => {
    const properties = getRuleProperties('abc', 'not_equal');

    expect(properties.valueType).toEqual(['text']);
    expect(properties.asyncListValues).toBeUndefined();
  });

  it('uses multiselect and maps array items for a membership op on an array value', () => {
    const properties = getRuleProperties(['a', 'b'], 'select_equals');

    expect(properties.valueType).toEqual(['multiselect']);
    expect(properties.asyncListValues).toEqual([
      { key: 'a', value: 'a', children: 'a' },
      { key: 'b', value: 'b', children: 'b' },
    ]);
  });

  it('uses select and a single async value for a membership op on a scalar value', () => {
    const properties = getRuleProperties('x', 'select_not_equals');

    expect(properties.valueType).toEqual(['select']);
    expect(properties.asyncListValues).toEqual([
      { key: 'x', value: 'x', children: 'x' },
    ]);
  });
});

// `Not in [a, b]` is written as one `must_not` clause per value, AND-ed. Reading
// it back as two separate `!=` rows changed nothing about the query, but the user
// lost the row they filled — and the old OR-ed shape has to keep loading, since
// saved filters and shared URLs still carry it.
describe('getJsonTreePropertyFromQueryFilter – multi-value negated select', () => {
  const FIELD = 'columns.tags.tagFQN';
  const mustNotTerm = (value: string) =>
    ({
      bool: { must_not: { term: { [FIELD]: value } } },
    } as QueryFieldInterface);

  const firstRule = (result: Record<string, unknown>) =>
    Object.values(result)[0] as {
      type: string;
      properties: { field: string; operator: string; value: unknown };
    };

  it('reads AND-ed negated terms on one field as a single Not in rule', () => {
    const rule = firstRule(
      getJsonTreePropertyFromQueryFilter(
        [],
        [{ bool: { must: [mustNotTerm('tag1'), mustNotTerm('tag2')] } }]
      )
    );

    expect(rule.type).toBe('rule');
    expect(rule.properties.field).toBe(FIELD);
    expect(rule.properties.operator).toBe('select_not_any_in');
    expect(rule.properties.value).toEqual([['tag1', 'tag2']]);
  });

  it('still reads the legacy OR-ed shape as a Not in rule', () => {
    const rule = firstRule(
      getJsonTreePropertyFromQueryFilter(
        [],
        [{ bool: { should: [mustNotTerm('tag1'), mustNotTerm('tag2')] } }]
      )
    );

    expect(rule.properties.operator).toBe('select_not_any_in');
    expect(rule.properties.value).toEqual([['tag1', 'tag2']]);
  });

  it('keeps negated terms on different fields as separate conditions', () => {
    const result = getJsonTreePropertyFromQueryFilter(
      [],
      [
        {
          bool: {
            must: [
              mustNotTerm('tag1'),
              {
                bool: {
                  must_not: { term: { 'owners.displayName.keyword': 'x' } },
                },
              } as QueryFieldInterface,
            ],
          },
        },
      ]
    );

    expect(Object.values(result)).toHaveLength(2);
    expect(
      Object.values(result).map(
        (entry) =>
          (entry as { properties: { operator: string } }).properties.operator
      )
    ).toEqual(['select_not_equals', 'select_not_equals']);
  });
});

// The API may write a wildcard in its shorthand form, which the query builder never does.
describe('getJsonTreePropertyFromQueryFilter – shorthand wildcard', () => {
  it('reloads it as a Contains rule', () => {
    const rule = Object.values(
      getJsonTreePropertyFromQueryFilter(
        [],
        [{ wildcard: { 'name.keyword': '*orders*' } } as QueryFieldInterface]
      )
    )[0] as { properties: { field: string; operator: string; value: unknown } };

    expect(rule.properties).toMatchObject({
      field: 'name.keyword',
      operator: 'like',
      value: ['orders'],
    });
  });
});

// The backend stores `queryFilter` as a free-form JSON object and embeds the
// DSL `query` node verbatim — it never requires `bool.must`. Rules created via
// the REST API (which never populates `filterJsonTree`) use `should`, `filter`,
// `must_not`, or bare `term` shapes, all of which the original parser silently
// discarded. These tests pin the reconstruction of every backend-supported
// shape so the editor shows the saved conditions instead of a blank builder.
describe('getJsonTreeFromQueryFilter – DSL shape coverage', () => {
  type Tree = {
    type?: string;
    properties?: { conjunction?: string; not?: boolean };
    children1?: Record<string, unknown>;
  };

  const rootGroup = (tree: unknown): Tree =>
    (tree as unknown as { id?: string })?.id
      ? (tree as Tree)
      : { type: 'empty' };

  const innerGroup = (tree: unknown): Tree | undefined => {
    const root = rootGroup(tree);
    const children = root.children1;
    if (!children) {
      return undefined;
    }
    const first = Object.values(children)[0] as Tree | undefined;

    return first;
  };

  const collectRules = (
    node: unknown
  ): Array<{
    field: string;
    operator: string;
    value: unknown[];
  }> => {
    if (!node || typeof node !== 'object') {
      return [];
    }
    const n = node as Tree;
    if (n.type === 'rule') {
      const props = (
        n as {
          properties?: { field?: string; operator?: string; value?: unknown[] };
        }
      ).properties;

      return [
        {
          field: props?.field ?? '',
          operator: props?.operator ?? '',
          value: props?.value ?? [],
        },
      ];
    }
    const children = n.children1;
    if (!children) {
      return [];
    }

    return Object.values(children).flatMap(collectRules);
  };

  it('reconstructs the UI-emitted double-nested bool.must shape', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        bool: {
          must: [
            {
              bool: {
                must: [{ term: { entityType: 'table' } }],
              },
            },
          ],
        },
      },
    } as unknown as QueryFilterInterface);

    expect(rootGroup(tree).type).toBe('group');

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('entityType');
  });

  it('reconstructs a top-level bool.should (root OR) shape', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        bool: {
          should: [{ term: { deleted: false } }, { term: { name: 'x' } }],
        },
      },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(2);
    expect(rules.map((r) => r.field)).toContain('deleted');
    expect(rules.map((r) => r.field)).toContain('name');
    // Root OR → inner group conjunction is OR.
    expect(innerGroup(tree)?.properties?.conjunction).toBe('OR');
  });

  it('reconstructs a top-level bool.filter shape', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        bool: {
          filter: [{ term: { deleted: false } }],
        },
      },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('deleted');
  });

  it('reconstructs a top-level bool.must_not shape with group negation', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        bool: {
          must_not: [{ term: { deleted: true } }],
        },
      },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('deleted');
    // must_not → inner group is negated.
    expect(innerGroup(tree)?.properties?.not).toBe(true);
  });

  it('reconstructs a bare query.term shape (no bool wrapper)', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        term: { fullyQualifiedName: 'dim_customer' },
      },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('fullyQualifiedName');
  });

  it('reconstructs a bare term without the query wrapper', () => {
    const tree = getJsonTreeFromQueryFilter({
      term: { 'tier.tagFQN': 'Tier.Tier1' },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('tier.tagFQN');
  });

  it('reconstructs a single must clause (not double-nested)', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: {
        bool: {
          must: [{ term: { name: 'x' } }],
        },
      },
    } as unknown as QueryFilterInterface);

    const rules = collectRules(tree);

    expect(rules).toHaveLength(1);
    expect(rules[0].field).toBe('name');
  });

  it('returns an empty tree for an empty must array', () => {
    const tree = getJsonTreeFromQueryFilter({
      query: { bool: { must: [] } },
    } as unknown as QueryFilterInterface);

    expect(Object.keys(tree)).toHaveLength(0);
  });

  it('returns an empty tree for an empty object', () => {
    const tree = getJsonTreeFromQueryFilter(
      {} as unknown as QueryFilterInterface
    );

    expect(Object.keys(tree)).toHaveLength(0);
  });

  it('returns an empty tree for undefined', () => {
    const tree = getJsonTreeFromQueryFilter(
      undefined as unknown as QueryFilterInterface
    );

    expect(Object.keys(tree)).toHaveLength(0);
  });
});

// The persona editor warns before an edit replaces a filter it cannot show in full (#37304).
describe('isQueryFilterFullyRepresentable', () => {
  const tier1 = { term: { 'tier.tagFQN': 'Tier.Tier1' } };
  const tier2 = { term: { 'tier.tagFQN': 'Tier.Tier2' } };
  const pii = { term: { 'tags.tagFQN': 'PII.Sensitive' } };

  it.each([
    [
      'UI root-AND shape',
      { query: { bool: { must: [{ bool: { must: [tier1, pii] } }] } } },
    ],
    ['bool.should', { query: { bool: { should: [tier1, tier2] } } }],
    [
      'bool.should with minimum_should_match 1',
      { query: { bool: { should: [tier1, tier2], minimum_should_match: 1 } } },
    ],
    ['bool.filter', { query: { bool: { filter: [tier1, pii] } } }],
    ['bool.must_not', { query: { bool: { must_not: [tier1, pii] } } }],
    ['bare query.term', { query: tier1 }],
    ['match_all', { query: { match_all: {} } }],
    [
      'a nested group of text rules the builder writes',
      {
        query: {
          bool: {
            must: [
              tier1,
              {
                bool: {
                  must: [
                    {
                      regexp: {
                        name: { value: '.*o.*', case_insensitive: true },
                      },
                    },
                    { match_phrase: { description: 'orders' } },
                    {
                      bool: {
                        must_not: { wildcard: { name: { value: '*o*' } } },
                      },
                    },
                  ],
                },
              },
            ],
          },
        },
      },
    ],
  ])('is true for %s', (_, filter) => {
    expect(
      isQueryFilterFullyRepresentable(filter as unknown as QueryFilterInterface)
    ).toBe(true);
  });

  it.each([
    [
      'should + filter',
      { query: { bool: { should: [tier1, tier2], filter: [pii] } } },
    ],
    [
      'must + must_not',
      { query: { bool: { must: [tier1], must_not: [pii] } } },
    ],
    [
      'minimum_should_match above one',
      {
        query: {
          bool: { should: [tier1, tier2, pii], minimum_should_match: 2 },
        },
      },
    ],
    [
      'an unsupported range clause',
      { query: { bool: { filter: [{ range: { updatedAt: { gte: 1 } } }] } } },
    ],
    [
      'a supported and an unsupported clause',
      {
        query: {
          bool: { filter: [tier1, { range: { updatedAt: { gte: 1 } } }] },
        },
      },
    ],
    [
      'siblings of the unwrapped inner must',
      { query: { bool: { must: [{ bool: { must: [tier1] } }, pii] } } },
    ],
    [
      'an unsupported bare clause',
      { query: { terms: { 'tier.tagFQN': ['Tier.Tier1'] } } },
    ],
    ['an empty query', { query: {} }],
    [
      'a case-sensitive regexp clause',
      {
        query: {
          bool: { filter: [{ regexp: { name: { value: 'Orders.*' } } }] },
        },
      },
    ],
    [
      'a regexp clause with flags',
      {
        query: {
          bool: {
            filter: [
              {
                regexp: {
                  name: {
                    value: 'Orders.*',
                    case_insensitive: true,
                    flags: 'ALL',
                  },
                },
              },
            ],
          },
        },
      },
    ],
    [
      'a nested group with a clause the builder does not read',
      {
        query: {
          bool: {
            must: [
              tier1,
              {
                bool: {
                  must: [pii, { wildcard: { name: { value: 'orders*' } } }],
                },
              },
            ],
          },
        },
      },
    ],
    [
      'a prefix wildcard clause',
      {
        query: {
          bool: { filter: [{ wildcard: { name: { value: 'orders*' } } }] },
        },
      },
    ],
    [
      'a case-insensitive wildcard clause',
      {
        query: {
          bool: {
            filter: [
              {
                wildcard: {
                  name: { value: '*Orders*', case_insensitive: true },
                },
              },
            ],
          },
        },
      },
    ],
    [
      'a match_phrase clause in query form',
      {
        query: {
          bool: {
            filter: [{ match_phrase: { description: { query: 'orders' } } }],
          },
        },
      },
    ],
  ])('is false for %s', (_, filter) => {
    expect(
      isQueryFilterFullyRepresentable(filter as unknown as QueryFilterInterface)
    ).toBe(false);
  });
});
