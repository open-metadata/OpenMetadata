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
  JsonItem,
  Config,
  ImmutableTree,
  OldJsonTree,
} from '@react-awesome-query-builder/ui';
import { Utils as QbUtils } from '@react-awesome-query-builder/ui';
import { isEmpty } from 'lodash';
import { SearchOutputType } from '../../components/Explore/AdvanceSearchProvider/AdvanceSearchProvider.interface';
import {
  EntityFields,
  EntityReferenceFields,
} from '../../enums/AdvancedSearch.enum';
import type { QueryFilterInterface } from '../../interface/queryFilter.interface';
import {
  getJsonTreeFromQueryFilter,
  migrateJsonLogic,
} from '../QueryBuilderPureUtils';
import { generateUUID } from '../StringUtils';
import type { GroupMode } from './types';
import { QUERY_BUILDER_CONJUNCTION, QUERY_BUILDER_GROUP_MODE } from './types';

/**
 * Settings applied on top of a built config when the builder is read-only.
 *
 * `immutableGroupsMode` is what actually does the work: RAQB gates the
 * delRule, delGroup and add buttons on `!immutableGroupsMode`
 * (item/Rule.jsx:327, item/GroupActions.jsx:43, item/RuleGroupActions.jsx:24).
 * The `immutable*Mode` flags then freeze the field, operator and value inputs.
 *
 * This is the single definition, replacing Collate's
 * `READONLY_ADVANCED_SEARCH_CONFIG`. The two were functionally identical:
 * `canReorder: false` is already set by the class base, and `canRemove` — the
 * one key OSS had and Collate did not — is not a RAQB setting at all. It
 * appears nowhere in the library's types or runtime, so it has never had any
 * effect. It is dropped here rather than carried forward as a key that reads
 * like a guarantee and is not one.
 */
export const READONLY_SETTINGS = {
  immutableGroupsMode: true,
  immutableFieldsMode: true,
  immutableOpsMode: true,
  immutableValuesMode: true,
  canReorder: false,
  canRegroup: false,
};
/**
 * Settings that keep a seeded-but-untouched tree on screen. Without these RAQB
 * prunes the empty group/rule it was just handed, and the builder renders
 * blank until the user finds the "add" button.
 *
 * `shouldCreateEmptyGroup` is deliberately NOT set here. It does not affect the
 * seed at all — it controls what "Add group" produces
 * (`canAddNewRule = !shouldCreateEmptyGroup`, stores/tree.js:40-56). Setting it
 * true makes every new group arrive with no rule inside, so the user gets an
 * empty box they cannot filter with. It was a harmless no-op in the flat V1
 * widget, which has no addGroup at all; it is a real bug anywhere groups exist.
 */
export const PERSISTENT_EMPTY_TREE_SETTINGS = {
  removeEmptyGroupsOnLoad: false,
  removeEmptyRulesOnLoad: false,
};

/**
 * `group -> group -> rule`. The seed the RJSF widget uses for Elasticsearch
 * output. Note the intermediate plain group: this tree is already nested
 * before the user has done anything, so it cannot be used in flat mode.
 */
export const getEmptyJsonTree = (
  defaultField: string = EntityFields.OWNERS
): OldJsonTree => {
  return {
    id: generateUUID(),
    type: 'group',
    properties: {
      conjunction: QUERY_BUILDER_CONJUNCTION.AND,
      not: false,
    },
    children1: {
      [generateUUID()]: {
        type: 'group',
        properties: {
          conjunction: QUERY_BUILDER_CONJUNCTION.AND,
          not: false,
        },
        children1: {
          [generateUUID()]: {
            type: 'rule',
            properties: {
              field: defaultField,
              operator: null,
              value: [],
              valueSrc: ['value'],
            },
          },
        },
      },
    },
  };
};

/**
 * `group -> rule_group(mode: 'some') -> rule`. The seed every JSONLogic caller
 * needs: the `rule_group` wrapper is what lets an array field such as `owners`
 * emit `some`. It is not a user-created bracket and is unaffected by
 * `groupMode`.
 */
export const getEmptyJsonTreeForQueryBuilder = (
  defaultField: string = EntityReferenceFields.OWNERS,
  subField = 'fullyQualifiedName'
): OldJsonTree => {
  const uuid1 = generateUUID();
  const uuid2 = generateUUID();
  const uuid3 = generateUUID();

  return {
    id: uuid1,
    type: 'group',
    properties: {
      conjunction: QUERY_BUILDER_CONJUNCTION.AND,
      not: false,
    },
    children1: {
      [uuid2]: {
        type: 'rule_group',
        id: uuid2,
        properties: {
          conjunction: QUERY_BUILDER_CONJUNCTION.AND,
          not: false,
          mode: 'some',
          field: defaultField,
          fieldSrc: 'field',
        },
        children1: {
          [uuid3]: {
            type: 'rule',
            id: uuid3,
            properties: {
              field: `${defaultField}.${subField}`,
              operator: 'select_equals',
              value: [],
              valueSrc: ['value'],
              fieldSrc: 'field',
            },
          },
        },
      },
    },
  };
};

/**
 * `group -> rule`. One level deep, which is what flat mode actually wants —
 * neither of the two historical seeds is.
 */
export const getEmptyFlatJsonTree = (
  defaultField: string = EntityFields.OWNERS
): OldJsonTree => ({
  id: generateUUID(),
  type: 'group',
  properties: {
    conjunction: QUERY_BUILDER_CONJUNCTION.AND,
    not: false,
  },
  children1: {
    [generateUUID()]: {
      type: 'rule',
      properties: {
        field: defaultField,
        operator: null,
        value: [],
        valueSrc: ['value'],
      },
    },
  },
});

export interface EmptyTreeOptions {
  outputType: SearchOutputType;
  groupMode?: GroupMode;
  defaultField?: string;
  subField?: string;
}

/**
 * Picks the seed for an empty builder.
 *
 * JSONLogic always needs the `rule_group` seed regardless of `groupMode` —
 * that wrapper is structural, not a user bracket. Elasticsearch gets the flat
 * seed unless the caller has explicitly opted into nested groups.
 */
export const getEmptyQueryBuilderTree = ({
  outputType,
  groupMode = QUERY_BUILDER_GROUP_MODE.FLAT,
  defaultField,
  subField,
}: EmptyTreeOptions): OldJsonTree => {
  if (outputType === SearchOutputType.JSONLogic) {
    return getEmptyJsonTreeForQueryBuilder(defaultField, subField);
  }

  return groupMode === QUERY_BUILDER_GROUP_MODE.NESTED
    ? getEmptyJsonTree(defaultField)
    : getEmptyFlatJsonTree(defaultField);
};

export interface LoadTreeOptions extends EmptyTreeOptions {
  config: Config;
  /** Serialised ES filter or JSONLogic, as persisted by the caller. */
  value?: string;
  /** A previously saved RAQB tree, which wins over `value` when present. */
  tree?: OldJsonTree;
}

const parseValue = (value: string): Record<string, unknown> | undefined => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

/**
 * Rehydrates a builder tree from whatever the caller persisted.
 *
 * Consolidates the two copies that lived in `QueryBuilderWidgetV1` and the
 * RJSF widget, including `migrateJsonLogic` for legacy JSONLogic payloads.
 * Always returns a usable tree: an unparseable or empty value falls back to
 * the seed rather than rendering nothing.
 */
export const loadQueryBuilderTree = ({
  config,
  value,
  tree,
  outputType,
  groupMode,
  defaultField,
  subField,
}: LoadTreeOptions): ImmutableTree => {
  const emptyTree = () =>
    QbUtils.checkTree(
      QbUtils.loadTree(
        getEmptyQueryBuilderTree({
          outputType,
          groupMode,
          defaultField,
          subField,
        })
      ),
      config
    );

  if (tree) {
    return QbUtils.checkTree(QbUtils.loadTree(tree), config);
  }

  if (isEmpty(value)) {
    return emptyTree();
  }

  const parsed = parseValue(value as string);

  if (!parsed) {
    return emptyTree();
  }

  if (outputType === SearchOutputType.ElasticSearch) {
    const parsedTree = getJsonTreeFromQueryFilter(
      parsed as unknown as QueryFilterInterface,
      config.fields
    );

    if (isEmpty(parsedTree)) {
      return emptyTree();
    }

    return QbUtils.Validation.sanitizeTree(QbUtils.loadTree(parsedTree), config)
      .fixedTree;
  }

  try {
    // RAQB throws outright when a saved rule names a field the current config
    // does not define — a live risk whenever a field is renamed or an entity
    // type narrows its allow-list. Falling back to the seed leaves the user a
    // usable builder instead of a blank panel.
    const loaded = QbUtils.loadFromJsonLogic(migrateJsonLogic(parsed), config);

    return loaded
      ? QbUtils.Validation.sanitizeTree(loaded, config).fixedTree
      : emptyTree();
  } catch {
    return emptyTree();
  }
};

/**
 * How many rules the tree holds, at any depth.
 *
 * Used to suppress `delRule` at the last remaining rule, so a builder can
 * never be emptied into a state the user cannot recover from.
 *
 * This deliberately walks the whole tree rather than counting the root's
 * direct children. RAQB seeds a wrapper group beneath the root, so a builder
 * showing five rules still has exactly one root child — counting those made
 * the suppression permanent, and the delete button only reappeared once a
 * second top-level group existed.
 *
 * `children1` comes back from `QbUtils.getTree` as an array.
 */
export const getRuleCount = (tree: ImmutableTree): number => {
  const countRules = (node?: JsonItem): number => {
    if (!node) {
      return 0;
    }

    if (node.type === 'rule') {
      return 1;
    }

    const children = node.children1;

    if (!children) {
      return 0;
    }

    // `QbUtils.getTree` returns `children1` as an array, which is the only
    // shape this walk ever sees.
    const list = children as JsonItem[];

    return list.reduce(
      (total: number, child) => total + countRules(child as JsonItem),
      0
    );
  };

  return countRules(QbUtils.getTree(tree) as JsonItem);
};
