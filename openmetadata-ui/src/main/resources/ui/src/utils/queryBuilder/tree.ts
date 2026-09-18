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

// Settings applied on top of a built config when the builder is read-only.
export const READONLY_SETTINGS = {
  immutableGroupsMode: true,
  immutableFieldsMode: true,
  immutableOpsMode: true,
  immutableValuesMode: true,
  canReorder: false,
  canRegroup: false,
};
// Settings that keep a seeded-but-untouched tree on screen.
export const PERSISTENT_EMPTY_TREE_SETTINGS = {
  removeEmptyGroupsOnLoad: false,
  removeEmptyRulesOnLoad: false,
};

// `group -> group -> rule`.
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

// `group -> rule_group(mode: 'some') -> rule`.
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

// `group -> rule`.
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

interface EmptyTreeOptions {
  outputType: SearchOutputType;
  groupMode?: GroupMode;
  defaultField?: string;
  subField?: string;
}

// Picks the seed for an empty builder.
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

interface LoadTreeOptions extends EmptyTreeOptions {
  config: Config;
  // Serialised ES filter or JSONLogic, as persisted by the caller.
  value?: string;
  // A previously saved RAQB tree, which wins over `value` when present.
  tree?: OldJsonTree;
}

const parseValue = (value: string): Record<string, unknown> | undefined => {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
};

// Rehydrates a builder tree from whatever the caller persisted.
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
    // RAQB throws outright when a saved rule names a field the current config does not define — a live risk whenever a
    // field is renamed or an entity type narrows its allow-list.
    const loaded = QbUtils.loadFromJsonLogic(migrateJsonLogic(parsed), config);

    return loaded
      ? QbUtils.Validation.sanitizeTree(loaded, config).fixedTree
      : emptyTree();
  } catch {
    return emptyTree();
  }
};
