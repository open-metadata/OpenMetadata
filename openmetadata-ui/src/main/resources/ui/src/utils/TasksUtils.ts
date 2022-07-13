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
import { Change, diffWordsWithSpace } from 'diff';
import { isEqual, isUndefined } from 'lodash';
import { getDashboardByFqn } from '../axiosAPIs/dashboardAPI';
import { getUserSuggestions } from '../axiosAPIs/miscAPI';
import { getPipelineByFqn } from '../axiosAPIs/pipelineAPI';
import { getTableDetailsByFQN } from '../axiosAPIs/tableAPI';
import { getTopicByFqn } from '../axiosAPIs/topicsAPI';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  PLACEHOLDER_ROUTE_ENTITY_FQN,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_TASK_ID,
  ROUTES,
} from '../constants/constants';
import { EntityType, FqnPart } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Column, Table } from '../generated/entity/data/table';
import { TaskType } from '../generated/entity/feed/thread';
import { EntityReference } from '../generated/type/entityReference';
import {
  EntityData,
  Option,
  TaskActionMode,
} from '../pages/TasksPage/TasksPage.interface';
import { getEntityName, getPartialNameFromTableFQN } from './CommonUtils';
import { defaultFields as DashboardFields } from './DashboardDetailsUtils';
import { defaultFields as TableFields } from './DatasetDetailsUtils';
import { defaultFields as PipelineFields } from './PipelineDetailsUtils';
import { serviceTypeLogo } from './ServiceUtils';
import { getEntityLink } from './TableUtils';
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

export const getRequestTagsPath = (
  entityType: string,
  entityFQN: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.REQUEST_TAGS;
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
): Change[] => {
  return diffWordsWithSpace(oldValue, newValue);
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
        type: hit._source.entityType,
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
];

export const getBreadCrumbList = (
  entityData: EntityData,
  entityType: EntityType
) => {
  const activeEntity = {
    name: getEntityName(entityData as unknown as EntityReference),
    url: getEntityLink(entityType, entityData.fullyQualifiedName || ''),
  };

  const database = {
    name: getPartialNameFromTableFQN(
      entityData.database?.fullyQualifiedName || '',
      [FqnPart.Database]
    ),
    url: getDatabaseDetailsPath(entityData.database?.fullyQualifiedName || ''),
  };

  const databaseSchema = {
    name: getPartialNameFromTableFQN(
      entityData.databaseSchema?.fullyQualifiedName || '',
      [FqnPart.Schema]
    ),
    url: getDatabaseSchemaDetailsPath(
      entityData.databaseSchema?.fullyQualifiedName || ''
    ),
  };

  const service = (serviceCategory: ServiceCategory) => {
    return {
      name: getEntityName(entityData.service),
      url: getEntityName(entityData.service)
        ? getServiceDetailsPath(entityData.service.name || '', serviceCategory)
        : '',
      imgSrc: entityData.serviceType
        ? serviceTypeLogo(entityData.serviceType || '')
        : undefined,
    };
  };

  switch (entityType) {
    case EntityType.TABLE: {
      return [
        service(ServiceCategory.DATABASE_SERVICES),
        database,
        databaseSchema,
        activeEntity,
      ];
    }

    case EntityType.TOPIC: {
      return [service(ServiceCategory.MESSAGING_SERVICES), activeEntity];
    }

    case EntityType.DASHBOARD: {
      return [service(ServiceCategory.DASHBOARD_SERVICES), activeEntity];
    }

    case EntityType.PIPELINE: {
      return [service(ServiceCategory.PIPELINE_SERVICES), activeEntity];
    }

    default:
      return [];
  }
};

export const fetchEntityDetail = (
  entityType: EntityType,
  entityFQN: string,
  setEntityData: (value: React.SetStateAction<EntityData>) => void
) => {
  switch (entityType) {
    case EntityType.TABLE:
      getTableDetailsByFQN(entityFQN, TableFields)
        .then((res: AxiosResponse) => {
          setEntityData(res.data);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.TOPIC:
      getTopicByFqn(entityFQN, ['owner', 'tags'])
        .then((res: AxiosResponse) => {
          setEntityData(res.data);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.DASHBOARD:
      getDashboardByFqn(entityFQN, DashboardFields)
        .then((res: AxiosResponse) => {
          setEntityData(res.data);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.PIPELINE:
      getPipelineByFqn(entityFQN, PipelineFields)
        .then((res: AxiosResponse) => {
          setEntityData(res.data);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    default:
      break;
  }
};

export const TASK_ACTION_LIST = [
  {
    label: 'Accept Suggestion',
    key: TaskActionMode.VIEW,
  },
  {
    label: 'Edit & Accept Suggestion',
    key: TaskActionMode.EDIT,
  },
];

export const isDescriptionTask = (taskType: TaskType) =>
  [TaskType.RequestDescription, TaskType.UpdateDescription].includes(taskType);

export const isTagsTask = (taskType: TaskType) =>
  [TaskType.RequestTag, TaskType.UpdateTag].includes(taskType);
