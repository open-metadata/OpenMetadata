/*
 *  Copyright 2025 Collate.
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

export const getJsonTreeObjectDeletedTerm = (deleted: boolean) => {
  return {
    '9a89a899-cdef-4012-b456-7197e8b38b31': {
      type: 'rule',
      id: '9a89a899-cdef-4012-b456-7197e8b38b31',
      properties: {
        fieldSrc: 'field',
        field: 'deleted',
        operator: 'equal',
        value: [deleted],
        valueSrc: ['value'],
        operatorOptions: null,
        valueType: ['boolean'],
      },
      path: [
        '8baba8ab-89ab-4cde-b012-3197e53630f9',
        '99a9b98a-4567-489a-bcde-f197e53630f9',
        '9a89a899-cdef-4012-b456-7197e8b38b31',
      ],
    },
  };
};

export const getJsonTreeObject = (
  assetName: string,
  schemaName: string,
  includeDeleted: boolean,
  deleted = false
) => {
  return {
    id: '8baba8ab-89ab-4cde-b012-3197e53630f9',
    type: 'group',
    properties: { conjunction: 'AND', not: false },
    children1: {
      '99a9b98a-4567-489a-bcde-f197e53630f9': {
        type: 'group',
        properties: { conjunction: 'AND', not: false },
        children1: {
          '898ba9bb-0123-4456-b89a-b197e53630f9': {
            type: 'rule',
            properties: {
              field: 'name.keyword',
              operator: 'select_equals',
              fieldSrc: 'field',
              value: [assetName],
              valueSrc: ['value'],
              operatorOptions: null,
              valueType: ['select'],
              valueError: [null],
              asyncListValues: [{ value: assetName, title: assetName }],
            },
            path: [
              '8baba8ab-89ab-4cde-b012-3197e53630f9',
              '99a9b98a-4567-489a-bcde-f197e53630f9',
              '898ba9bb-0123-4456-b89a-b197e53630f9',
            ],
            id: '898ba9bb-0123-4456-b89a-b197e53630f9',
          },
          '9aaa99ba-89ab-4cde-b012-3197e5458b56': {
            type: 'rule',
            id: '9aaa99ba-89ab-4cde-b012-3197e5458b56',
            properties: {
              fieldSrc: 'field',
              value: [schemaName],
              asyncListValues: [{ value: schemaName, title: schemaName }],
              valueSrc: ['value'],
              valueError: [null],
              valueType: ['select'],
              operatorOptions: null,
              operator: 'select_equals',
              field: 'databaseSchema.displayName.keyword',
            },
            path: [
              '8baba8ab-89ab-4cde-b012-3197e53630f9',
              '99a9b98a-4567-489a-bcde-f197e53630f9',
              '9aaa99ba-89ab-4cde-b012-3197e5458b56',
            ],
          },
          ...(includeDeleted ? getJsonTreeObjectDeletedTerm(deleted) : {}),
        },
        path: [
          '8baba8ab-89ab-4cde-b012-3197e53630f9',
          '99a9b98a-4567-489a-bcde-f197e53630f9',
        ],
        id: '99a9b98a-4567-489a-bcde-f197e53630f9',
      },
    },
    path: ['8baba8ab-89ab-4cde-b012-3197e53630f9'],
  };
};
