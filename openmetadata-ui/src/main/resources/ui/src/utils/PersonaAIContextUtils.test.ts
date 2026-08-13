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
import {
  buildPersonaContextVersionHistory,
  getDefaultPersonaContextSections,
  getPersonaContextSections,
  getRuleConditionCount,
  getRuleFilterTree,
  isKnowledgeContextRule,
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
  });
});
