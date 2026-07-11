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
import { JsonTree, Utils as QbUtils } from '@react-awesome-query-builder/antd';
import { cloneDeep } from 'lodash';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  DEFAULT_PERSONA_CONTEXT_DEFINITION,
  DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
  PERSONA_CONTEXT_DEFAULT_SECTIONS_BY_ENTITY_TYPE,
  PERSONA_CONTEXT_KNOWLEDGE_TYPES,
  PERSONA_CONTEXT_SECTIONS_BY_ENTITY_TYPE,
} from '../constants/PersonaAIContext.constants';
import { EntityType } from '../enums/entity.enum';
import {
  ContextRule,
  PersonaContextDefinition,
} from '../generated/type/personaContextDefinition';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { getTreeConfig } from './AdvancedSearchUtils';
import { getJsonTreeFromQueryFilter } from './QueryBuilderPureUtils';
import searchClassBase from './SearchClassBase';

export const normalizePersonaContextDefinition = (
  definition?: PersonaContextDefinition
): PersonaContextDefinition => {
  const normalized = {
    ...cloneDeep(DEFAULT_PERSONA_CONTEXT_DEFINITION),
    ...cloneDeep(definition),
  };

  return {
    ...normalized,
    cacheTtlMinutes:
      definition?.cacheTtlMinutes ??
      DEFAULT_PERSONA_CONTEXT_DEFINITION.cacheTtlMinutes,
    characterBudget:
      definition?.characterBudget ??
      DEFAULT_PERSONA_CONTEXT_DEFINITION.characterBudget,
    rules: (definition?.rules ?? []).map((rule) => ({
      ...cloneDeep(rule),
      alwaysInContext: rule.alwaysInContext ?? false,
      enabled: rule.enabled ?? true,
      fullyRendered: PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(
        rule.entityType as EntityType
      )
        ? true
        : rule.fullyRendered ?? false,
      maxAssets: rule.maxAssets ?? DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
      sections:
        (rule.sections?.length ? rule.sections : undefined) ??
        PERSONA_CONTEXT_DEFAULT_SECTIONS_BY_ENTITY_TYPE[rule.entityType] ??
        [],
    })),
  };
};

export const getPersonaContextSections = (entityType: string) =>
  PERSONA_CONTEXT_SECTIONS_BY_ENTITY_TYPE[entityType] ?? [];

export const getDefaultPersonaContextSections = (entityType: string) =>
  cloneDeep(PERSONA_CONTEXT_DEFAULT_SECTIONS_BY_ENTITY_TYPE[entityType] ?? []);

export const parseRuleFilterTree = (
  filterJsonTree?: string
): JsonTree | undefined => {
  if (!filterJsonTree) {
    return undefined;
  }
  try {
    return JSON.parse(filterJsonTree) as JsonTree;
  } catch {
    return undefined;
  }
};

export const getRuleFilterTree = (
  filterJsonTree?: string,
  queryFilter?: string
): JsonTree | undefined => {
  const persistedTree = parseRuleFilterTree(filterJsonTree);
  if (persistedTree || !queryFilter) {
    return persistedTree;
  }
  try {
    const parsedFilter: unknown = JSON.parse(queryFilter);
    if (
      !parsedFilter ||
      typeof parsedFilter !== 'object' ||
      Array.isArray(parsedFilter)
    ) {
      return undefined;
    }

    const reconstructed = getJsonTreeFromQueryFilter(
      parsedFilter as QueryFilterInterface
    );

    return Object.keys(reconstructed).length
      ? (reconstructed as JsonTree)
      : undefined;
  } catch {
    return undefined;
  }
};

export const getRuleConditionCount = (
  filterJsonTree?: string,
  queryFilter?: string
): number => {
  const tree = getRuleFilterTree(filterJsonTree, queryFilter);
  if (!tree) {
    return 0;
  }

  const countRules = (node: unknown): number => {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      return 0;
    }

    const treeNode = node as Record<string, unknown>;
    if (treeNode.type === 'rule') {
      return 1;
    }
    const children = treeNode.children1;
    if (!children || typeof children !== 'object') {
      return 0;
    }

    return Object.values(children).reduce(
      (total, child) => total + countRules(child),
      0
    );
  };

  return countRules(tree);
};

export const getRuleConditionSummary = (
  rule: ContextRule
): string | undefined => {
  const tree = getRuleFilterTree(rule.filterJsonTree, rule.queryFilter);
  if (!tree) {
    return undefined;
  }
  try {
    const searchIndex =
      searchClassBase.getEntityTypeSearchIndexMapping()[rule.entityType];
    const config = getTreeConfig({
      isExplorePage: false,
      searchIndex,
      searchOutputType: SearchOutputType.ElasticSearch,
    });

    return (
      QbUtils.queryString(QbUtils.loadTree(tree), config, true) || undefined
    );
  } catch {
    return undefined;
  }
};

export const isKnowledgeContextRule = (rule: ContextRule): boolean =>
  PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(rule.entityType as EntityType);
