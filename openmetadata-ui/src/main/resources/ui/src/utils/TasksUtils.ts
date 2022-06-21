/*
 *  Copyright 2021 Collate
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

import { AxiosError, AxiosResponse } from 'axios';
import { diffLines } from 'diff';
import { isEqual, isUndefined } from 'lodash';
import { Diff } from 'Models';
import { getUserSuggestions } from '../axiosAPIs/miscAPI';
import {
  PLACEHOLDER_ROUTE_ENTITY_FQN,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_TASK_ID,
  ROUTES,
} from '../constants/constants';
import { EntityType } from '../enums/entity.enum';
import { Column, Table } from '../generated/entity/data/table';
import { Option } from '../pages/TasksPage/TasksPage.interface';
import { showErrorToast } from './ToastUtils';

export const getRequestDescriptionPath = (
  entityType: string,
  entityFQN: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.REQUEST_DESCRIPTION;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_ENTITY_FQN, entityFQN);
  const searchParams = new URLSearchParams();

  if (!isUndefined(field) && !isUndefined(value)) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getUpdateDescriptionPath = (
  entityType: string,
  entityFQN: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.UPDATE_DESCRIPTION;
  pathname = pathname
    .replace(PLACEHOLDER_ROUTE_ENTITY_TYPE, entityType)
    .replace(PLACEHOLDER_ROUTE_ENTITY_FQN, entityFQN);
  const searchParams = new URLSearchParams();

  if (!isUndefined(field) && !isUndefined(value)) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getTaskDetailPath = (taskId: string) => {
  const pathname = ROUTES.TASK_DETAIL.replace(PLACEHOLDER_TASK_ID, taskId);

  return { pathname };
};

export const getDescriptionDiff = (
  oldValue: string,
  newValue: string
): Diff[] => {
  return diffLines(oldValue, newValue, { ignoreWhitespace: false });
};

export const fetchOptions = (
  query: string,
  setOptions: (value: React.SetStateAction<Option[]>) => void
) => {
  getUserSuggestions(query)
    .then((res: AxiosResponse) => {
      const hits = res.data.suggest['metadata-suggest'][0]['options'];
      // eslint-disable-next-line
      const suggestOptions = hits.map((hit: any) => ({
        label: hit._source.name ?? hit._source.display_name,
        value: hit._id,
        type: hit._source.entity_type,
      }));

      setOptions(suggestOptions);
    })
    .catch((err: AxiosError) => showErrorToast(err));
};

export const getColumnObject = (
  columnName: string,
  columns: Table['columns']
): Column => {
  let columnObject: Column = {} as Column;
  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (isEqual(column.name, columnName)) {
      columnObject = column;

      break;
    } else {
      columnObject = getColumnObject(columnName, column.children || []);
    }
  }

  return columnObject;
};

export const TASK_ENTITIES = [
  EntityType.TABLE,
  EntityType.DASHBOARD,
  EntityType.TOPIC,
  EntityType.PIPELINE,
  EntityType.MLMODEL,
];
