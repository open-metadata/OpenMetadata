/*
 *  Copyright 2022 Collate.
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

import { AxiosError } from 'axios';
import { Change, diffWordsWithSpace } from 'diff';
import i18Next from 'i18next';
import { isEqual, isUndefined } from 'lodash';
import {
  EntityData,
  Option,
  TaskAction,
  TaskActionMode,
} from 'pages/TasksPage/TasksPage.interface';
import { getDashboardByFqn } from 'rest/dashboardAPI';
import { getDatabaseSchemaDetailsByFQN } from 'rest/databaseAPI';
import { getDataModelDetailsByFQN } from 'rest/dataModelsAPI';
import { getUserSuggestions } from 'rest/miscAPI';
import { getMlModelByFQN } from 'rest/mlModelAPI';
import { getPipelineByFqn } from 'rest/pipelineAPI';
import { getTableDetailsByFQN } from 'rest/tableAPI';
import { getTopicByFqn } from 'rest/topicsAPI';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  PLACEHOLDER_ROUTE_ENTITY_FQN,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_TASK_ID,
  ROUTES,
} from '../constants/constants';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Column, Table } from '../generated/entity/data/table';
import { TaskType } from '../generated/entity/feed/thread';
import { getPartialNameFromTableFQN } from './CommonUtils';
import { defaultFields as DashboardFields } from './DashboardDetailsUtils';
import { defaultFields as DatabaseSchemaFields } from './DatabaseSchemaDetailsUtils';
import { defaultFields as DataModelFields } from './DataModelsUtils';
import { defaultFields as TableFields } from './DatasetDetailsUtils';
import { getEntityName } from './EntityUtils';
import { defaultFields as MlModelFields } from './MlModelDetailsUtils';
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

export const getUpdateTagsPath = (
  entityType: string,
  entityFQN: string,
  field?: string,
  value?: string
) => {
  let pathname = ROUTES.UPDATE_TAGS;
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
    .then((res) => {
      const hits = res.data.suggest['metadata-suggest'][0]['options'];
      const suggestOptions = hits.map((hit) => ({
        label: hit._source.name ?? hit._source.displayName,
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
  EntityType.MLMODEL,
  EntityType.DATABASE_SCHEMA,
  EntityType.DASHBOARD_DATA_MODEL,
];

export const getBreadCrumbList = (
  entityData: EntityData,
  entityType: EntityType
) => {
  const activeEntity = {
    name: getEntityName(entityData),
    url: getEntityLink(entityType, entityData.fullyQualifiedName || ''),
  };

  const database = {
    name: getPartialNameFromTableFQN(
      (entityData as Table).database?.fullyQualifiedName || '',
      [FqnPart.Database]
    ),
    url: getDatabaseDetailsPath(
      (entityData as Table).database?.fullyQualifiedName || ''
    ),
  };

  const databaseSchema = {
    name: getPartialNameFromTableFQN(
      (entityData as Table).databaseSchema?.fullyQualifiedName || '',
      [FqnPart.Schema]
    ),
    url: getDatabaseSchemaDetailsPath(
      (entityData as Table).databaseSchema?.fullyQualifiedName || ''
    ),
  };

  const service = (serviceCategory: ServiceCategory) => {
    return {
      name: getEntityName(entityData.service),
      url: getEntityName(entityData.service)
        ? getServiceDetailsPath(entityData.service?.name || '', serviceCategory)
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

    case EntityType.MLMODEL: {
      return [service(ServiceCategory.ML_MODEL_SERVICES), activeEntity];
    }

    case EntityType.DATABASE_SCHEMA: {
      return [
        service(ServiceCategory.DATABASE_SERVICES),
        database,
        activeEntity,
      ];
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
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.TOPIC:
      getTopicByFqn(entityFQN, [TabSpecificField.OWNER, TabSpecificField.TAGS])
        .then((res) => {
          setEntityData(res as EntityData);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.DASHBOARD:
      getDashboardByFqn(entityFQN, DashboardFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.PIPELINE:
      getPipelineByFqn(entityFQN, PipelineFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.MLMODEL:
      getMlModelByFQN(entityFQN, MlModelFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.DATABASE_SCHEMA:
      getDatabaseSchemaDetailsByFQN(entityFQN, DatabaseSchemaFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      getDataModelDetailsByFQN(entityFQN, DataModelFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    default:
      break;
  }
};

export const getTaskActionList = (): TaskAction[] => [
  {
    label: i18Next.t('label.accept-suggestion'),
    key: TaskActionMode.VIEW,
  },
  {
    label: i18Next.t('label.edit-amp-accept-suggestion'),
    key: TaskActionMode.EDIT,
  },
];

export const isDescriptionTask = (taskType: TaskType) =>
  [TaskType.RequestDescription, TaskType.UpdateDescription].includes(taskType);

export const isTagsTask = (taskType: TaskType) =>
  [TaskType.RequestTag, TaskType.UpdateTag].includes(taskType);
