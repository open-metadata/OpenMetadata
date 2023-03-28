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
import {
  OperationPermission,
  ResourceEntity,
} from 'components/PermissionProvider/PermissionProvider.interface';
import cryptoRandomString from 'crypto-random-string-with-promisify-polyfill';
import { ObjectStoreServiceType } from 'generated/entity/data/container';
import { t } from 'i18next';
import {
  Bucket,
  DynamicFormFieldType,
  ServicesData,
  ServiceTypes,
} from 'Models';
import React from 'react';
import { getEntityCount } from 'rest/miscAPI';
import { GlobalSettingOptions } from '../constants/GlobalSettings.constants';
import {
  addDBTIngestionGuide,
  addLineageIngestionGuide,
  addMetadataIngestionGuide,
  addProfilerIngestionGuide,
  addServiceGuide,
  addServiceGuideWOAirflow,
  addUsageIngestionGuide,
} from '../constants/service-guide.constant';
import {
  AIRBYTE,
  AIRFLOW,
  AMAZON_S3,
  AMUNDSEN,
  ATHENA,
  ATLAS,
  AZURESQL,
  BIGQUERY,
  CLICKHOUSE,
  DAGSTER,
  DASHBOARD_DEFAULT,
  DATABASE_DEFAULT,
  DATABRICK,
  DATALAKE,
  DEFAULT_SERVICE,
  DELTALAKE,
  DOMO,
  DRUID,
  DYNAMODB,
  FIVETRAN,
  GCS,
  GLUE,
  HIVE,
  IBMDB2,
  KAFKA,
  KINESIS,
  LOGO,
  LOOKER,
  MARIADB,
  METABASE,
  MLFLOW,
  MODE,
  MSSQL,
  MS_AZURE,
  MYSQL,
  NIFI,
  ORACLE,
  PINOT,
  PIPELINE_DEFAULT,
  POSTGRES,
  POWERBI,
  PRESTO,
  PULSAR,
  QUICKSIGHT,
  REDASH,
  REDPANDA,
  REDSHIFT,
  SAGEMAKER,
  SALESFORCE,
  SCIKIT,
  serviceTypes,
  SINGLESTORE,
  SNOWFLAKE,
  SQLITE,
  SUPERSET,
  TABLEAU,
  TOPIC_DEFAULT,
  TRINO,
  VERTICA,
} from '../constants/Services.constant';
import { PROMISE_STATE } from '../enums/common.enum';
import { ServiceCategory } from '../enums/service.enum';
import { Database } from '../generated/entity/data/database';
import { MlModelServiceType } from '../generated/entity/data/mlmodel';
import {
  DashboardService,
  DashboardServiceType,
} from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import {
  IngestionPipeline,
  PipelineType as IngestionPipelineType,
} from '../generated/entity/services/ingestionPipelines/ingestionPipeline';
import {
  MessagingService,
  MessagingServiceType,
} from '../generated/entity/services/messagingService';
import { MetadataServiceType } from '../generated/entity/services/metadataService';
import { MlmodelService } from '../generated/entity/services/mlmodelService';
import {
  PipelineService,
  PipelineServiceType,
} from '../generated/entity/services/pipelineService';
import { ServiceType } from '../generated/entity/services/serviceType';
import { ServicesType } from '../interface/service.interface';
import { getEntityDeleteMessage, pluralize } from './CommonUtils';
import { getDashboardURL } from './DashboardServiceUtils';
import { getBrokers } from './MessagingServiceUtils';
import { showErrorToast } from './ToastUtils';

export const serviceTypeLogo = (type: string) => {
  switch (type) {
    case DatabaseServiceType.Mysql:
      return MYSQL;

    case DatabaseServiceType.Redshift:
      return REDSHIFT;

    case DatabaseServiceType.BigQuery:
      return BIGQUERY;

    case DatabaseServiceType.Hive:
      return HIVE;

    case DatabaseServiceType.Postgres:
      return POSTGRES;

    case DatabaseServiceType.Oracle:
      return ORACLE;

    case DatabaseServiceType.Snowflake:
      return SNOWFLAKE;

    case DatabaseServiceType.Mssql:
      return MSSQL;

    case DatabaseServiceType.Athena:
      return ATHENA;

    case DatabaseServiceType.Presto:
      return PRESTO;

    case DatabaseServiceType.Trino:
      return TRINO;

    case DatabaseServiceType.Glue:
      return GLUE;

    case DatabaseServiceType.DomoDatabase:
      return DOMO;

    case DatabaseServiceType.MariaDB:
      return MARIADB;

    case DatabaseServiceType.Vertica:
      return VERTICA;

    case DatabaseServiceType.AzureSQL:
      return AZURESQL;

    case DatabaseServiceType.Clickhouse:
      return CLICKHOUSE;

    case DatabaseServiceType.Databricks:
      return DATABRICK;

    case DatabaseServiceType.Db2:
      return IBMDB2;

    case DatabaseServiceType.Druid:
      return DRUID;

    case DatabaseServiceType.DynamoDB:
      return DYNAMODB;

    case DatabaseServiceType.SingleStore:
      return SINGLESTORE;

    case DatabaseServiceType.SQLite:
      return SQLITE;

    case DatabaseServiceType.Salesforce:
      return SALESFORCE;

    case DatabaseServiceType.DeltaLake:
      return DELTALAKE;

    case DatabaseServiceType.PinotDB:
      return PINOT;

    case DatabaseServiceType.Datalake:
      return DATALAKE;

    case MessagingServiceType.Kafka:
      return KAFKA;

    case MessagingServiceType.Pulsar:
      return PULSAR;

    case MessagingServiceType.Redpanda:
      return REDPANDA;

    case MessagingServiceType.Kinesis:
      return KINESIS;

    case DashboardServiceType.Superset:
      return SUPERSET;

    case DashboardServiceType.Looker:
      return LOOKER;

    case DashboardServiceType.Tableau:
      return TABLEAU;

    case DashboardServiceType.Redash:
      return REDASH;

    case DashboardServiceType.Metabase:
      return METABASE;

    case DashboardServiceType.PowerBI:
      return POWERBI;

    case DashboardServiceType.QuickSight:
      return QUICKSIGHT;

    case DashboardServiceType.DomoDashboard:
      return DOMO;
    case DashboardServiceType.Mode:
      return MODE;

    case PipelineServiceType.Airflow:
      return AIRFLOW;

    case PipelineServiceType.Airbyte:
      return AIRBYTE;

    case PipelineServiceType.Dagster:
      return DAGSTER;

    case PipelineServiceType.Fivetran:
      return FIVETRAN;

    case PipelineServiceType.GluePipeline:
      return GLUE;

    case PipelineServiceType.Nifi:
      return NIFI;

    case PipelineServiceType.DomoPipeline:
      return DOMO;

    case MlModelServiceType.Mlflow:
      return MLFLOW;

    case MlModelServiceType.Sklearn:
      return SCIKIT;
    case MlModelServiceType.SageMaker:
      return SAGEMAKER;

    case MetadataServiceType.Amundsen:
      return AMUNDSEN;

    case MetadataServiceType.Atlas:
      return ATLAS;

    case MetadataServiceType.OpenMetadata:
      return LOGO;

    case ObjectStoreServiceType.Azure:
      return MS_AZURE;

    case ObjectStoreServiceType.S3:
      return AMAZON_S3;

    case ObjectStoreServiceType.Gcs:
      return GCS;

    default: {
      let logo;
      if (serviceTypes.messagingServices.includes(type)) {
        logo = TOPIC_DEFAULT;
      } else if (serviceTypes.dashboardServices.includes(type)) {
        logo = DASHBOARD_DEFAULT;
      } else if (serviceTypes.pipelineServices.includes(type)) {
        logo = PIPELINE_DEFAULT;
      } else if (serviceTypes.databaseServices.includes(type)) {
        logo = DATABASE_DEFAULT;
      } else {
        logo = DEFAULT_SERVICE;
      }

      return logo;
    }
  }
};

export const fromISOString = (isoValue = '') => {
  if (isoValue) {
    // 'P1DT 0H 0M'
    const [d, hm] = isoValue.split('T');
    const day = +d.replace('D', '').replace('P', '');
    const [h, time] = hm.split('H');
    const minute = +time.replace('M', '');

    return { day, hour: +h, minute };
  } else {
    return {
      day: 1,
      hour: 0,
      minute: 0,
    };
  }
};

export const getFrequencyTime = (isoDate: string): string => {
  const { day, hour, minute } = fromISOString(isoDate);

  return `${day}D-${hour}H-${minute}M`;
};

export const getServiceCategoryFromType = (type: string): ServiceTypes => {
  let serviceCategory: ServiceTypes = 'databaseServices';
  for (const category in serviceTypes) {
    if (serviceTypes[category as ServiceTypes].includes(type)) {
      serviceCategory = category as ServiceTypes;

      break;
    }
  }

  return serviceCategory;
};

// Note: This method is deprecated by "getEntityCountByType" of EntityUtils.ts
export const getEntityCountByService = (buckets: Array<Bucket>) => {
  const entityCounts = {
    tableCount: 0,
    topicCount: 0,
    dashboardCount: 0,
    pipelineCount: 0,
  };
  buckets?.forEach((bucket) => {
    if (serviceTypes.databaseServices.includes(bucket.key)) {
      entityCounts.tableCount += bucket.doc_count;
    } else if (serviceTypes.messagingServices.includes(bucket.key)) {
      entityCounts.topicCount += bucket.doc_count;
    } else if (serviceTypes.dashboardServices.includes(bucket.key)) {
      entityCounts.dashboardCount += bucket.doc_count;
    } else if (serviceTypes.pipelineServices.includes(bucket.key)) {
      entityCounts.pipelineCount += bucket.doc_count;
    }
  });

  return entityCounts;
};

export const getTotalEntityCountByService = (buckets: Array<Bucket> = []) => {
  let entityCounts = 0;
  buckets.forEach((bucket) => {
    entityCounts += bucket.doc_count;
  });

  return entityCounts;
};

export const getKeyValuePair = (obj: Record<string, string>) => {
  return Object.entries(obj).map((v) => {
    return {
      key: v[0],
      value: v[1],
    };
  });
};

export const getKeyValueObject = (arr: DynamicFormFieldType[]) => {
  const keyValuePair: Record<string, string> = {};

  arr.forEach((obj) => {
    if (obj.key && obj.value) {
      keyValuePair[obj.key] = obj.value;
    }
  });

  return keyValuePair;
};

export const getHostPortDetails = (hostport: string) => {
  let host = '',
    port = '';
  const newHostPort = hostport.split(':');

  port = newHostPort.splice(newHostPort.length - 1, 1).join();
  host = newHostPort.join(':');

  return {
    host,
    port,
  };
};

export const isRequiredDetailsAvailableForIngestion = (
  serviceCategory: ServiceCategory,
  data: ServicesData
) => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES: {
      const hostPort = getHostPortDetails(
        data?.databaseConnection?.hostPort || ''
      );

      return Boolean(hostPort.host && hostPort.port);
    }

    case ServiceCategory.MESSAGING_SERVICES:
    case ServiceCategory.PIPELINE_SERVICES:
    case ServiceCategory.DASHBOARD_SERVICES:
      return false;

    default:
      return true;
  }
};

export const servicePageTabs = (entity: string) => [
  {
    name: entity,
    path: entity.toLowerCase(),
  },
  {
    name: t('label.ingestion-plural'),
    path: 'ingestions',
  },
  {
    name: t('label.connection'),
    path: 'connection',
  },
];

export const getCurrentServiceTab = (
  tab: string,
  serviceName: ServiceTypes
) => {
  let currentTab;
  switch (tab) {
    case 'ingestions':
      currentTab = 2;

      break;

    case 'connection':
      currentTab = 3;

      break;

    case 'entity':
    default:
      currentTab = serviceName === ServiceCategory.METADATA_SERVICES ? 2 : 1;

      break;
  }

  return currentTab;
};

export const getFormattedGuideText = (
  text: string,
  toReplace: string,
  replacement: string,
  isGlobal = false
) => {
  const regExp = isGlobal ? new RegExp(toReplace, 'g') : new RegExp(toReplace);

  return text.replace(regExp, replacement);
};

export const getServiceIngestionStepGuide = (
  step: number,
  isIngestion: boolean,
  ingestionName: string,
  serviceName: string,
  ingestionType: IngestionPipelineType,
  showDeployTitle: boolean,
  isUpdated: boolean,
  isAirflowSetup = true
) => {
  let guide;
  if (isIngestion) {
    switch (ingestionType) {
      case IngestionPipelineType.Usage: {
        guide = addUsageIngestionGuide.find((item) => item.step === step);

        break;
      }
      case IngestionPipelineType.Lineage: {
        guide = addLineageIngestionGuide.find((item) => item.step === step);

        break;
      }
      case IngestionPipelineType.Profiler: {
        guide = addProfilerIngestionGuide.find((item) => item.step === step);

        break;
      }
      case IngestionPipelineType.Dbt: {
        guide = addDBTIngestionGuide.find((item) => item.step === step);

        break;
      }
      case IngestionPipelineType.Metadata:
      default: {
        guide = addMetadataIngestionGuide.find((item) => item.step === step);

        break;
      }
    }
  } else {
    guide =
      !isAirflowSetup && step === 4
        ? addServiceGuideWOAirflow
        : addServiceGuide.find((item) => item.step === step);
  }

  const getTitle = (title: string) => {
    const update = showDeployTitle
      ? title.replace(
          t('label.added'),
          `${t('label.updated')} & ${t('label.deployed')}`
        )
      : title.replace(t('label.added'), t('label.updated'));
    const newTitle = showDeployTitle
      ? title.replace(
          t('label.added'),
          `${t('label.added')} & ${t('label.deployed')}`
        )
      : title;

    return isUpdated ? update : newTitle;
  };

  return (
    <>
      {guide && (
        <>
          <h6 className="tw-heading tw-text-base">{getTitle(guide.title)}</h6>
          <div className="tw-mb-5 overflow-wrap-anywhere">
            {isIngestion
              ? getFormattedGuideText(
                  guide.description,
                  `<${t('label.ingestion-pipeline-name')}>`,
                  `${ingestionName}`
                )
              : getFormattedGuideText(
                  guide.description,
                  `<${t('label.service-name')}>`,
                  serviceName
                )}
          </div>
        </>
      )}
    </>
  );
};

export const getIngestionName = (
  serviceName: string,
  type: IngestionPipelineType
) => {
  if (
    [
      IngestionPipelineType.Profiler,
      IngestionPipelineType.Metadata,
      IngestionPipelineType.Dbt,
    ].includes(type)
  ) {
    return `${serviceName}_${type}_${cryptoRandomString({
      length: 8,
      type: 'alphanumeric',
    })}`;
  } else {
    return `${serviceName}_${type}`;
  }
};

export const shouldTestConnection = (serviceType: string) => {
  return (
    serviceType !== DatabaseServiceType.CustomDatabase &&
    serviceType !== MessagingServiceType.CustomMessaging &&
    serviceType !== DashboardServiceType.CustomDashboard &&
    serviceType !== MlModelServiceType.CustomMlModel &&
    serviceType !== PipelineServiceType.CustomPipeline
  );
};

export const getTestConnectionType = (serviceCat: ServiceCategory) => {
  switch (serviceCat) {
    case ServiceCategory.MESSAGING_SERVICES:
      return ServiceType.Messaging;
    case ServiceCategory.DASHBOARD_SERVICES:
      return ServiceType.Dashboard;
    case ServiceCategory.PIPELINE_SERVICES:
      return ServiceType.Pipeline;
    case ServiceCategory.DATABASE_SERVICES:
    default:
      return ServiceType.Database;
  }
};

export const getServiceCreatedLabel = (serviceCategory: ServiceCategory) => {
  let serviceCat;
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      serviceCat = t('label.database-lowercase');

      break;
    case ServiceCategory.MESSAGING_SERVICES:
      serviceCat = t('label.messaging-lowercase');

      break;
    case ServiceCategory.DASHBOARD_SERVICES:
      serviceCat = t('label.dashboard-lowercase');

      break;

    case ServiceCategory.PIPELINE_SERVICES:
      serviceCat = t('label.pipeline-lowercase');

      break;
    default:
      serviceCat = '';

      break;
  }

  return [serviceCat, t('label.service-lowercase')].join(' ');
};

export const setServiceSchemaCount = (
  data: Database[],
  callback: (value: React.SetStateAction<number>) => void
) => {
  const promises = data.map((database) =>
    getEntityCount('databaseSchemas', database.fullyQualifiedName)
  );

  Promise.allSettled(promises)
    .then((results) => {
      let count = 0;
      results.forEach((result) => {
        if (result.status === PROMISE_STATE.FULFILLED) {
          count += result.value?.paging?.total || 0;
        }
      });
      callback(count);
    })
    .catch((err: AxiosError) => showErrorToast(err));
};

export const setServiceTableCount = (
  data: Database[],
  callback: (value: React.SetStateAction<number>) => void
) => {
  const promises = data.map((database) =>
    getEntityCount('tables', database.fullyQualifiedName)
  );

  Promise.allSettled(promises)
    .then((results) => {
      let count = 0;
      results.forEach((result) => {
        if (result.status === PROMISE_STATE.FULFILLED) {
          count += result.value?.paging?.total || 0;
        }
      });
      callback(count);
    })
    .catch((err: AxiosError) => showErrorToast(err));
};

export const getOptionalFields = (
  service: ServicesType,
  serviceName: ServiceCategory
): JSX.Element => {
  switch (serviceName) {
    case ServiceCategory.MESSAGING_SERVICES: {
      const messagingService = service as MessagingService;

      return (
        <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
          <label className="tw-mb-0">{t('label.broker-plural')}:</label>
          <span
            className=" tw-ml-1 tw-font-normal tw-text-grey-body"
            data-testid="brokers">
            {getBrokers(messagingService.connection?.config)}
          </span>
        </div>
      );
    }
    case ServiceCategory.DASHBOARD_SERVICES: {
      const dashboardService = service as DashboardService;

      return (
        <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
          <label className="tw-mb-0">{t('label.url-uppercase')}:</label>
          <span
            className=" tw-ml-1 tw-font-normal tw-text-grey-body"
            data-testid="dashboard-url">
            {getDashboardURL(dashboardService.connection?.config)}
          </span>
        </div>
      );
    }
    case ServiceCategory.PIPELINE_SERVICES: {
      const pipelineService = service as PipelineService;

      return (
        <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
          <label className="tw-mb-0">{t('label.url-uppercase')}:</label>
          <span
            className=" tw-ml-1 tw-font-normal tw-text-grey-body"
            data-testid="pipeline-url">
            {pipelineService.connection?.config?.hostPort || '--'}
          </span>
        </div>
      );
    }

    case ServiceCategory.ML_MODEL_SERVICES: {
      const mlmodel = service as MlmodelService;

      return (
        <>
          <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
            <label className="tw-mb-0">{t('label.registry')}:</label>
            <span
              className=" tw-ml-1 tw-font-normal tw-text-grey-body"
              data-testid="pipeline-url">
              {mlmodel.connection?.config?.registryUri || '--'}
            </span>
          </div>
          <div className="tw-mb-1 tw-truncate" data-testid="additional-field">
            <label className="tw-mb-0">{t('label.tracking')}:</label>
            <span
              className=" tw-ml-1 tw-font-normal tw-text-grey-body"
              data-testid="pipeline-url">
              {mlmodel.connection?.config?.trackingUri || '--'}
            </span>
          </div>
        </>
      );
    }
    default: {
      return <></>;
    }
  }
};

export const getDeleteEntityMessage = (
  serviceName: string,
  instanceCount: number,
  schemaCount: number,
  tableCount: number
) => {
  const service = serviceName?.slice(0, -1);

  switch (serviceName) {
    case ServiceCategory.DATABASE_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        `${pluralize(instanceCount, t('label.database'))}, ${pluralize(
          schemaCount,
          t('label.schema')
        )} ${t('label.and-lowercase')} ${pluralize(
          tableCount,
          t('label.table')
        )}`
      );

    case ServiceCategory.MESSAGING_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        pluralize(instanceCount, t('label.topic'))
      );

    case ServiceCategory.DASHBOARD_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        pluralize(instanceCount, t('label.dashboard'))
      );

    case ServiceCategory.PIPELINE_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        pluralize(instanceCount, t('label.pipeline'))
      );

    case ServiceCategory.METADATA_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        pluralize(instanceCount, t('label.metadata'))
      );

    case ServiceCategory.OBJECT_STORE_SERVICES:
      return getEntityDeleteMessage(
        service || t('label.service'),
        pluralize(instanceCount, t('label.container'))
      );

    default:
      return;
  }
};

export const getServiceRouteFromServiceType = (type: ServiceTypes) => {
  if (type === 'messagingServices') {
    return GlobalSettingOptions.MESSAGING;
  }
  if (type === 'dashboardServices') {
    return GlobalSettingOptions.DASHBOARDS;
  }
  if (type === 'pipelineServices') {
    return GlobalSettingOptions.PIPELINES;
  }
  if (type === 'mlmodelServices') {
    return GlobalSettingOptions.MLMODELS;
  }
  if (type === 'metadataServices') {
    return GlobalSettingOptions.METADATA;
  }
  if (type === 'objectstoreServices') {
    return GlobalSettingOptions.OBJECT_STORES;
  }

  return GlobalSettingOptions.DATABASES;
};

export const getResourceEntityFromServiceCategory = (
  category: string | ServiceCategory
) => {
  switch (category) {
    case 'dashboards':
    case ServiceCategory.DASHBOARD_SERVICES:
      return ResourceEntity.DASHBOARD_SERVICE;

    case 'databases':
    case ServiceCategory.DATABASE_SERVICES:
      return ResourceEntity.DATABASE_SERVICE;

    case 'mlModels':
    case ServiceCategory.ML_MODEL_SERVICES:
      return ResourceEntity.ML_MODEL_SERVICE;

    case 'messaging':
    case ServiceCategory.MESSAGING_SERVICES:
      return ResourceEntity.MESSAGING_SERVICE;

    case 'pipelines':
    case ServiceCategory.PIPELINE_SERVICES:
      return ResourceEntity.PIPELINE_SERVICE;

    case 'metadata':
    case ServiceCategory.METADATA_SERVICES:
      return ResourceEntity.METADATA_SERVICE;

    case 'objectStores':
    case ServiceCategory.OBJECT_STORE_SERVICES:
      return ResourceEntity.OBJECT_STORE_SERVICE;
  }

  return ResourceEntity.DATABASE_SERVICE;
};

export const getCountLabel = (serviceName: ServiceTypes) => {
  switch (serviceName) {
    case ServiceCategory.DASHBOARD_SERVICES:
      return t('label.dashboard-plural');
    case ServiceCategory.MESSAGING_SERVICES:
      return t('label.topic-plural');
    case ServiceCategory.PIPELINE_SERVICES:
      return t('label.pipeline-plural');
    case ServiceCategory.ML_MODEL_SERVICES:
      return t('label.ml-model-plural');
    case ServiceCategory.OBJECT_STORE_SERVICES:
      return t('label.container-plural');
    case ServiceCategory.DATABASE_SERVICES:
    default:
      return t('label.database-plural');
  }
};

export const getServicePageTabs = (
  serviceName: ServiceTypes,
  instanceCount: number,
  ingestions: IngestionPipeline[],
  servicePermission: OperationPermission
) => {
  const tabs = [];

  if (serviceName !== ServiceCategory.METADATA_SERVICES) {
    tabs.push({
      name: getCountLabel(serviceName),
      isProtected: false,
      position: 1,
      count: instanceCount,
    });
  }

  tabs.push(
    {
      name: t('label.ingestion-plural'),
      isProtected: false,

      position: 2,
      count: ingestions.length,
    },
    {
      name: t('label.connection'),
      isProtected: !servicePermission.EditAll,
      isHidden: !servicePermission.EditAll,
      position: 3,
    }
  );

  return tabs;
};

export const getTestConnectionName = (connectionType: string) => {
  return `test-connection-${connectionType}-${cryptoRandomString({
    length: 8,
    type: 'alphanumeric',
  })}`;
};
