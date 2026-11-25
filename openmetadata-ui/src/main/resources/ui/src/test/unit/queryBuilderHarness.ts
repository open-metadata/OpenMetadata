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
  Config,
  ImmutableTree,
  JsonTree,
} from '@react-awesome-query-builder/ui';
import {
  TreeActions,
  TreeStore,
  Utils as QbUtils,
} from '@react-awesome-query-builder/ui';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import { EntityType } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import { getTreeConfig } from '../../utils/AdvancedSearchUtils';
import { parseExploreQueryFilterParam } from '../../utils/ExplorePureUtils';
import { buildQueryBuilderConfig } from '../../utils/queryBuilder/config';
import {
  getEmptyFlatJsonTree,
  getEmptyJsonTree,
  loadExploreQueryFilter,
  sanitizeQueryBuilderTree,
} from '../../utils/queryBuilder/tree';
import {
  GroupMode,
  QUERY_BUILDER_GROUP_MODE,
} from '../../utils/queryBuilder/types';
import { elasticSearchFormat } from '../../utils/QueryBuilderElasticsearchFormatUtils';
import searchClassBase from '../../utils/SearchClassBase';

/**
 * Builds query-builder trees the way the builders do — through RAQB's own reducer, with the actions their UI
 * dispatches — and opens Explore links the way Explore's Advanced Search does. A test using it must restore the real
 * `AdvancedSearchClassBase` (`jest.mock('<path>/AdvancedSearchClassBase', () => jest.requireActual(...))`): the global
 * setup stubs its configs.
 */

const advancedSearchClassBase = jest.requireActual(
  '../../utils/AdvancedSearchClassBase'
).default;

export type Conjunction = 'AND' | 'OR';
export type RuleSpec = { field: string; operator: string; value: unknown[] };
export type GroupSpec = { conjunction: Conjunction; rules: RuleSpec[] };
export type TreeNode = {
  id?: string;
  type: string;
  properties?: Record<string, unknown>;
  children1?: TreeNode[] | Record<string, TreeNode>;
};
export interface ExploreConfigs {
  // What the provider formats and reads the filter with.
  provider: Config;
  // What the modal's builder dispatches its actions with.
  modal: Config;
}

export const childrenOf = (node: TreeNode): TreeNode[] =>
  Array.isArray(node.children1)
    ? node.children1
    : Object.values(node.children1 ?? {});

export const toJs = (tree: ImmutableTree) =>
  QbUtils.getTree(tree) as unknown as TreeNode;

export const CUSTOM_PROPERTIES = [
  { name: 'strCP', type: 'string' },
  { name: 'intCP', type: 'integer' },
  { name: 'numCP', type: 'number' },
  { name: 'dateCP', type: 'date-cp' },
  { name: 'dateTimeCP', type: 'dateTime-cp' },
  { name: 'timeCP', type: 'time-cp' },
  { name: 'mdCP', type: 'markdown' },
  { name: 'emailCP', type: 'email' },
  { name: 'tsCP', type: 'timestamp' },
  {
    name: 'enumCP',
    type: 'enum',
    customPropertyConfig: { config: { values: ['a', 'b'] } },
  },
  { name: 'refCP', type: 'entityReference' },
  { name: 'refsCP', type: 'array<entityReference>' },
  { name: 'linkCP', type: 'hyperlink-cp' },
  { name: 'intervalCP', type: 'timeInterval' },
  {
    name: 'tableCP',
    type: 'table-cp',
    customPropertyConfig: { config: { columns: ['name'] } },
  },
];

const getCustomPropertyFields = () => {
  const properties: Record<string, unknown> = {};
  CUSTOM_PROPERTIES.forEach((property) => {
    const result = advancedSearchClassBase.getCustomPropertiesSubFields(
      property,
      SearchOutputType.ElasticSearch
    );
    (Array.isArray(result) ? result : [result]).forEach(
      (entry: { subfieldsKey: string; dataObject: object }) => {
        properties[entry.subfieldsKey] = entry.dataObject;
      }
    );
  });

  return properties;
};

// The `extension` subfields a provider merges in, as `processEntityTypeFields` builds them: directly under `extension`
// for a builder pinned to an entity type, or one `!group` per entity type (Explore) when none is pinned. Dashboards
// declare the same property names as tables, and come first, so a rule is only read back under the right entity type
// if the reader goes by the entity type the filter names rather than by the first property that matches.
export const getCustomPropertySubfields = (pinned: boolean) =>
  pinned
    ? getCustomPropertyFields()
    : {
        dashboard: {
          label: 'Dashboard',
          type: '!group',
          subfields: getCustomPropertyFields(),
        },
        table: {
          label: 'Table',
          type: '!group',
          subfields: getCustomPropertyFields(),
        },
      };

const withCustomProperties = (base: Config, pinned: boolean): Config => {
  const extension = base.fields.extension as { subfields?: object } | undefined;

  return (
    extension && 'subfields' in extension
      ? {
          ...base,
          fields: {
            ...base.fields,
            extension: {
              ...extension,
              subfields: getCustomPropertySubfields(pinned),
            },
          },
        }
      : base
  ) as Config;
};

export const getExploreConfigs = (
  searchIndex: SearchIndex | SearchIndex[]
): ExploreConfigs => {
  const base = getTreeConfig({
    searchIndex,
    searchOutputType: SearchOutputType.ElasticSearch,
    isExplorePage: true,
  });
  const provider = withCustomProperties(base, false);
  const modal = buildQueryBuilderConfig({
    outputType: SearchOutputType.ElasticSearch,
    searchIndex:
      searchClassBase.getEntityTypeSearchIndexMapping()[EntityType.ALL],
    entityType: EntityType.ALL,
    groupMode: QUERY_BUILDER_GROUP_MODE.NESTED,
    fields: provider.fields,
    showLabels: true,
    useFriendlyOperatorLabels: false,
  });

  return {
    provider: QbUtils.ConfigUtils.extendConfig(provider) as Config,
    modal: QbUtils.ConfigUtils.extendConfig(modal) as Config,
  };
};

// A single-group builder (Persona rules, Curated Assets, …) as `QueryBuilder` assembles it for its entity type. Tables
// carry the custom properties (`CUSTOM_PROPERTIES`), as they do in Explore's config here.
export const getFlatBuilderConfig = (entityType: EntityType): Config => {
  const searchIndex =
    searchClassBase.getEntityTypeSearchIndexMapping()[entityType];
  const base = buildQueryBuilderConfig({
    outputType: SearchOutputType.ElasticSearch,
    searchIndex,
    entityType,
    groupMode: QUERY_BUILDER_GROUP_MODE.FLAT,
  });

  return QbUtils.ConfigUtils.extendConfig(
    entityType === EntityType.TABLE ? withCustomProperties(base, true) : base
  ) as Config;
};

// The `!group` levels the modal drills through before the leaf field: picking
// `extension`, then `extension.table`, before the property itself.
const drillLevels = (config: Config, field: string): string[] => {
  const parts = field.split('.');

  return parts
    .slice(1)
    .map((_, index) => parts.slice(0, index + 1).join('.'))
    .filter(
      (prefix) =>
        (
          QbUtils.ConfigUtils.getFieldConfig(config, prefix) as {
            type?: string;
          } | null
        )?.type === '!group'
    );
};

export const widgetType = (config: Config, field: string, operator: string) =>
  (
    QbUtils.ConfigUtils.getFieldWidgetConfig(config, field, operator) as {
      type?: string;
    } | null
  )?.type ?? 'text';

// Builds a tree by dispatching what the builder dispatches. The first group and rule come with the empty tree. In the
// nested (Explore) builder every further group is "Add group" at the root and every further rule is "Add New Field" in
// its group; a flat builder is a single group — the root — whose rules are added to it directly.
export const buildTree = (
  config: Config,
  rootConjunction: Conjunction,
  groups: GroupSpec[],
  groupMode: GroupMode = QUERY_BUILDER_GROUP_MODE.NESTED
): ImmutableTree => {
  const isFlat = groupMode === QUERY_BUILDER_GROUP_MODE.FLAT;
  // Seeded as the builder loads its tree (`loadQueryBuilderTree`).
  const initial = sanitizeQueryBuilderTree(
    QbUtils.loadTree(
      (isFlat ? getEmptyFlatJsonTree() : getEmptyJsonTree()) as JsonTree
    ),
    config
  );
  const reducer = TreeStore(config, initial);
  let state = { tree: initial };
  const dispatch = (action: unknown) => {
    state = reducer(state, action as never) as typeof state;
  };
  const nodeAt = (path: string[]) =>
    path
      .slice(1)
      .reduce<TreeNode | undefined>(
        (node, id) =>
          childrenOf(node as TreeNode).find((child) => child.id === id),
        toJs(state.tree)
      ) as TreeNode;
  const rootPath = [toJs(state.tree).id as string];

  if (isFlat && groups.length !== 1) {
    throw new Error('A flat builder holds exactly one group');
  }

  groups.forEach((group, groupIndex) => {
    if (groupIndex > 0) {
      dispatch(TreeActions.tree.addGroup(config, rootPath));
    }
    const groupPath = isFlat
      ? rootPath
      : [...rootPath, childrenOf(nodeAt(rootPath))[groupIndex].id as string];
    dispatch(
      TreeActions.group.setConjunction(config, groupPath, group.conjunction)
    );

    group.rules.forEach((rule, ruleIndex) => {
      if (ruleIndex >= childrenOf(nodeAt(groupPath)).length) {
        dispatch(TreeActions.tree.addRule(config, groupPath));
      }
      let rulePath = [
        ...groupPath,
        childrenOf(nodeAt(groupPath))[ruleIndex].id as string,
      ];

      drillLevels(config, rule.field).forEach((level) => {
        dispatch(TreeActions.rule.setField(config, rulePath, level));
        rulePath = [...rulePath, childrenOf(nodeAt(rulePath))[0].id as string];
      });

      dispatch(TreeActions.rule.setField(config, rulePath, rule.field));
      dispatch(TreeActions.rule.setOperator(config, rulePath, rule.operator));
      rule.value.forEach((value, delta) =>
        dispatch(
          TreeActions.rule.setValue(
            config,
            rulePath,
            delta,
            value as never,
            widgetType(config, rule.field, rule.operator)
          )
        )
      );
    });
  });

  if (!isFlat) {
    dispatch(
      TreeActions.group.setConjunction(config, rootPath, rootConjunction)
    );
  }

  return state.tree;
};

// What the provider writes to the URL when the modal applies.
export const toQueryFilter = (tree: ImmutableTree, config: Config) => {
  const query = elasticSearchFormat(tree, config);

  return query ? ({ query } as QueryFilterInterface) : undefined;
};

// What the provider does with a filter it reads from the URL: the tree it shows, whether that tree shows all of the
// filter, and the filter the tree writes back (what applying the modal would search with).
export const readInExplore = (
  queryFilter: QueryFilterInterface,
  config: Config
) => {
  const { tree, isComplete } = loadExploreQueryFilter(queryFilter, config);

  return { tree, isComplete, queryFilter: toQueryFilter(tree, config) };
};

// What Explore does with a link: read its `queryFilter` param, as the provider does on load.
export const openInExplore = (url: string, config: Config) => {
  const search = new URL(url, 'http://localhost').searchParams;
  const { queryFilter } = parseExploreQueryFilterParam(
    search.get('queryFilter') ?? undefined
  );

  return queryFilter ? readInExplore(queryFilter, config) : undefined;
};

// A group as the builder shows it: its conjunction and its rules. Drill levels collapse into the rule they lead to.
const describeGroup = (group: TreeNode) => {
  const rules: RuleSpec[] = [];
  const collect = (node: TreeNode) =>
    node.type === 'rule'
      ? rules.push({
          field: node.properties?.field as string,
          operator: node.properties?.operator as string,
          value: node.properties?.value as unknown[],
        })
      : childrenOf(node).forEach(collect);
  childrenOf(group).forEach(collect);

  return { conjunction: group.properties?.conjunction, rules };
};

// The groups of a nested (Explore) tree: the root's children.
export const describeGroups = (tree: ImmutableTree) =>
  childrenOf(toJs(tree)).map(describeGroup);

// A flat builder's tree is its own single group.
export const describeFlatGroup = (tree: ImmutableTree) =>
  describeGroup(toJs(tree));

const SAMPLE_TEXT = 'sample_value';

export const sampleValue = (
  config: Config,
  field: string,
  operator: string
): unknown[] => {
  const cardinality =
    QbUtils.ConfigUtils.getOperatorConfig(config, operator, field)
      ?.cardinality ?? 1;
  // A fixed list only accepts its own values; anything else is cleared on load.
  const listValues = (
    QbUtils.ConfigUtils.getFieldConfig(config, field) as {
      fieldSettings?: { listValues?: Record<string, unknown> | unknown[] };
    } | null
  )?.fieldSettings?.listValues;
  const listKeys = Array.isArray(listValues)
    ? listValues.map((item) =>
        typeof item === 'object' ? (item as { value: string }).value : item
      )
    : Object.keys(listValues ?? {});
  const text = (index: number) => {
    if (listKeys.length) {
      return listKeys[index % listKeys.length];
    }

    return index ? `${SAMPLE_TEXT}_2` : SAMPLE_TEXT;
  };
  const valueOf = (index: number): unknown => {
    switch (widgetType(config, field, operator)) {
      case 'number':
        return 10 + index;
      case 'boolean':
        return true;
      case 'date':
        return index ? '2024-02-01' : '2024-01-01';
      case 'datetime':
        return index ? '2024-02-01 10:00:00' : '2024-01-01 10:00:00';
      case 'time':
        return index ? '11:00:00' : '10:00:00';
      case 'multiselect':
        return [text(0), text(1)];
      default:
        return text(index);
    }
  };

  return Array.from({ length: cardinality }, (_, index) => valueOf(index));
};

export const leafFields = (config: Config): string[] =>
  Array.from(QbUtils.ConfigUtils.iterateFields(config))
    .filter(
      ([, fieldConfig]) => !['!group', '!struct'].includes(fieldConfig.type)
    )
    .map(([path]) => path);

export const fieldOperators = (config: Config, field: string): string[] =>
  (
    QbUtils.ConfigUtils.getFieldConfig(config, field) as {
      operators?: string[];
    }
  )?.operators ?? [];
