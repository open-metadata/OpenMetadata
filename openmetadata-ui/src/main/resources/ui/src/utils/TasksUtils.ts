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
import { TASK_SANITIZE_VALUE_REGEX } from '../constants/regex.constants';
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
import { DashboardDataModel } from '../generated/entity/data/dashboardDataModel';
import { MlFeature, Mlmodel } from '../generated/entity/data/mlmodel';
import { Pipeline, Task } from '../generated/entity/data/pipeline';
import { SearchIndex } from '../generated/entity/data/searchIndex';
import { Column, Table } from '../generated/entity/data/table';
import { Field, Topic } from '../generated/entity/data/topic';
import { TaskType, Thread } from '../generated/entity/feed/thread';
import { TagLabel } from '../generated/type/tagLabel';
import { SearchSourceAlias } from '../interface/search.interface';
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
import { getDataModelByFqn } from '../rest/dataModelsAPI';
import { getGlossariesByName, getGlossaryTermByFQN } from '../rest/glossaryAPI';
import { getUserSuggestions } from '../rest/miscAPI';
import { getMlModelByFQN } from '../rest/mlModelAPI';
import { getPipelineByFqn } from '../rest/pipelineAPI';
import { getSearchIndexDetailsByFQN } from '../rest/SearchIndexAPI';
import { getContainerByFQN } from '../rest/storageAPI';
import { getStoredProceduresByFqn } from '../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import { getTopicByFqn } from '../rest/topicsAPI';
import { getEntityDetailLink, getPartialNameFromTableFQN } from './CommonUtils';
import { ContainerFields } from './ContainerDetailUtils';
import {
  defaultFields as DashboardFields,
  fetchCharts,
} from './DashboardDetailsUtils';
import { DatabaseFields } from './Database/Database.util';
import { defaultFields as DatabaseSchemaFields } from './DatabaseSchemaDetailsUtils';
import { defaultFields as DataModelFields } from './DataModelsUtils';
import { defaultFields as TableFields } from './DatasetDetailsUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import { getEntityName } from './EntityUtils';
import { getEntityFQN, getEntityType } from './FeedUtils';
import { getGlossaryBreadcrumbs } from './GlossaryUtils';
import { defaultFields as MlModelFields } from './MlModelDetailsUtils';
import { defaultFields as PipelineFields } from './PipelineDetailsUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from './StoredProceduresUtils';
import { getDecodedFqn, getEncodedFqn } from './StringsUtils';
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

export const fetchOptions = ({
  query,
  setOptions,
  onlyUsers,
  currentUserId,
}: {
  query: string;
  setOptions: (value: React.SetStateAction<Option[]>) => void;
  onlyUsers?: boolean;
  currentUserId?: string;
}) => {
  getUserSuggestions(query, onlyUsers)
    .then((res) => {
      const hits = res.data.suggest['metadata-suggest'][0]['options'];
      const suggestOptions = hits.map((hit) => ({
        label: getEntityName(hit._source),
        value: hit._id,
        type: hit._source.entityType,
        name: hit._source.name,
      }));

      setOptions(suggestOptions.filter((item) => item.value !== currentUserId));
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
  EntityType.GLOSSARY,
  EntityType.GLOSSARY_TERM,
];

export const getBreadCrumbList = (
  entityData: EntityData,
  entityType: EntityType
) => {
  const activeEntity = {
    name: getEntityName(entityData),
    url: entityUtilClassBase.getEntityLink(
      entityType,
      entityData.fullyQualifiedName || ''
    ),
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
      name: getEntityName((entityData as Table).service),
      url: getEntityName((entityData as Table).service)
        ? getServiceDetailsPath(
            (entityData as Table).service?.name ?? '',
            serviceCategory
          )
        : '',
      imgSrc: (entityData as Table).serviceType
        ? serviceUtilClassBase.getServiceTypeLogo(
            entityData as SearchSourceAlias
          )
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

    case EntityType.GLOSSARY:
    case EntityType.GLOSSARY_TERM: {
      return getGlossaryBreadcrumbs(entityData.fullyQualifiedName ?? '');
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
      getTableDetailsByFQN(entityFQN, { fields: TableFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.TOPIC:
      getTopicByFqn(entityFQN, {
        fields: [TabSpecificField.OWNER, TabSpecificField.TAGS].join(','),
      })
        .then((res) => {
          setEntityData(res as EntityData);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.DASHBOARD:
      getDashboardByFqn(entityFQN, { fields: DashboardFields })
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
      getPipelineByFqn(entityFQN, { fields: PipelineFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.MLMODEL:
      getMlModelByFQN(entityFQN, { fields: MlModelFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.DATABASE:
      getDatabaseDetailsByFQN(entityFQN, { fields: DatabaseFields })
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
      getDataModelByFqn(entityFQN, { fields: DataModelFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.CONTAINER:
      getContainerByFQN(entityFQN, { fields: ContainerFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.SEARCH_INDEX:
      getSearchIndexDetailsByFQN(entityFQN)
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.STORED_PROCEDURE:
      getStoredProceduresByFqn(entityFQN, {
        fields: STORED_PROCEDURE_DEFAULT_FIELDS,
      })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.GLOSSARY:
      getGlossariesByName(entityFQN, { fields: TabSpecificField.TAGS })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.GLOSSARY_TERM:
      getGlossaryTermByFQN(getDecodedFqn(entityFQN), {
        fields: TabSpecificField.TAGS,
      })
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

export const getEntityTableName = (
  entityType: EntityType,
  name: string,
  entityData: EntityData
): string => {
  if (name.includes('.')) {
    return name;
  }
  let entityReference;

  switch (entityType) {
    case EntityType.TABLE:
      entityReference = (entityData as Table).columns?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.TOPIC:
      entityReference = (entityData as Topic).messageSchema?.schemaFields?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.DASHBOARD:
      entityReference = (entityData as Dashboard).charts?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.PIPELINE:
      entityReference = (entityData as Pipeline).tasks?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.MLMODEL:
      entityReference = (entityData as Mlmodel).mlFeatures?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.CONTAINER:
      entityReference = (entityData as Container).dataModel?.columns?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.SEARCH_INDEX:
      entityReference = (entityData as SearchIndex).fields?.find(
        (item) => item.name === name
      );

      break;

    case EntityType.DASHBOARD_DATA_MODEL:
      entityReference = (entityData as DashboardDataModel).columns?.find(
        (item) => item.name === name
      );

      break;

    default:
      return name;
  }

  if (isUndefined(entityReference)) {
    return name;
  }

  return getEntityName(entityReference);
};

export const getTaskMessage = ({
  value,
  entityType,
  entityData,
  field,
  startMessage,
}: {
  value: string | null;
  entityType: EntityType;
  entityData: EntityData;
  field: string | null;
  startMessage: string;
}) => {
  const sanitizeValue = value?.replaceAll(TASK_SANITIZE_VALUE_REGEX, '') ?? '';

  const entityColumnsName = field
    ? `${field}/${getEntityTableName(entityType, sanitizeValue, entityData)}`
    : '';

  return `${startMessage} for ${entityType} ${getEntityName(
    entityData
  )} ${entityColumnsName}`;
};
