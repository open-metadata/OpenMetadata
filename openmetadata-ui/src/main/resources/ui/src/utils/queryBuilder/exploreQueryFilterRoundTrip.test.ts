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
import { SearchIndex } from '../../enums/search.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import {
  buildTree,
  Conjunction,
  describeGroups,
  ExploreConfigs,
  fieldOperators,
  getExploreConfigs,
  GroupSpec,
  leafFields,
  readInExplore,
  RuleSpec,
  sampleValue,
  toJs,
  toQueryFilter,
} from '../../test/unit/queryBuilderHarness';
import searchClassBase from '../SearchClassBase';

jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

/**
 * Explore keeps its Advanced Search filter in the URL as the Elasticsearch query, so every filter the modal can build
 * has to come back from that query as the same filter, in the same groups. Trees are built the way the modal builds
 * them — through RAQB's own reducer, with the actions the modal dispatches — for every field and operator each Explore
 * tab offers, and for every group shape the modal allows: a root conjunction over groups, each a conjunction over
 * rules.
 */

const EXPLORE_INDEXES: SearchIndex[] = [
  SearchIndex.DATA_ASSET,
  ...(Object.keys(searchClassBase.getTabsInfo()) as SearchIndex[]),
];

const ruleCases = EXPLORE_INDEXES.flatMap((searchIndex) => {
  const configs = getExploreConfigs(searchIndex);

  return leafFields(configs.modal).flatMap((field) =>
    fieldOperators(configs.modal, field).map((operator) => ({
      searchIndex,
      configs,
      rule: {
        field,
        operator,
        value: sampleValue(configs.modal, field, operator),
      },
    }))
  );
});

// `is_null` writes no value field, so a time interval's `end` cannot be told from its `start` on the way back. Both
// ask the same question of the same stored entry, so the reader settles on the key the config declares first.
const normaliseUnsetIntervalBound = (rule: RuleSpec): RuleSpec =>
  ['is_null', 'is_not_null'].includes(rule.operator) &&
  rule.field.endsWith('intervalCP.end')
    ? { ...rule, field: rule.field.replace(/\.end$/, '.start') }
    : rule;

const expectRoundTrip = (
  configs: ExploreConfigs,
  rootConjunction: Conjunction,
  groups: GroupSpec[]
) => {
  const built = buildTree(configs.modal, rootConjunction, groups);

  // The modal has to accept every rule before the round trip proves anything.
  expect(describeGroups(built)).toEqual(groups);

  const queryFilter = toQueryFilter(built, configs.provider);

  expect(queryFilter).toBeDefined();

  const back = readInExplore(
    queryFilter as QueryFilterInterface,
    configs.provider
  );

  expect(back.isComplete).toBe(true);
  expect(back.queryFilter).toEqual(queryFilter);
  expect(toJs(back.tree).properties?.conjunction).toBe(rootConjunction);
  expect(describeGroups(back.tree)).toEqual(
    describeGroups(built).map((group) => ({
      ...group,
      rules: group.rules.map(normaliseUnsetIntervalBound),
    }))
  );
};

describe('Explore query filter round trip', () => {
  it('covers every Explore tab with its fields and operators', () => {
    expect(new Set(ruleCases.map((c) => c.searchIndex)).size).toBe(
      EXPLORE_INDEXES.length
    );
    expect(ruleCases.length).toBeGreaterThan(5000);
  });

  it('builds the rules it is asked for', () => {
    const { configs } = ruleCases[0];
    const groups: GroupSpec[] = [
      { conjunction: 'OR', rules: [ruleCases[0].rule] },
      { conjunction: 'AND', rules: [ruleCases[1].rule, ruleCases[2].rule] },
    ];

    expect(describeGroups(buildTree(configs.modal, 'OR', groups))).toEqual(
      groups
    );
  });

  describe.each(['AND', 'OR'] as const)(
    'a rule alone in an %s group',
    (conjunction) => {
      it.each(
        ruleCases.map((c) => [
          `${c.searchIndex} › ${c.rule.field} ${c.rule.operator}`,
          c,
        ])
      )('%s', (_name, { configs, rule }) => {
        expectRoundTrip(configs, 'AND', [{ conjunction, rules: [rule] }]);
      });
    }
  );

  describe('group shapes', () => {
    const configs = getExploreConfigs(SearchIndex.TABLE);
    const owner = (value: string): RuleSpec => ({
      field: 'ownerDisplayName',
      operator: 'select_equals',
      value: [value],
    });
    const tier = (value: string): RuleSpec => ({
      field: 'tier.tagFQN',
      operator: 'select_equals',
      value: [value],
    });
    const notService: RuleSpec = {
      field: 'service.displayName.keyword',
      operator: 'select_not_equals',
      value: ['svc'],
    };
    const domainsIn: RuleSpec = {
      field: 'domains.displayName.keyword',
      operator: 'select_any_in',
      value: [['a', 'b']],
    };
    const tagsNotIn: RuleSpec = {
      field: 'tags.tagFQN',
      operator: 'select_not_any_in',
      value: [['PII.Sensitive', 'PII.None']],
    };
    const nameLike: RuleSpec = {
      field: 'displayName.keyword',
      operator: 'like',
      value: ['orders'],
    };
    const ownerUnset: RuleSpec = {
      field: 'ownerDisplayName',
      operator: 'is_null',
      value: [],
    };
    const strProperty: RuleSpec = {
      field: 'extension.table.strCP.keyword',
      operator: 'like',
      value: ['x'],
    };
    const intProperty: RuleSpec = {
      field: 'extension.table.intCP',
      operator: 'between',
      value: [1, 9],
    };

    const SHAPES: Array<[string, Conjunction, GroupSpec[]]> = [
      [
        'one AND group of different fields',
        'AND',
        [
          {
            conjunction: 'AND',
            rules: [owner('admin'), tier('Tier.Tier1'), notService, nameLike],
          },
        ],
      ],
      [
        'one OR group of different fields',
        'AND',
        [{ conjunction: 'OR', rules: [owner('admin'), tier('Tier.Tier1')] }],
      ],
      [
        'one OR group of negated, any-of and unset rules',
        'AND',
        [
          {
            conjunction: 'OR',
            rules: [notService, domainsIn, tagsNotIn, ownerUnset],
          },
        ],
      ],
      [
        'one OR group of rules on the same field',
        'AND',
        [{ conjunction: 'OR', rules: [owner('admin'), owner('bob')] }],
      ],
      [
        'one OR root over one group',
        'OR',
        [{ conjunction: 'AND', rules: [owner('admin'), tier('Tier.Tier1')] }],
      ],
      [
        'two groups joined by AND',
        'AND',
        [
          { conjunction: 'AND', rules: [owner('admin'), tier('Tier.Tier1')] },
          { conjunction: 'OR', rules: [domainsIn, nameLike] },
        ],
      ],
      [
        'two groups joined by OR',
        'OR',
        [
          { conjunction: 'AND', rules: [owner('admin'), tier('Tier.Tier1')] },
          { conjunction: 'AND', rules: [owner('bob'), tier('Tier.Tier2')] },
        ],
      ],
      [
        'one-value Any in and Not in, as rules',
        'OR',
        [
          {
            conjunction: 'OR',
            rules: [
              { ...domainsIn, value: [['a']] },
              { ...tagsNotIn, value: [['PII.Sensitive']] },
            ],
          },
        ],
      ],
      [
        'one-value Any in and Not in, as groups',
        'AND',
        [
          { conjunction: 'AND', rules: [{ ...domainsIn, value: [['a']] }] },
          {
            conjunction: 'AND',
            rules: [{ ...tagsNotIn, value: [['PII.Sensitive']] }],
          },
        ],
      ],
      [
        'two OR groups joined by AND',
        'AND',
        [
          { conjunction: 'OR', rules: [owner('admin'), tier('Tier.Tier1')] },
          { conjunction: 'OR', rules: [notService, nameLike] },
        ],
      ],
      [
        'two single-rule groups joined by OR',
        'OR',
        [
          { conjunction: 'AND', rules: [owner('admin')] },
          { conjunction: 'OR', rules: [tier('Tier.Tier1')] },
        ],
      ],
      [
        'three groups joined by OR',
        'OR',
        [
          { conjunction: 'AND', rules: [owner('admin')] },
          { conjunction: 'OR', rules: [tier('Tier.Tier1'), domainsIn] },
          { conjunction: 'AND', rules: [tagsNotIn, notService] },
        ],
      ],
      [
        'custom properties among other rules',
        'OR',
        [
          { conjunction: 'AND', rules: [owner('admin'), strProperty] },
          { conjunction: 'OR', rules: [intProperty, tier('Tier.Tier1')] },
        ],
      ],
      [
        'custom properties alone in an OR group',
        'AND',
        [{ conjunction: 'OR', rules: [strProperty, intProperty] }],
      ],
      [
        'the reported 8-rule filter',
        'AND',
        [
          {
            conjunction: 'AND',
            rules: [
              {
                field: 'ownerDisplayName',
                operator: 'select_equals',
                value: ['admin'],
              },
              {
                field: 'entityType.keyword',
                operator: 'select_not_equals',
                value: ['database'],
              },
              {
                field: 'domains.displayName.keyword',
                operator: 'select_equals',
                value: ['banking'],
              },
              tier('Tier.Tier1'),
              {
                field: 'tags.tagFQN',
                operator: 'select_equals',
                value: ['pii.sensitive'],
              },
              {
                field: 'database.displayName.keyword',
                operator: 'select_equals',
                value: ['dev'],
              },
              {
                field: 'displayName.keyword',
                operator: 'select_equals',
                value: ['dim_customers'],
              },
              {
                field: 'service.displayName.keyword',
                operator: 'select_equals',
                value: ['banking-redshift'],
              },
            ],
          },
        ],
      ],
    ];

    it.each(SHAPES)('%s', (_name, rootConjunction, groups) => {
      expectRoundTrip(configs, rootConjunction, groups);
    });
  });
});

describe('custom properties of an entity type', () => {
  const { modal, provider } = getExploreConfigs(SearchIndex.DATA_ASSET);
  const tableRule: RuleSpec = {
    field: 'extension.table.strCP.keyword',
    operator: 'like',
    value: ['gold'],
  };
  const tableFilter = toQueryFilter(
    buildTree(modal, 'AND', [{ conjunction: 'AND', rules: [tableRule] }]),
    provider
  ) as QueryFilterInterface;

  it('reads a rule under the entity type its filter names, not the first that declares the property', () => {
    expect(
      describeGroups(readInExplore(tableFilter, provider).tree)[0].rules
    ).toEqual([tableRule]);
  });

  it("shows no rule, rather than another entity type's, when the property is gone from its own", () => {
    const extension = provider.fields.extension as {
      subfields: Record<string, unknown>;
    };
    const dashboardOnly = {
      ...provider,
      fields: {
        ...provider.fields,
        extension: {
          ...extension,
          subfields: { dashboard: extension.subfields.dashboard },
        },
      },
    } as unknown as typeof provider;
    const back = readInExplore(tableFilter, dashboardOnly);

    // Never read under another entity type's property of the same name.
    expect(describeGroups(back.tree).flatMap((group) => group.rules)).toEqual(
      []
    );
    expect(back.isComplete).toBe(false);
  });
});

describe('a link Explore can only partly show', () => {
  const { provider } = getExploreConfigs(SearchIndex.DATA_ASSET);
  const tierRule = { term: { 'tier.tagFQN': 'Tier.Tier1' } };
  // A clause no builder writes: a hand-edited or another tool's link.
  const unreadable = { prefix: { 'name.keyword': 'dim_' } };
  const linkFilter = {
    query: { bool: { must: [{ bool: { must: [tierRule, unreadable] } }] } },
  } as unknown as QueryFilterInterface;

  it('shows the rules it can read', () => {
    expect(describeGroups(readInExplore(linkFilter, provider).tree)).toEqual([
      {
        conjunction: 'AND',
        rules: [
          {
            field: 'tier.tagFQN',
            operator: 'select_equals',
            value: ['Tier.Tier1'],
          },
        ],
      },
    ]);
  });

  it('reports that it shows only part of the filter', () => {
    expect(readInExplore(linkFilter, provider).isComplete).toBe(false);
  });

  it('shows no rules when none of it can be read', () => {
    const onlyUnreadable = {
      query: { bool: { must: [{ bool: { must: [unreadable] } }] } },
    } as unknown as QueryFilterInterface;
    const back = readInExplore(onlyUnreadable, provider);

    expect(back.isComplete).toBe(false);
    expect(describeGroups(back.tree).flatMap((group) => group.rules)).toEqual(
      []
    );
  });
});
