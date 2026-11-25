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
import { cloneDeep, uniqBy } from 'lodash';
import {
  INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER,
  NO_OWNER_ADVANCE_SEARCH_FILTER,
} from '../../constants/explore.constants';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import {
  buildTree,
  Conjunction,
  describeFlatGroup,
  describeGroups,
  fieldOperators,
  getExploreConfigs,
  getFlatBuilderConfig,
  leafFields,
  openInExplore,
  readInExplore,
  RuleSpec,
  sampleValue,
  toQueryFilter,
} from '../../test/unit/queryBuilderHarness';
import { getExploreURLForAdvancedFilter } from '../CuratedAssetsPureUtils';
import { getRuleExplorePath } from '../PersonaAIContextUtils';
import { withoutSingleClauseMust } from '../QueryBuilderPureUtils';
import { getExplorePath } from '../RouterUtils';
import searchClassBase from '../SearchClassBase';
import { getScopedQueryFilter } from './count';
import { QUERY_BUILDER_GROUP_MODE } from './types';
import { getQueryBuilderExploreUrl } from './url';

jest.mock('../AdvancedSearchClassBase', () =>
  jest.requireActual('../AdvancedSearchClassBase')
);

/**
 * Other screens link into Explore with the filter their own single-group builder wrote. Explore has to open each link
 * on that filter: search with the same filter the screen applied, and show the screen's rules in its Advanced Search
 * so they can be refined. Every field and operator those builders offer is built the way the builder builds it, sent
 * through each screen's link, and opened the way Explore opens a link — bare `/explore`, whose Advanced Search is the
 * all-assets one with custom properties grouped by entity type.
 */

const exploreConfigs = getExploreConfigs(SearchIndex.DATA_ASSET);
const explore = exploreConfigs.provider;

interface ExploreLink {
  url: string;
  // The filter the screen applies, which Explore has to search with.
  applied: QueryFilterInterface;
}

const PRODUCERS: Array<
  [
    string,
    (filter: QueryFilterInterface, entityType: EntityType) => ExploreLink
  ]
> = [
  [
    'View in Explore',
    (filter, entityType) => {
      // As `QueryBuilder` links: its own filter, and the one it searched with, scoped to its entity type.
      const scoped = getScopedQueryFilter(cloneDeep(filter), entityType);
      const url = getQueryBuilderExploreUrl(filter, scoped);

      // The scope applies as Explore's quick filter.
      expect(
        JSON.parse(
          new URL(url, 'http://localhost').searchParams.get('quickFilter') ?? ''
        )
      ).toEqual(scoped);

      return { url, applied: filter };
    },
  ],
  [
    'Curated Assets',
    (filter, entityType) => ({
      url: getExploreURLForAdvancedFilter({
        queryFilter: JSON.stringify(filter),
        selectedResource: [entityType],
      }),
      applied: filter,
    }),
  ],
  [
    'Persona AI Context rule',
    (filter, entityType) => ({
      url: getRuleExplorePath(entityType, undefined, JSON.stringify(filter)),
      applied: filter,
    }),
  ],
];

// A builder pinned to each entity type Explore has a tab for, and the unpinned one.
const tabIndexes = new Set(Object.keys(searchClassBase.getTabsInfo()));
const BUILDER_ENTITY_TYPES = [
  EntityType.ALL,
  ...uniqBy(
    Object.entries(searchClassBase.getEntityTypeSearchIndexMapping()).filter(
      ([, searchIndex]) => tabIndexes.has(searchIndex)
    ),
    ([, searchIndex]) => searchIndex
  ).map(([entityType]) => entityType as EntityType),
];

const BUILDERS = BUILDER_ENTITY_TYPES.map((entityType) => ({
  entityType,
  config: getFlatBuilderConfig(entityType),
}));

const ruleCases = BUILDERS.flatMap(({ entityType, config }) =>
  leafFields(config).flatMap((field) =>
    fieldOperators(config, field).map((operator) => ({
      entityType,
      config,
      rule: { field, operator, value: sampleValue(config, field, operator) },
    }))
  )
);

// Explore keys a pinned builder's custom properties by entity type (`extension.table.strCP`).
const toExploreField = (rule: RuleSpec, entityType: EntityType): RuleSpec =>
  entityType === EntityType.TABLE && rule.field.startsWith('extension.')
    ? {
        ...rule,
        field: rule.field.replace(/^extension\./, `extension.${entityType}.`),
      }
    : rule;

// `is_null` writes no value field, so a time interval's `end` reads back as its `start` (the same question).
const normaliseUnsetIntervalBound = (rule: RuleSpec): RuleSpec =>
  ['is_null', 'is_not_null'].includes(rule.operator) &&
  rule.field.endsWith('intervalCP.end')
    ? { ...rule, field: rule.field.replace(/\.end$/, '.start') }
    : rule;

describe('Explore links from other screens', () => {
  it('covers the fields and operators of a builder for every Explore tab', () => {
    expect(new Set(ruleCases.map((c) => c.entityType)).size).toBe(
      BUILDER_ENTITY_TYPES.length
    );
    expect(BUILDER_ENTITY_TYPES.length).toBeGreaterThan(20);
  });

  describe.each(PRODUCERS)('%s', (_producer, link) => {
    describe.each(['AND', 'OR'] as Conjunction[])(
      'a rule in an %s builder',
      (conjunction) => {
        it.each(
          ruleCases.map((c) => [
            `${c.entityType} › ${c.rule.field} ${c.rule.operator}`,
            c,
          ])
        )('%s', (_name, { entityType, config, rule }) => {
          const built = buildTree(
            config,
            conjunction,
            [{ conjunction, rules: [rule] }],
            QUERY_BUILDER_GROUP_MODE.FLAT
          );

          // The builder has to accept the rule before the link proves anything.
          expect(describeFlatGroup(built).rules).toEqual([rule]);

          const filter = toQueryFilter(built, config);

          expect(filter).toBeDefined();

          const { url, applied } = link(
            filter as QueryFilterInterface,
            entityType
          );
          const opened = openInExplore(url, explore);

          expect(opened?.isComplete).toBe(true);

          expect(withoutSingleClauseMust(opened?.queryFilter?.query)).toEqual(
            withoutSingleClauseMust(applied.query)
          );
          expect(
            describeGroups(opened?.tree as never).flatMap(
              (group) => group.rules
            )
          ).toEqual([
            normaliseUnsetIntervalBound(toExploreField(rule, entityType)),
          ]);
        });
      }
    );
  });

  describe("Data Insight's links", () => {
    it.each([
      [
        'incomplete descriptions',
        INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER,
        {
          field: 'descriptionStatus',
          operator: 'select_equals',
          value: ['INCOMPLETE'],
        },
      ],
      [
        'assets with no owner',
        NO_OWNER_ADVANCE_SEARCH_FILTER,
        { field: 'ownerDisplayName', operator: 'is_null', value: [] },
      ],
    ])('opens %s on its rule', (_name, filter, rule) => {
      const url = getExplorePath({
        extraParameters: { queryFilter: JSON.stringify(filter) },
      });
      const opened = openInExplore(url, explore);

      expect(opened?.queryFilter).toEqual(filter);
      expect(describeGroups(opened?.tree as never)).toEqual([
        { conjunction: 'AND', rules: [rule] },
      ]);
    });

    it('carries what the modal writes for the same rule', () => {
      const built = buildTree(exploreConfigs.modal, 'AND', [
        {
          conjunction: 'AND',
          rules: [
            {
              field: 'descriptionStatus',
              operator: 'select_equals',
              value: ['INCOMPLETE'],
            },
          ],
        },
      ]);

      expect(toQueryFilter(built, explore)).toEqual(
        INCOMPLETE_DESCRIPTION_ADVANCE_SEARCH_FILTER
      );
      expect(
        readInExplore(NO_OWNER_ADVANCE_SEARCH_FILTER, explore).queryFilter
      ).toEqual(NO_OWNER_ADVANCE_SEARCH_FILTER);
    });
  });
});
