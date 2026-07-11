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
  getDefaultPersonaContextSections,
  getIncludedEntityCount,
  getPersonaContextSections,
  getRuleConditionCount,
  getRuleFilterTree,
  getRuleMatchedCount,
  isKnowledgeContextRule,
  normalizePersonaContextDefinition,
  parseRuleFilterTree,
} from './PersonaAIContextUtils';

describe('PersonaAIContextUtils', () => {
  it('applies schema defaults without sharing mutable rule arrays', () => {
    const first = normalizePersonaContextDefinition();
    const second = normalizePersonaContextDefinition();

    first.rules?.push({
      entityType: EntityType.TABLE,
      name: 'Tables',
      sections: [ContextSection.Schema],
    });

    expect(first.characterBudget).toBe(150000);
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

  it('reads matched and rendered counts from a materialization', () => {
    const context = {
      rules: [
        {
          matched: 142,
          renderedCompact: 2,
          renderedFull: 10,
          ruleName: 'Semantic tables',
        },
      ],
    };

    expect(getRuleMatchedCount(context, 'Semantic tables')).toBe(142);
    expect(getIncludedEntityCount(context)).toBe(12);
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
});
