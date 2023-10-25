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
import { ActivityFeedTabs } from '../components/ActivityFeed/ActivityFeedTab/ActivityFeedTab.interface';
import {
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getServiceDetailsPath,
  PLACEHOLDER_ROUTE_ENTITY_TYPE,
  PLACEHOLDER_ROUTE_FQN,
  ROUTES,
} from '../constants/constants';
import { EntityField } from '../constants/Feeds.constants';
import {
  EntityTabs,
  EntityType,
  FqnPart,
  TabSpecificField,
} from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Chart } from '../generated/entity/data/chart';
import { Container } from '../generated/entity/data/container';
import { Dashboard } from '../generated/entity/data/dashboard';
import { MlFeature, Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline, Task } from '../generated/entity/data/pipeline';
import { Column, Table } from '../generated/entity/data/table';
import { Field, Topic } from '../generated/entity/data/topic';
import { TaskType, Thread } from '../generated/entity/feed/thread';
import { TagLabel } from '../generated/type/tagLabel';
import {
  EntityData,
  Option,
  TaskAction,
  TaskActionMode,
} from '../pages/TasksPage/TasksPage.interface';
import { getDashboardByFqn } from '../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../rest/databaseAPI';
import { getDataModelDetailsByFQN } from '../rest/dataModelsAPI';
import { getUserSuggestions } from '../rest/miscAPI';
import { getMlModelByFQN } from '../rest/mlModelAPI';
import { getPipelineByFqn } from '../rest/pipelineAPI';
import { getSearchIndexDetailsByFQN } from '../rest/SearchIndexAPI';
import { getContainerByFQN } from '../rest/storageAPI';
import { getStoredProceduresDetailsByFQN } from '../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import { getTopicByFqn } from '../rest/topicsAPI';
import { getEntityDetailLink, getPartialNameFromTableFQN } from './CommonUtils';
import { ContainerFields } from './ContainerDetailUtils';
import {
  defaultFields as DashboardFields,
  fetchCharts,
} from './DashboardDetailsUtils';
import { DatabaseFields } from './DatabaseDetails.utils';
import { defaultFields as DatabaseSchemaFields } from './DatabaseSchemaDetailsUtils';
import { defaultFields as DataModelFields } from './DataModelsUtils';
import { defaultFields as TableFields } from './DatasetDetailsUtils';
import { getEntityName } from './EntityUtils';
import { getEntityFQN, getEntityType } from './FeedUtils';
import { defaultFields as MlModelFields } from './MlModelDetailsUtils';
import { defaultFields as PipelineFields } from './PipelineDetailsUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from './StoredProceduresUtils';
import { getEncodedFqn } from './StringsUtils';
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
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFQN));
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
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFQN));
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
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFQN));
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
    .replace(PLACEHOLDER_ROUTE_FQN, getEncodedFqn(entityFQN));
  const searchParams = new URLSearchParams();

  if (!isUndefined(field) && !isUndefined(value)) {
    searchParams.append('field', field);
    searchParams.append('value', value);
  }

  return { pathname, search: searchParams.toString() };
};

export const getTaskDetailPath = (task: Thread) => {
  const entityFQN = getEntityFQN(task.about) ?? '';
  const entityType = getEntityType(task.about) ?? '';

  return getEntityDetailLink(
    entityType as EntityType,
    entityFQN,
    EntityTabs.ACTIVITY_FEED,
    ActivityFeedTabs.TASKS
  );
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

export const getEntityColumnsDetails = (
  entityType: string,
  entityData: EntityData
) => {
  switch (entityType) {
    case EntityType.TOPIC:
      return (entityData as Topic).messageSchema?.schemaFields ?? [];

    case EntityType.DASHBOARD:
      return (entityData as Dashboard).charts ?? [];

    case EntityType.PIPELINE:
      return (entityData as Pipeline).tasks ?? [];

    case EntityType.MLMODEL:
      return (entityData as Mlmodel).mlFeatures ?? [];

    case EntityType.CONTAINER:
      return (entityData as Container).dataModel?.columns ?? [];

    default:
      return (entityData as Table).columns ?? [];
  }
};

type EntityColumns = Column[] | Task[] | MlFeature[] | Field[];

interface EntityColumnProps {
  description: string;
  tags: TagLabel[];
}

export const getColumnObject = (
  columnName: string,
  columns: EntityColumns,
  entityType: EntityType,
  chartData?: Chart[]
): EntityColumnProps => {
  let columnObject: EntityColumnProps = {} as EntityColumnProps;

  for (let index = 0; index < columns.length; index++) {
    const column = columns[index];
    if (isEqual(column.name, columnName)) {
      columnObject = {
        description: column.description ?? '',
        tags:
          column.tags ??
          (entityType === EntityType.DASHBOARD
            ? chartData?.find((item) => item.name === columnName)?.tags ?? []
            : []),
      };

      break;
    } else {
      columnObject = getColumnObject(
        columnName,
        (column as Column).children || [],
        entityType,
        chartData
      );
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
  EntityType.CONTAINER,
  EntityType.DATABASE_SCHEMA,
  EntityType.DASHBOARD_DATA_MODEL,
  EntityType.STORED_PROCEDURE,
  EntityType.SEARCH_INDEX,
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
        ? serviceUtilClassBase.getServiceTypeLogo(entityData.serviceType)
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

    case EntityType.SEARCH_INDEX: {
      return [service(ServiceCategory.SEARCH_SERVICES), activeEntity];
    }

    case EntityType.DATABASE_SCHEMA: {
      return [
        service(ServiceCategory.DATABASE_SERVICES),
        database,
        activeEntity,
      ];
    }
    case EntityType.DASHBOARD_DATA_MODEL: {
      return [service(ServiceCategory.DASHBOARD_SERVICES), activeEntity];
    }

    case EntityType.CONTAINER: {
      return [service(ServiceCategory.STORAGE_SERVICES), activeEntity];
    }

    case EntityType.STORED_PROCEDURE: {
      return [
        service(ServiceCategory.DATABASE_SERVICES),
        database,
        databaseSchema,
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
  setEntityData: (value: React.SetStateAction<EntityData>) => void,
  setChartData?: (value: React.SetStateAction<Chart[]>) => void
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
          fetchCharts(res.charts)
            .then((chart) => {
              setChartData?.(chart);
            })
            .catch((err: AxiosError) => showErrorToast(err));
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

    case EntityType.DATABASE:
      getDatabaseDetailsByFQN(entityFQN, DatabaseFields)
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

    case EntityType.CONTAINER:
      getContainerByFQN(entityFQN, ContainerFields)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.SEARCH_INDEX:
      getSearchIndexDetailsByFQN(entityFQN, '')
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.STORED_PROCEDURE:
      getStoredProceduresDetailsByFQN(
        entityFQN,
        STORED_PROCEDURE_DEFAULT_FIELDS
      )
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    default:
      break;
  }
};

export const TASK_ACTION_LIST: TaskAction[] = [
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

export const getEntityTaskDetails = (
  entityType: EntityType
): {
  fqnPart: FqnPart[];
  entityField: string;
} => {
  let fqnPartTypes: FqnPart;
  let entityField: string;
  switch (entityType) {
    case EntityType.TABLE:
      fqnPartTypes = FqnPart.NestedColumn;
      entityField = EntityField.COLUMNS;

      break;

    case EntityType.TOPIC:
      fqnPartTypes = FqnPart.Topic;
      entityField = EntityField.MESSAGE_SCHEMA;

      break;

    case EntityType.DASHBOARD:
      fqnPartTypes = FqnPart.Database;
      entityField = EntityField.CHARTS;

      break;

    case EntityType.PIPELINE:
      fqnPartTypes = FqnPart.Schema;
      entityField = EntityField.TASKS;

      break;

    case EntityType.MLMODEL:
      fqnPartTypes = FqnPart.Schema;
      entityField = EntityField.ML_FEATURES;

      break;

    case EntityType.CONTAINER:
      fqnPartTypes = FqnPart.Topic;
      entityField = EntityField.DATA_MODEL;

      break;

    default:
      fqnPartTypes = FqnPart.Table;
      entityField = EntityField.COLUMNS;
  }

  return { fqnPart: [fqnPartTypes], entityField };
};
