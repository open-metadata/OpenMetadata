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
import { PERSONA_CONTEXT_ASSET_TYPES } from '../constants/PersonaAIContext.constants';
import { EntityType } from '../enums/entity.enum';
import { ContextSection } from '../generated/type/personaContextDefinition';
import { CacheState } from '../generated/type/personaContextStatus';
import {
  buildPersonaContextVersionHistory,
  getDefaultPersonaContextSections,
  getPersonaContextFreshness,
  getPersonaContextSections,
  getRuleConditionCount,
  getRuleExplorePath,
  getRuleFilterTree,
  getScopedRuleCount,
  isKnowledgeContextRule,
  isRuleFilterFullyRendered,
  isSearchScopedRule,
  normalizePersonaContextDefinition,
  parseRuleFilterTree,
} from './PersonaAIContextUtils';

const versionSnapshot = (
  version: number,
  contextDefinition: unknown,
  updatedBy = 'harsha'
) =>
  JSON.stringify({
    id: 'p1',
    version,
    updatedBy,
    updatedAt: version * 1000,
    contextDefinition,
  });

describe('PersonaAIContextUtils', () => {
  it('applies schema defaults without sharing mutable rule arrays', () => {
    const first = normalizePersonaContextDefinition();
    const second = normalizePersonaContextDefinition();

    first.rules?.push({
      entityType: EntityType.TABLE,
      name: 'Tables',
      sections: [ContextSection.Schema],
    });

    expect(first.characterBudget).toBe(400000);
    expect(first.cacheTtlMinutes).toBe(30);
    expect(second.rules).toEqual([]);
  });

  it('returns entity-specific section registries and defaults', () => {
    expect(PERSONA_CONTEXT_ASSET_TYPES).toEqual([
      EntityType.TABLE,
      EntityType.TOPIC,
      EntityType.DASHBOARD,
      EntityType.CHART,
      EntityType.DASHBOARD_DATA_MODEL,
      EntityType.PIPELINE,
      EntityType.MLMODEL,
      EntityType.CONTAINER,
      EntityType.DATABASE,
      EntityType.DATABASE_SCHEMA,
      EntityType.STORED_PROCEDURE,
      EntityType.SEARCH_INDEX,
      EntityType.API_COLLECTION,
      EntityType.API_ENDPOINT,
      EntityType.DATA_PRODUCT,
    ]);
    expect(getPersonaContextSections(EntityType.METRIC)).toContain(
      ContextSection.FormulaExpression
    );
    expect(getPersonaContextSections(EntityType.KNOWLEDGE_PAGE)).toContain(
      ContextSection.FullBody
    );
    expect(getDefaultPersonaContextSections(EntityType.GLOSSARY_TERM)).toEqual([
      ContextSection.Definition,
    ]);
    expect(getPersonaContextSections(EntityType.TABLE)).toContain(
      ContextSection.DataQuality
    );
    expect(getPersonaContextSections(EntityType.DATA_PRODUCT)).toContain(
      ContextSection.Lineage
    );
    expect(getDefaultPersonaContextSections(EntityType.TABLE)).toContain(
      ContextSection.Joins
    );
    expect(getDefaultPersonaContextSections(EntityType.TABLE)).toContain(
      ContextSection.Metrics
    );
  });

  it('parses stored query trees and counts nested rules', () => {
    const tree = JSON.stringify({
      children1: [
        { id: 'one', type: 'rule' },
        {
          children1: [{ id: 'two', type: 'rule' }],
          id: 'group',
          type: 'group',
        },
      ],
      id: 'root',
      type: 'group',
    });

    expect(parseRuleFilterTree(tree)).toBeDefined();
    expect(getRuleConditionCount(tree)).toBe(2);
    expect(parseRuleFilterTree('{invalid')).toBeUndefined();
  });

  it('reconstructs a query tree when only the Elasticsearch filter was stored', () => {
    const tree = getRuleFilterTree(
      undefined,
      JSON.stringify({
        query: {
          bool: {
            must: [
              {
                bool: {
                  must: [{ term: { entityType: EntityType.TABLE } }],
                },
              },
            ],
          },
        },
      })
    );

    expect(tree).toBeDefined();
    expect(getRuleConditionCount(JSON.stringify(tree))).toBe(1);
  });

  // The backend stores `queryFilter` as a free-form JSON object and embeds the
  // DSL `query` node verbatim — it never requires `bool.must`. Rules created via
  // the REST API (which never populates `filterJsonTree`) use `should`, `filter`,
  // `must_not`, or bare `term` shapes. Each of these must reconstruct to a
  // non-empty tree so the editor shows the saved conditions and the rule card
  // shows a non-zero condition count.
  it.each([
    [
      'bool.should (root OR)',
      {
        query: {
          bool: {
            should: [{ term: { deleted: false } }, { term: { name: 'x' } }],
          },
        },
      },
      2,
    ],
    [
      'bool.filter',
      { query: { bool: { filter: [{ term: { deleted: false } }] } } },
      1,
    ],
    [
      'bool.must_not',
      { query: { bool: { must_not: [{ term: { deleted: true } }] } } },
      1,
    ],
    [
      'bare query.term',
      { query: { term: { fullyQualifiedName: 'dim_customer' } } },
      1,
    ],
    [
      'bare term without query wrapper',
      { term: { 'tier.tagFQN': 'Tier.Tier1' } },
      1,
    ],
    [
      'single must clause',
      { query: { bool: { must: [{ term: { name: 'x' } }] } } },
      1,
    ],
  ])(
    'reconstructs a %s shape from queryFilter alone',
    (_label, filter, expectedCount) => {
      const tree = getRuleFilterTree(undefined, JSON.stringify(filter));

      expect(tree).toBeDefined();
      expect(getRuleConditionCount(JSON.stringify(tree))).toBe(expectedCount);
    }
  );

  it('returns undefined when the queryFilter is empty', () => {
    expect(getRuleFilterTree(undefined, '')).toBeUndefined();
    expect(getRuleFilterTree(undefined, '{}')).toBeUndefined();
  });

  it('returns undefined when the queryFilter is not valid JSON', () => {
    expect(getRuleFilterTree(undefined, '{invalid')).toBeUndefined();
  });

  it('treats a filter as fully rendered only when no condition is dropped', () => {
    const tier = { term: { 'tier.tagFQN': 'Tier.Tier1' } };
    const pii = { term: { 'tags.tagFQN': 'PII.Sensitive' } };
    const mixed = JSON.stringify({
      query: { bool: { should: [tier], filter: [pii] } },
    });

    expect(isRuleFilterFullyRendered(undefined, undefined)).toBe(true);
    expect(
      isRuleFilterFullyRendered(
        undefined,
        JSON.stringify({ query: { bool: { filter: [tier, pii] } } })
      )
    ).toBe(true);
    expect(isRuleFilterFullyRendered(undefined, mixed)).toBe(false);
    expect(isRuleFilterFullyRendered(undefined, '{invalid')).toBe(false);
    // A persisted tree is exact, whatever the DSL looks like.
    expect(
      isRuleFilterFullyRendered(JSON.stringify({ type: 'group' }), mixed)
    ).toBe(true);
  });

  it('identifies knowledge rules', () => {
    expect(
      isKnowledgeContextRule({
        entityType: EntityType.GLOSSARY_TERM,
        name: 'Terms',
      })
    ).toBe(true);
    expect(
      isKnowledgeContextRule({ entityType: EntityType.TABLE, name: 'Tables' })
    ).toBe(false);
  });

  it('normalizes knowledge rules as fully rendered', () => {
    const definition = normalizePersonaContextDefinition({
      rules: [
        {
          entityType: EntityType.GLOSSARY_TERM,
          fullyRendered: false,
          name: 'Terms',
        },
      ],
    });

    expect(definition.rules?.[0].fullyRendered).toBe(true);
  });

  it('reads a rule stored without filteredInSearch as preloading', () => {
    const definition = normalizePersonaContextDefinition({
      rules: [{ entityType: EntityType.TABLE, name: 'Legacy' }],
    });

    expect(definition.rules?.[0].filteredInSearch).toBe(false);
  });

  it('does not treat a knowledge rule as search-scoped even when the flag is set', () => {
    // The server ignores filteredInSearch on knowledge types, and the API accepts an explicit true
    // there, so trusting the flag would claim a rule narrows search while the server preloads it.
    expect(
      isSearchScopedRule({
        entityType: EntityType.GLOSSARY_TERM,
        filteredInSearch: true,
        name: 'Terms',
      })
    ).toBe(false);
    expect(
      isSearchScopedRule({
        entityType: EntityType.TABLE,
        filteredInSearch: true,
        name: 'Tables',
      })
    ).toBe(true);
  });

  it('counts only the enabled rules that are filtered in search', () => {
    // The backend drops disabled rules from the served scope, so counting them here would tell the
    // admin more of their search is narrowed than actually is.
    expect(
      getScopedRuleCount({
        rules: [
          { entityType: EntityType.TABLE, filteredInSearch: true, name: 'One' },
          {
            entityType: EntityType.TABLE,
            filteredInSearch: false,
            name: 'Two',
          },
          { entityType: EntityType.TABLE, name: 'Three' },
          {
            enabled: false,
            entityType: EntityType.TABLE,
            filteredInSearch: true,
            name: 'Disabled',
          },
          {
            entityType: EntityType.GLOSSARY_TERM,
            filteredInSearch: true,
            name: 'Knowledge',
          },
        ],
      })
    ).toBe(1);
  });

  it('counts no scoped rule when the definition itself is disabled', () => {
    // searchScope() returns an empty scope before it ever looks at the rules, so a switched-off
    // definition narrows nothing however its rules are flagged.
    expect(
      getScopedRuleCount({
        enabled: false,
        rules: [
          {
            enabled: true,
            entityType: EntityType.TABLE,
            filteredInSearch: true,
            name: 'One',
          },
        ],
      })
    ).toBe(0);
  });

  it('counts scoped rules when enabled is left unset, matching the schema default', () => {
    expect(
      getScopedRuleCount({
        rules: [
          { entityType: EntityType.TABLE, filteredInSearch: true, name: 'One' },
        ],
      })
    ).toBe(1);
    expect(getScopedRuleCount(undefined)).toBe(0);
  });

  describe('buildPersonaContextVersionHistory', () => {
    it('returns empty list when there is no history', () => {
      expect(buildPersonaContextVersionHistory()).toEqual([]);
      expect(
        buildPersonaContextVersionHistory({ versions: [] } as never)
      ).toEqual([]);
    });

    it('sorts newest-first, flags current and describes rule/setting diffs', () => {
      const rule = {
        id: 'r1',
        name: 'KPI metrics',
        entityType: EntityType.TABLE,
      };
      const history = {
        entityType: 'persona',
        versions: [
          versionSnapshot(1.1, { characterBudget: 120000, rules: [] }),
          versionSnapshot(1.2, { characterBudget: 150000, rules: [rule] }),
          versionSnapshot(1.3, {
            characterBudget: 150000,
            rules: [{ ...rule, alwaysInContext: true }],
          }),
        ],
      };

      const entries = buildPersonaContextVersionHistory(history as never);

      expect(entries.map((entry) => entry.version)).toEqual([
        '1.3',
        '1.2',
        '1.1',
      ]);
      expect(entries[0].isCurrent).toBe(true);
      expect(entries[2].isCurrent).toBe(false);
      expect(entries[0].changes).toEqual([
        {
          key: 'message.persona-context-history-rule-always',
          values: { name: 'KPI metrics' },
        },
      ]);
      expect(entries[1].changes).toEqual([
        {
          key: 'message.persona-context-history-rule-added',
          values: { name: 'KPI metrics' },
        },
        {
          key: 'message.persona-context-history-budget',
          values: {
            from: (120000).toLocaleString(),
            to: (150000).toLocaleString(),
          },
        },
      ]);
      expect(entries[2].changes).toEqual([
        { key: 'message.persona-context-history-created' },
      ]);
    });

    it('detects reverts to an earlier identical definition', () => {
      const base = { characterBudget: 120000, rules: [] };
      const history = {
        entityType: 'persona',
        versions: [
          versionSnapshot(2.2, base),
          versionSnapshot(2.3, { characterBudget: 150000, rules: [] }),
          versionSnapshot(2.4, base),
        ],
      };

      const entries = buildPersonaContextVersionHistory(history as never);

      expect(entries[0].version).toBe('2.4');
      expect(entries[0].changes).toEqual([
        {
          key: 'message.persona-context-history-reverted',
          values: { version: '2.2' },
        },
      ]);
    });

    it('reports a prompt-only edit as an AI context change', () => {
      const history = {
        entityType: 'persona',
        versions: [
          versionSnapshot(3.1, { characterBudget: 120000, rules: [] }),
          versionSnapshot(3.2, {
            characterBudget: 120000,
            prompt: 'You assist finance analysts.',
            rules: [],
          }),
        ],
      };

      const entries = buildPersonaContextVersionHistory(history as never);

      // Left out of the comparison, a prompt edit read as "no AI context change".
      expect(entries[0].changes).toEqual([
        { key: 'message.persona-context-history-prompt' },
      ]);
    });
  });
});

// Explore validates a deep-linked tree against its own config and silently
// resets when a field is unknown. This editor is pinned to one entity type, so
// its custom-property keys omit the entity segment Explore expects — without
// the rewrite the link landed on the unfiltered estate with no filter chip.
describe('getRuleExplorePath', () => {
  it('scopes a no-text persona link with an explicit entity-type quick filter', () => {
    const url = new URL(
      getRuleExplorePath(EntityType.TABLE),
      'http://localhost'
    );

    expect(url.pathname).toBe('/explore/');
    expect(url.searchParams.get('search')).toBe('');
    expect(JSON.parse(url.searchParams.get('quickFilter') ?? '{}')).toEqual({
      query: {
        bool: {
          must: [
            { bool: { should: [{ term: { entityType: EntityType.TABLE } }] } },
          ],
        },
      },
    });
  });

  const filterJsonTree = JSON.stringify({
    id: 'root',
    type: 'group',
    properties: { conjunction: 'AND', not: false },
    children1: {
      r1: {
        type: 'rule',
        id: 'r1',
        properties: {
          field: 'extension.testCp.keyword',
          operator: 'equal',
          value: ['2026-09-03'],
          valueSrc: ['value'],
        },
      },
    },
  });

  const fieldsIn = (path: string) =>
    decodeURIComponent(path).match(/"field":"[^"]+"/g) ?? [];

  it('should deep link with the entity-segmented custom property key', () => {
    const path = getRuleExplorePath(EntityType.TABLE, filterJsonTree);

    expect(fieldsIn(path)).toContain(
      '"field":"extension.table.testCp.keyword"'
    );
  });

  it('should not rewrite a key that already carries the segment', () => {
    const already = filterJsonTree.replace(
      'extension.testCp.keyword',
      'extension.table.testCp.keyword'
    );

    expect(fieldsIn(getRuleExplorePath(EntityType.TABLE, already))).toContain(
      '"field":"extension.table.testCp.keyword"'
    );
  });
});

describe('getPersonaContextFreshness', () => {
  const status = (cacheState: CacheState, lastGeneratedAt?: number) => ({
    cacheState,
    tokensEst: 0,
    entitiesIncluded: 0,
    lastGeneratedAt,
    personaId: 'p',
  });

  it.each([
    [false, status(CacheState.Fresh, 1), 'message.not-configured', 'error'],
    [true, undefined, undefined, undefined],
    [true, status(CacheState.Fresh, 1), 'label.fresh', 'success'],
    [true, status(CacheState.Stale, 1), 'label.stale', 'warning'],
    [true, status(CacheState.Stale), 'label.not-generated', 'gray'],
    [true, status(CacheState.Generating), 'label.generating', 'warning'],
    [true, status(CacheState.Failed), 'label.failed', 'error'],
  ])(
    'hasRules=%s status=%o -> %s',
    (hasRules, cacheStatus, labelKey, color) => {
      expect(getPersonaContextFreshness(hasRules, cacheStatus)?.labelKey).toBe(
        labelKey
      );
      expect(getPersonaContextFreshness(hasRules, cacheStatus)?.color).toBe(
        color
      );
    }
  );
});
