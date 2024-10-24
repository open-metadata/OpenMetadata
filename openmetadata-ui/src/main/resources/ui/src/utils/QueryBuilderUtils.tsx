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
import { CloseOutlined } from '@ant-design/icons';
import { Button } from 'antd';
import { t } from 'i18next';
import { isUndefined } from 'lodash';
import React from 'react';
import { RenderSettings } from 'react-awesome-query-builder';
import {
  EsBoolQuery,
  EsExistsQuery,
  EsTerm,
  EsWildCard,
  QueryFieldInterface,
  QueryFilterInterface,
} from '../pages/ExplorePage/ExplorePage.interface';
import { generateUUID } from './StringsUtils';

export const getSelectEqualsNotEqualsProperties = (
  parentPath: Array<string>,
  field: string,
  value: string,
  operator: string
) => {
  const id = generateUUID();

  return {
    [id]: {
      type: 'rule',
      properties: {
        field: field,
        operator,
        value: [value],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['select'],
        asyncListValues: [
          {
            key: value,
            value,
            children: value,
          },
        ],
      },
      id,
      path: [...parentPath, id],
    },
  };
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

export const getJsonTreePropertyFromQueryFilter = (
  parentPath: Array<string>,
  queryFilter: QueryFieldInterface[]
) => {
  const convertedObj = queryFilter.reduce(
    (acc, curr: QueryFieldInterface): Record<string, any> => {
      if (!isUndefined(curr.term?.deleted)) {
        return {
          ...acc,
          ...getEqualFieldProperties(parentPath, curr.term?.deleted as boolean),
        };
      } else if (!isUndefined(curr.term)) {
        return {
          ...acc,
          ...getSelectEqualsNotEqualsProperties(
            parentPath,
            Object.keys(curr.term)[0],
            Object.values(curr.term)[0] as string,
            'select_equals'
          ),
        };
      } else if (
        !isUndefined((curr.bool?.must_not as QueryFieldInterface).term)
      ) {
        return {
          ...acc,
          ...getSelectEqualsNotEqualsProperties(
            parentPath,
            Object.keys((curr.bool?.must_not as EsTerm)?.term)[0],
            Object.values((curr.bool?.must_not as EsTerm)?.term)[0] as string,
            'select_not_equals'
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
      }

      return acc;
    },
    {} as Record<string, any>
  );

  return convertedObj;
};

export const getJsonTreeFromQueryFilter = (
  queryFilter: QueryFilterInterface
) => {
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
              .must as QueryFieldInterface[]
          ),
          id: id2,
          path: [id1, id2],
        },
      },
      id: id1,
      path: [id1],
    };
  } catch {
    return {};
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
