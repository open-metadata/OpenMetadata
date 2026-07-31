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
import type { AxiosError } from 'axios';
import type React from 'react';
import { ROUTES } from '../constants/constants';
import { EntityType, FqnPart, TabSpecificField } from '../enums/entity.enum';
import { ServiceCategory } from '../enums/service.enum';
import type { APIEndpoint } from '../generated/entity/data/apiEndpoint';
import type { Chart } from '../generated/entity/data/chart';
import type { Table } from '../generated/entity/data/table';
import { useMarketplaceStore } from '../hooks/useMarketplaceStore';
import type { SearchSourceAlias } from '../interface/search.interface';
import type { EntityData } from '../pages/TasksPage/TasksPage.interface';
import { getApiCollectionByFQN } from '../rest/apiCollectionsAPI';
import { getApiEndPointByFQN } from '../rest/apiEndpointsAPI';
import { getDashboardByFqn } from '../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../rest/databaseAPI';
import { getDataModelByFqn } from '../rest/dataModelsAPI';
import { getDataProductByName } from '../rest/dataProductAPI';
import { getGlossariesByName, getGlossaryTermByFQN } from '../rest/glossaryAPI';
import { getMetricByFqn } from '../rest/metricsAPI';
import { getMlModelByFQN } from '../rest/mlModelAPI';
import { getPipelineByFqn } from '../rest/pipelineAPI';
import { getSearchIndexDetailsByFQN } from '../rest/SearchIndexAPI';
import { getContainerByFQN } from '../rest/storageAPI';
import { getStoredProceduresByFqn } from '../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../rest/tableAPI';
import { getTopicByFqn } from '../rest/topicsAPI';
import { ContainerFields } from './ContainerDetailPureUtils';
import {
  defaultFields as DashboardFields,
  fetchCharts,
} from './DashboardDetailsUtils';
import { DatabaseFields } from './Database/Database.util';
import { defaultFields as DatabaseSchemaFields } from './DatabaseSchemaDetailsUtils';
import { defaultFields as DataModelFields } from './DataModelsUtils';
import { defaultFieldsWithColumns as TableFields } from './DatasetDetailsUtils';
import { getEntityName } from './EntityNameUtils';
import entityUtilClassBase from './EntityUtilClassBase';
import { getPartialNameFromTableFQN } from './FqnUtils';
import { getGlossaryBreadcrumbs } from './GlossaryPureUtils';
import { t } from './i18next/LocalUtil';
import { defaultFields as MlModelFields } from './MlModelDetailsUtils';
import { defaultFields as PipelineFields } from './PipelineDetailsUtils';
import { getEntityDetailsPath, getServiceDetailsPath } from './RouterUtils';
import serviceUtilClassBase from './ServiceUtilClassBase';
import { STORED_PROCEDURE_DEFAULT_FIELDS } from './StoredProceduresUtils';
import { showErrorToast } from './ToastUtils';

const TOPIC_TASK_FORM_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  'messageSchema',
].join(',');

const API_ENDPOINT_TASK_FORM_FIELDS = [
  TabSpecificField.OWNERS,
  TabSpecificField.TAGS,
  'requestSchema',
  'responseSchema',
].join(',');

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
    url: getEntityDetailsPath(
      EntityType.DATABASE,
      (entityData as Table).database?.fullyQualifiedName || ''
    ),
  };

  const databaseSchema = {
    name: getPartialNameFromTableFQN(
      (entityData as Table).databaseSchema?.fullyQualifiedName || '',
      [FqnPart.Schema]
    ),
    url: getEntityDetailsPath(
      EntityType.DATABASE_SCHEMA,
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

    case EntityType.DIRECTORY: {
      return [service(ServiceCategory.DRIVE_SERVICES), activeEntity];
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

    case EntityType.API_ENDPOINT: {
      const apiCollection = (entityData as APIEndpoint)?.apiCollection;

      return [
        service(ServiceCategory.API_SERVICES),
        {
          name: getEntityName(apiCollection),
          url: entityUtilClassBase.getEntityLink(
            entityType,
            apiCollection?.fullyQualifiedName || ''
          ),
        },
        activeEntity,
      ];
    }
    case EntityType.API_COLLECTION: {
      return [service(ServiceCategory.API_SERVICES), activeEntity];
    }

    case EntityType.METRIC: {
      return [
        {
          name: t('label.metric-plural'),
          url: ROUTES.METRICS,
        },
        {
          name: getEntityName(entityData),
          url: '',
        },
      ];
    }

    case EntityType.DATA_PRODUCT: {
      return [
        {
          name: t('label.data-product-plural'),
          url: useMarketplaceStore.getState().dataProductBasePath,
        },
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
      getTableDetailsByFQN(entityFQN, { fields: TableFields })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.TOPIC:
      getTopicByFqn(entityFQN, {
        fields: TOPIC_TASK_FORM_FIELDS,
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
      getDatabaseSchemaDetailsByFQN(entityFQN, { fields: DatabaseSchemaFields })
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
    case EntityType.DATA_PRODUCT:
      getDataProductByName(entityFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.DOMAINS,
          TabSpecificField.EXTENSION,
        ].join(','),
      })
        .then((res) => {
          setEntityData(res as EntityData);
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
      getGlossariesByName(entityFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.REVIEWERS,
        ].join(','),
      })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    case EntityType.GLOSSARY_TERM:
      getGlossaryTermByFQN(entityFQN, {
        fields: [
          TabSpecificField.OWNERS,
          TabSpecificField.TAGS,
          TabSpecificField.REVIEWERS,
        ].join(','),
      })
        .then((res) => {
          setEntityData(res);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;

    case EntityType.API_COLLECTION: {
      getApiCollectionByFQN(entityFQN, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS].join(','),
      })
        .then((res) => {
          setEntityData(res as EntityData);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    }
    case EntityType.API_ENDPOINT: {
      getApiEndPointByFQN(entityFQN, {
        fields: API_ENDPOINT_TASK_FORM_FIELDS,
      })
        .then((res) => {
          setEntityData(res as EntityData);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    }
    case EntityType.METRIC: {
      getMetricByFqn(entityFQN, {
        fields: [TabSpecificField.OWNERS, TabSpecificField.TAGS].join(','),
      })
        .then((res) => {
          setEntityData(res as EntityData);
        })
        .catch((err: AxiosError) => showErrorToast(err));

      break;
    }

    default:
      break;
  }
};
