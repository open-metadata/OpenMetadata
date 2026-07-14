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
import { cloneDeep, isEqual, omit } from 'lodash';
import { SearchOutputType } from '../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { ExploreSearchIndex } from '../components/Explore/ExplorePage.interface';
import {
  DEFAULT_PERSONA_CONTEXT_DEFINITION,
  DEFAULT_PERSONA_CONTEXT_MAX_ASSETS,
  PERSONA_CONTEXT_DEFAULT_SECTIONS_BY_ENTITY_TYPE,
  PERSONA_CONTEXT_KNOWLEDGE_TYPES,
  PERSONA_CONTEXT_SECTIONS_BY_ENTITY_TYPE,
} from '../constants/PersonaAIContext.constants';
import { EntityType } from '../enums/entity.enum';
import { Persona } from '../generated/entity/teams/persona';
import { EntityHistory } from '../generated/type/entityHistory';
import {
  ContextRule,
  PersonaContextDefinition,
} from '../generated/type/personaContextDefinition';
import { QueryFilterInterface } from '../pages/ExplorePage/ExplorePage.interface';
import { getTreeConfig } from './AdvancedSearchUtils';
import { getJsonTreeFromQueryFilter } from './QueryBuilderPureUtils';
import { getExplorePath } from './RouterUtils';
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

export const getRuleExplorePath = (
  entityType: string,
  filterJsonTree?: string,
  queryFilter?: string
): string => {
  const tree = getRuleFilterTree(filterJsonTree, queryFilter);
  const searchIndex = searchClassBase.getEntityTypeSearchIndexMapping()[
    entityType
  ] as ExploreSearchIndex | undefined;
  const tab = searchIndex
    ? searchClassBase.getTabsInfo()[searchIndex]?.path
    : undefined;

  return getExplorePath({
    extraParameters: tree ? { queryFilter: JSON.stringify(tree) } : undefined,
    isPersistFilters: false,
    tab,
  });
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

export interface RuleConditionParts {
  field: string;
  operator: string;
  value?: string;
}

const CONDITION_SUMMARY_REGEX =
  /^(.+?)\s+(>=|<=|!=|==|=|>|<|contains|not in|in|like|starts with|ends with|is not null|is null|is not|is)\s*(.*)$/i;

export const getRuleConditionParts = (
  rule: ContextRule
): RuleConditionParts | undefined => {
  const summary = getRuleConditionSummary(rule);
  if (!summary || /\s(and|or)\s|&&|\|\|/i.test(summary)) {
    return undefined;
  }
  const match = summary.match(CONDITION_SUMMARY_REGEX);
  if (!match) {
    return undefined;
  }
  const [, field, operator, rawValue] = match;
  const value = rawValue.trim().replace(/^["']|["']$/g, '');

  return {
    field: field.trim(),
    operator: operator.trim(),
    value: value || undefined,
  };
};

export const isKnowledgeContextRule = (rule: ContextRule): boolean =>
  PERSONA_CONTEXT_KNOWLEDGE_TYPES.includes(rule.entityType as EntityType);

export interface PersonaContextVersionChange {
  key: string;
  values?: Record<string, string | number>;
}

export interface PersonaContextVersionEntry {
  version: string;
  isCurrent: boolean;
  updatedBy?: string;
  updatedAt?: number;
  changes: PersonaContextVersionChange[];
  persona: Persona;
}

const RULE_DERIVED_FIELDS = ['matchedCount'];

export const formatPersonaVersion = (version?: number): string =>
  Number.parseFloat(String(version ?? 1)).toFixed(1);

interface ComparableDefinition {
  cacheTtlMinutes?: number;
  characterBudget?: number;
  enabled: boolean;
  rules: ContextRule[];
}

const comparableDefinition = (
  definition?: PersonaContextDefinition
): ComparableDefinition => ({
  cacheTtlMinutes: definition?.cacheTtlMinutes,
  characterBudget: definition?.characterBudget,
  enabled: definition?.enabled ?? true,
  rules: [...(definition?.rules ?? [])]
    .map((rule) => omit(rule, RULE_DERIVED_FIELDS) as ContextRule)
    .sort((a, b) => (a.id ?? '').localeCompare(b.id ?? '')),
});

const diffContextRules = (
  previous: ComparableDefinition,
  current: ComparableDefinition
): PersonaContextVersionChange[] => {
  const previousById = new Map(previous.rules.map((rule) => [rule.id, rule]));
  const currentById = new Map(current.rules.map((rule) => [rule.id, rule]));
  const changes: PersonaContextVersionChange[] = [];

  current.rules
    .filter((rule) => !previousById.has(rule.id))
    .forEach((rule) =>
      changes.push({
        key: 'message.persona-context-history-rule-added',
        values: { name: rule.name },
      })
    );

  previous.rules
    .filter((rule) => !currentById.has(rule.id))
    .forEach((rule) =>
      changes.push({
        key: 'message.persona-context-history-rule-deleted',
        values: { name: rule.name },
      })
    );

  current.rules.forEach((rule) => {
    const previousRule = previousById.get(rule.id);
    if (!previousRule) {
      return;
    }
    const alwaysChanged =
      (previousRule.alwaysInContext ?? false) !==
      (rule.alwaysInContext ?? false);
    if (alwaysChanged) {
      changes.push({
        key: rule.alwaysInContext
          ? 'message.persona-context-history-rule-always'
          : 'message.persona-context-history-rule-not-always',
        values: { name: rule.name },
      });
    }
    if (
      !isEqual(
        omit(previousRule, ['alwaysInContext']),
        omit(rule, ['alwaysInContext'])
      )
    ) {
      changes.push({
        key: 'message.persona-context-history-rule-updated',
        values: { name: rule.name },
      });
    }
  });

  return changes;
};

const diffContextSettings = (
  previous?: PersonaContextDefinition,
  current?: PersonaContextDefinition
): PersonaContextVersionChange[] => {
  const changes: PersonaContextVersionChange[] = [];
  if (
    current?.characterBudget != null &&
    previous?.characterBudget !== current.characterBudget
  ) {
    changes.push({
      key: 'message.persona-context-history-budget',
      values: {
        from: (previous?.characterBudget ?? 0).toLocaleString(),
        to: current.characterBudget.toLocaleString(),
      },
    });
  }
  if (
    current?.cacheTtlMinutes != null &&
    previous?.cacheTtlMinutes !== current.cacheTtlMinutes
  ) {
    changes.push({
      key: 'message.persona-context-history-ttl',
      values: {
        from: previous?.cacheTtlMinutes ?? 0,
        to: current.cacheTtlMinutes,
      },
    });
  }
  if ((previous?.enabled ?? true) !== (current?.enabled ?? true)) {
    changes.push({
      key: current?.enabled
        ? 'message.persona-context-history-enabled'
        : 'message.persona-context-history-disabled',
    });
  }

  return changes;
};

const parseVersionSnapshot = (snapshot: unknown): Persona | undefined => {
  try {
    return (
      typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot
    ) as Persona;
  } catch {
    return undefined;
  }
};

const describeVersionChanges = (
  snapshots: Persona[],
  index: number
): PersonaContextVersionChange[] => {
  const current = snapshots[index];
  const previous = snapshots[index + 1];
  if (!previous) {
    return [{ key: 'message.persona-context-history-created' }];
  }

  const currentComparable = comparableDefinition(current.contextDefinition);
  const previousComparable = comparableDefinition(previous.contextDefinition);
  const revertTarget = snapshots
    .slice(index + 1)
    .find((older) =>
      isEqual(currentComparable, comparableDefinition(older.contextDefinition))
    );
  if (revertTarget && !isEqual(currentComparable, previousComparable)) {
    return [
      {
        key: 'message.persona-context-history-reverted',
        values: { version: formatPersonaVersion(revertTarget.version) },
      },
    ];
  }

  const changes = [
    ...diffContextRules(previousComparable, currentComparable),
    ...diffContextSettings(
      previous.contextDefinition,
      current.contextDefinition
    ),
  ];
  if (changes.length > 0) {
    return changes;
  }

  // The version bumped but the AI context is byte-equal to the previous one —
  // it came from an unrelated persona edit (name, users, default, …). Label it
  // as such instead of implying the AI context changed.
  return isEqual(currentComparable, previousComparable)
    ? [{ key: 'message.persona-context-history-metadata-only' }]
    : [{ key: 'message.persona-context-history-updated' }];
};

export const buildPersonaContextVersionHistory = (
  history?: EntityHistory
): PersonaContextVersionEntry[] => {
  const snapshots = (history?.versions ?? [])
    .map(parseVersionSnapshot)
    .filter((snapshot): snapshot is Persona => Boolean(snapshot))
    .sort((a, b) => (b.version ?? 0) - (a.version ?? 0));

  return snapshots.map((snapshot, index) => ({
    version: formatPersonaVersion(snapshot.version),
    isCurrent: index === 0,
    updatedBy: snapshot.updatedBy,
    updatedAt: snapshot.updatedAt,
    changes: describeVersionChanges(snapshots, index),
    persona: snapshot,
  }));
};

export const stripPersonaContextDerivedState = (
  definition?: PersonaContextDefinition
): PersonaContextDefinition | undefined =>
  definition
    ? {
        ...omit(definition, ['cacheState', 'lastError', 'lastGeneratedAt']),
        rules: (definition.rules ?? []).map(
          (rule) => omit(rule, RULE_DERIVED_FIELDS) as ContextRule
        ),
      }
    : definition;
