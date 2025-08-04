/*
 *  Copyright 2024 Collate.
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
import { CloseOutlined, PlusOutlined } from '@ant-design/icons';
import {
  FieldOrGroup,
  Fields,
  OldJsonItem,
  OldJsonTree,
  RenderSettings,
} from '@react-awesome-query-builder/antd';
import { Button } from 'antd';
import { isBoolean, isUndefined } from 'lodash';
import { EntityReferenceFields } from '../enums/AdvancedSearch.enum';
import { EntityType } from '../enums/entity.enum';
import {
  EsBoolQuery,
  EsExistsQuery,
  EsTerm,
  EsWildCard,
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { t } from './i18next/LocalUtil';
import { generateUUID } from './StringsUtils';

export const JSONLOGIC_FIELDS_TO_IGNORE_SPLIT = [
  EntityReferenceFields.EXTENSION,
  EntityReferenceFields.SERVICE,
  EntityReferenceFields.DATABASE,
  EntityReferenceFields.DATABASE_SCHEMA,
];

export enum JSONLOGIC_OPERATORS {
  OR = 'or',
  NOT = 'not',
}

export const resolveFieldType = (
  fields: Fields | undefined,
  field: string
): string | undefined => {
  if (!fields) {
    return '';
  }

  // Split the field into parts (e.g., "extension.expert")
  const fieldParts = field.split('.');
  let currentField = fields?.[fieldParts[0]];

  // If the top-level field doesn't exist, return undefined
  if (!currentField) {
    return undefined;
  }

  // Traverse nested subfields if there are more parts
  for (let i = 1; i < fieldParts.length; i++) {
    if (i === 1 && (currentField as any)?.subfields) {
      // Join the remaining parts and check if it exists as a single subfield
      const remainingPath = fieldParts.slice(1).join('.');
      const remainingField = (currentField as any).subfields[remainingPath];
      if (remainingField?.type) {
        return remainingField.type;
      }
    }

    // If no specific path found, continue with normal traversal
    if (!(currentField as any)?.subfields?.[fieldParts[i]]) {
      return undefined; // Subfield not found
    }
    currentField = (currentField as any).subfields[
      fieldParts[i]
    ] as FieldOrGroup;
  }

  return currentField?.type;
};

export const getSelectEqualsNotEqualsProperties = (
  parentPath: Array<string>,
  field: string,
  value: string,
  operator: string
) => {
  const id = generateUUID();
  const isEqualNotEqualOp = ['equal', 'not_equal'].includes(operator);
  const valueType = isEqualNotEqualOp
    ? isBoolean(value)
      ? ['boolean']
      : ['text']
    : Array.isArray(value)
    ? ['multiselect']
    : ['select'];

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: field,
        operator,
        value: [value],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: valueType,
        asyncListValues: isEqualNotEqualOp
          ? undefined
          : Array.isArray(value)
          ? value.map((item) => ({ key: item, value: item, children: item }))
          : [{ key: value, value, children: value }],
      },
      id,
      path: [...parentPath, id],
    },
  };
};
export const READONLY_SETTINGS = {
  immutableGroupsMode: true,
  immutableFieldsMode: true,
  immutableOpsMode: true,
  immutableValuesMode: true,
  canRegroup: false,
  canRemove: false,
};
export const getSelectAnyInProperties = (
  parentPath: Array<string>,
  termObjects: Array<EsTerm>
) => {
  const values = termObjects.map(
    (termObject) => Object.values(termObject.term)[0]
  );
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: Object.keys(termObjects[0].term)[0],
        operator: 'select_any_in',
        value: [values],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['multiselect'],
        asyncListValues: values.map((value) => ({
          key: value,
          value,
          children: value,
        })),
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getSelectNotAnyInProperties = (
  parentPath: Array<string>,
  termObjects: QueryFieldInterface[]
) => {
  const values = termObjects.map(
    (termObject) =>
      Object.values((termObject?.bool?.must_not as EsTerm)?.term)[0]
  );
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: Object.keys((termObjects[0].bool?.must_not as EsTerm).term)[0],
        operator: 'select_not_any_in',
        value: [values],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['multiselect'],
        asyncListValues: values.map((value) => ({
          key: value,
          value,
          children: value,
        })),
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getCommonFieldProperties = (
  parentPath: Array<string>,
  field: string,
  operator: string,
  value?: string
) => {
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field,
        operator,
        value: isUndefined(value) ? [] : [value.replaceAll(/(^\*)|(\*$)/g, '')],
        valueSrc: isUndefined(value) ? [] : ['value'],
        operatorOptions: null,
        valueType: isUndefined(value) ? [] : ['text'],
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getEqualFieldProperties = (
  parentPath: Array<string>,
  value: boolean
) => {
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: 'deleted',
        operator: 'equal',
        value: [value],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['boolean'],
      },
      id,
      path: [...parentPath, id],
    },
  };
};

export const getOperator = (
  fieldType: string | undefined,
  isNot: boolean
): string => {
  switch (fieldType) {
    case 'text':
    case 'boolean':
      return isNot ? 'not_equal' : 'equal';
    default:
      return isNot ? 'select_not_equals' : 'select_equals';
  }
};

export const getJsonTreePropertyFromQueryFilter = (
  parentPath: Array<string>,
  queryFilter: QueryFieldInterface[],
  fields?: Fields
) => {
  const convertedObj = queryFilter.reduce(
    (acc, curr: QueryFieldInterface): Record<string, any> => {
      if (!isUndefined(curr.term?.deleted)) {
        return {
          ...acc,
          ...getEqualFieldProperties(parentPath, curr.term?.deleted as boolean),
        };
      } else if (!isUndefined(curr.term)) {
        const [field, value] = Object.entries(curr.term)[0];
        const fieldType = resolveFieldType(fields, field);
        const op = getOperator(fieldType, false);

        return {
          ...acc,
          ...getSelectEqualsNotEqualsProperties(
            parentPath,
            field,
            value as string,
            op
          ),
        };
      } else if (
        !isUndefined((curr.bool?.must_not as QueryFieldInterface)?.term)
      ) {
        const value = Object.values((curr.bool?.must_not as EsTerm)?.term)[0];
        const key = Object.keys((curr.bool?.must_not as EsTerm)?.term)[0];
        const fieldType = resolveFieldType(fields, key);
        const op = getOperator(fieldType, true);

        return {
          ...acc,
          ...getSelectEqualsNotEqualsProperties(
            parentPath,
            key,
            value as string,
            Array.isArray(value) ? 'select_not_any_in' : op
          ),
        };
      } else if (
        !isUndefined(
          ((curr.bool?.should as QueryFieldInterface[])?.[0] as EsTerm)?.term
        )
      ) {
        return {
          ...acc,
          ...getSelectAnyInProperties(
            parentPath,
            curr?.bool?.should as EsTerm[]
          ),
        };
      } else if (
        !isUndefined(
          (
            (curr.bool?.should as QueryFieldInterface[])?.[0]?.bool
              ?.must_not as EsTerm
          )?.term
        )
      ) {
        return {
          ...acc,
          ...getSelectNotAnyInProperties(
            parentPath,
            curr?.bool?.should as QueryFieldInterface[]
          ),
        };
      } else if (
        !isUndefined(
          (curr.bool?.must_not as QueryFieldInterface)?.exists?.field
        )
      ) {
        return {
          ...acc,
          ...getCommonFieldProperties(
            parentPath,
            (curr.bool?.must_not as QueryFieldInterface)?.exists
              ?.field as string,
            'is_null'
          ),
        };
      } else if (!isUndefined(curr.exists?.field)) {
        return {
          ...acc,
          ...getCommonFieldProperties(
            parentPath,
            (curr.exists as EsExistsQuery).field,
            'is_not_null'
          ),
        };
      } else if (!isUndefined((curr as EsWildCard).wildcard)) {
        return {
          ...acc,
          ...getCommonFieldProperties(
            parentPath,
            Object.keys((curr as EsWildCard).wildcard)[0],
            'like',
            Object.values((curr as EsWildCard).wildcard)[0]?.value
          ),
        };
      } else if (!isUndefined((curr.bool?.must_not as EsWildCard)?.wildcard)) {
        return {
          ...acc,
          ...getCommonFieldProperties(
            parentPath,
            Object.keys((curr.bool?.must_not as EsWildCard)?.wildcard)[0],
            'not_like',
            Object.values((curr.bool?.must_not as EsWildCard)?.wildcard)[0]
              ?.value
          ),
        };
      } else if (!isUndefined((curr.bool as EsBoolQuery)?.must)) {
        return {
          ...acc,
          ...getJsonTreePropertyFromQueryFilter(
            parentPath,
            (curr.bool as EsBoolQuery).must as QueryFieldInterface[],
            fields
          ),
        };
      }

      return acc;
    },
    {} as Record<string, any>
  );

  return convertedObj;
};

export const getJsonTreeFromQueryFilter = (
  queryFilter: QueryFilterInterface,
  fields?: Fields
): OldJsonTree => {
  try {
    const id1 = generateUUID();
    const id2 = generateUUID();
    const mustFilters = queryFilter?.query?.bool?.must as QueryFieldInterface[];

    return {
      type: 'group',
      properties: { conjunction: 'AND', not: false },
      children1: {
        [id2]: {
          type: 'group',
          properties: { conjunction: 'AND', not: false },
          children1: getJsonTreePropertyFromQueryFilter(
            [id1, id2],
            (mustFilters?.[0]?.bool as EsBoolQuery)
              .must as QueryFieldInterface[],
            fields
          ),
          id: id2,
          path: [id1, id2],
        } as OldJsonItem,
      },
      id: id1,
    };
  } catch {
    return {} as OldJsonTree;
  }
};

export const renderQueryBuilderFilterButtons: RenderSettings['renderButton'] = (
  props
) => {
  const type = props?.type;

  if (type === 'delRule') {
    return (
      <Button
        className="action action--DELETE"
        data-testid="delete-condition-button"
        icon={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'delRuleGroup') {
    return (
      <Button
        className="action action--DELETE-GROUP"
        data-testid="delete-group-condition-button"
        icon={<CloseOutlined />}
        onClick={props?.onClick}
      />
    );
  } else if (type === 'addRule') {
    return (
      <Button
        className="action action--ADD-RULE"
        data-testid="add-condition-button"
        type="primary"
        onClick={props?.onClick}>
        {t('label.add-entity', {
          entity: t('label.condition'),
        })}
      </Button>
    );
  }

  return <></>;
};

export const renderJSONLogicQueryBuilderButtons: RenderSettings['renderButton'] =
  (props) => {
    const type = props?.type;

    if (type === 'delRule') {
      return (
        <Button
          className="action action--DELETE ant-btn-sm"
          data-testid="delete-condition-button"
          icon={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'delRuleGroup') {
      return (
        <Button
          className="action action--DELETE-GROUP ant-btn-sm"
          data-testid="delete-group-condition-button"
          icon={<CloseOutlined width={14} />}
          onClick={props?.onClick}
        />
      );
    } else if (type === 'addRule') {
      return (
        <Button
          className="action action--ADD-RULE ant-btn-sm"
          data-testid="add-condition-button"
          icon={<PlusOutlined width={14} />}
          type="primary"
          onClick={props?.onClick}
        />
      );
    }

    return <></>;
  };

interface ElasticsearchQuery {
  bool?: {
    must?: ElasticsearchQuery[];
    should?: ElasticsearchQuery[];
    filter?: ElasticsearchQuery[];
    must_not?: ElasticsearchQuery | ElasticsearchQuery[];
  };
  term?: {
    [key: string]: string;
  };
  exists?: {
    field: string;
  };
  wildcard?: {
    [key: string]: Record<string, string>;
  };
}

export interface JsonLogic {
  [key: string]: any;
}

const flattenAndClauses = (clauses: JsonLogic[]): JsonLogic[] => {
  return clauses.reduce((acc: JsonLogic[], clause) => {
    if (clause.and) {
      return acc.concat(flattenAndClauses(clause.and));
    }

    return acc.concat(clause);
  }, []);
};

export const elasticsearchToJsonLogic = (
  query: ElasticsearchQuery
): JsonLogic => {
  if (query.bool) {
    const boolQuery = query.bool;
    const jsonLogic: JsonLogic = {};

    if (boolQuery.must) {
      const mustClauses = boolQuery.must.map(elasticsearchToJsonLogic);
      jsonLogic.and = flattenAndClauses(mustClauses);
    }

    if (boolQuery.should) {
      jsonLogic.or = boolQuery.should.map(elasticsearchToJsonLogic);
    }

    if (boolQuery.filter) {
      const filterClauses = boolQuery.filter.map(elasticsearchToJsonLogic);
      jsonLogic.and = (jsonLogic.and || []).concat(
        flattenAndClauses(filterClauses)
      );
    }

    if (boolQuery.must_not) {
      const mustNotArray = Array.isArray(boolQuery.must_not)
        ? boolQuery.must_not
        : [boolQuery.must_not];

      const mustNotClauses = mustNotArray.map((q) => ({
        '!': elasticsearchToJsonLogic(q),
      }));

      jsonLogic.and = (jsonLogic.and || []).concat(
        flattenAndClauses(mustNotClauses)
      );
    }

    return jsonLogic;
  }

  if (query.term) {
    const termQuery = query.term;
    const [field, value] = Object.entries(termQuery)[0];
    const op = Array.isArray(value) ? 'in' : '==';

    if (field.includes('.')) {
      const [parentField, childField] = field.split('.');

      const shouldIgnoreSplit =
        JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
          parentField as EntityReferenceFields
        ) ||
        JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
          field as EntityReferenceFields
        );

      return shouldIgnoreSplit
        ? { '==': [{ var: field }, value] }
        : {
            some: [
              { var: parentField },
              { [op]: [{ var: childField }, value] },
            ],
          };
    }

    return { '==': [{ var: field }, value] };
  }

  if (query.exists) {
    const { field } = query.exists;

    if (field.includes('.')) {
      const [parentField] = field.split('.');

      return {
        '!!': {
          var: JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
            parentField as EntityReferenceFields
          )
            ? field
            : parentField,
        },
      };
    }

    return {
      '!!': { var: field },
    };
  }

  if (query.wildcard) {
    const wildcardQuery = query.wildcard;
    const field = Object.keys(wildcardQuery)[0];
    const value = wildcardQuery[field].value;

    if (field.includes('.')) {
      // use in operator for wildcards
      const [parentField, childField] = field.split('.');

      if (
        JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
          parentField as EntityReferenceFields
        )
      ) {
        return {
          in: [{ var: field }, value],
        };
      }

      return {
        some: [
          { var: parentField },
          {
            in: [{ var: childField }, value],
          },
        ],
      };
    } else {
      return {
        in: [{ var: field }, value],
      };
    }
  }

  throw new Error('Unsupported query format');
};

const getNestedFieldKey = (configFields: Fields, searchKey: string) => {
  const searchPattern = `${searchKey}.`;
  for (const key in configFields) {
    if (key.startsWith(searchPattern)) {
      return key;
    }
  }

  return null;
};

export const jsonLogicToElasticsearch = (
  logic: JsonLogic,
  configFields: Fields,
  parentField?: string,
  parentOp?: JSONLOGIC_OPERATORS
): ElasticsearchQuery => {
  if (logic.and) {
    return {
      bool: {
        must: [
          {
            bool: {
              must: logic.and.map((item: JsonLogic) =>
                jsonLogicToElasticsearch(item, configFields)
              ),
            },
          },
        ],
      },
    };
  }

  if (logic.or) {
    return {
      bool: {
        should: logic.or.map((item: JsonLogic) =>
          jsonLogicToElasticsearch(
            item,
            configFields,
            undefined,
            JSONLOGIC_OPERATORS.OR
          )
        ),
      },
    };
  }

  if (logic['!']) {
    return {
      bool: {
        must_not: jsonLogicToElasticsearch(
          logic['!'],
          configFields,
          undefined,
          JSONLOGIC_OPERATORS.NOT
        ),
      },
    };
  }

  if (logic['==']) {
    const [field, value] = logic['=='];
    const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

    const isOrNotOperator = [
      JSONLOGIC_OPERATORS.OR,
      JSONLOGIC_OPERATORS.NOT,
    ].includes(parentOp as JSONLOGIC_OPERATORS);

    const [parentKey] = field.var.split('.');
    if (
      typeof field === 'object' &&
      field.var &&
      field.var.includes('.') &&
      !JSONLOGIC_FIELDS_TO_IGNORE_SPLIT.includes(
        parentKey as EntityReferenceFields
      ) &&
      !isOrNotOperator
    ) {
      return {
        bool: {
          must: [
            {
              term: {
                [fieldVar]: value,
              },
            },
          ],
        },
      };
    }

    return {
      term: {
        [fieldVar]: value,
      },
    };
  }

  if (logic['!=']) {
    const [field, value] = logic['!='];
    const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

    return {
      bool: {
        must_not: [
          {
            term: {
              [fieldVar]: value,
            },
          },
        ],
      },
    };
  }

  if (logic['!!']) {
    const field = Array.isArray(logic['!!'])
      ? logic['!!'][0].var
      : logic['!!'].var;
    const fieldVal = getNestedFieldKey(configFields, field);

    return {
      exists: {
        field: fieldVal || field,
      },
    };
  }

  if (logic.some) {
    const [arrayField, condition] = logic.some;
    if (typeof arrayField === 'object' && arrayField.var) {
      const conditionQuery = jsonLogicToElasticsearch(
        condition,
        configFields,
        arrayField.var
      );

      return conditionQuery;
    }
  }

  if (logic.in) {
    const [field, value] = logic.in;
    const fieldVar = parentField ? `${parentField}.${field.var}` : field.var;

    return {
      term: {
        [fieldVar]: value,
      },
    };
  }

  throw new Error('Unsupported JSON Logic format');
};

/**
 * Adds entity type filter to the query filter if entity type is specified
 * @param qFilter Query filter to add entity type to
 * @param entityType Entity type to filter by
 * @returns Updated query filter with entity type
 */
export const addEntityTypeFilter = (
  qFilter: QueryFilterInterface,
  entityType: string
): QueryFilterInterface => {
  if (entityType === EntityType.ALL) {
    return qFilter;
  }

  if (Array.isArray((qFilter.query?.bool as EsBoolQuery)?.must)) {
    (qFilter.query?.bool?.must as QueryFieldInterface[])?.push({
      bool: {
        must: [
          {
            term: {
              entityType: entityType,
            },
          },
        ],
      },
    });
  }

  return qFilter;
};

export const getEntityTypeAggregationFilter = (
  qFilter: QueryFilterInterface,
  entityType: string
): QueryFilterInterface => {
  if (Array.isArray((qFilter.query?.bool as EsBoolQuery)?.must)) {
    const firstMustBlock = (
      qFilter.query?.bool?.must as QueryFieldInterface[]
    )[0];
    if (firstMustBlock?.bool?.must) {
      (firstMustBlock.bool.must as QueryFieldInterface[]).push({
        term: {
          entityType: entityType,
        },
      });
    }
  }

  return qFilter;
};

/**
 * Migrates old JsonLogic format to new format for specific entity reference fields.
 * @param jsonLogic The original JsonLogic object
 * @returns The migrated JsonLogic object
 */
export const migrateJsonLogic = (
  jsonLogic: Record<string, unknown>
): Record<string, unknown> => {
  const FIELD_MAPPING: Record<string, string> = {
    [EntityReferenceFields.OWNERS]: 'fullyQualifiedName',
    [EntityReferenceFields.REVIEWERS]: 'fullyQualifiedName',
    [EntityReferenceFields.TAG]: 'tagFqn',
  };

  const isVarObject = (value: unknown): value is { var: string } => {
    return (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      'var' in value &&
      typeof (value as Record<string, unknown>)['var'] === 'string'
    );
  };

  const migrateNode = (node: JsonLogic): JsonLogic => {
    if (node === null || typeof node !== 'object') {
      return node;
    }
    if (!Array.isArray(node) && '!!' in node && isVarObject(node['!!'])) {
      const varName = node['!!'].var;
      const mappedField = FIELD_MAPPING[varName];
      if (mappedField) {
        return {
          some: [{ var: varName }, { '!=': [{ var: mappedField }, null] }],
        };
      }
    }
    // Handle arrays
    if (Array.isArray(node)) {
      return node.map(migrateNode);
    }
    // Handle objects
    const result: Record<string, JsonLogic> = {};
    for (const key in node) {
      result[key] = migrateNode(node[key] as JsonLogic);
    }

    return result;
  };

  return migrateNode(jsonLogic) as Record<string, unknown>;
};
