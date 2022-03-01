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

import { AxiosResponse } from 'axios';
import {
  Bucket,
  DynamicFormFieldType,
  DynamicObj,
  ServiceCollection,
  ServiceData,
  ServicesData,
  ServiceTypes,
} from 'Models';
import { getServiceDetails, getServices } from '../axiosAPIs/serviceAPI';
import { ServiceDataObj } from '../components/Modals/AddServiceModal/AddServiceModal';
import {
  AIRFLOW,
  arrServiceTypes,
  ATHENA,
  BIGQUERY,
  DASHBOARD_DEFAULT,
  DATABASE_DEFAULT,
  GLUE,
  HIVE,
  KAFKA,
  LOOKER,
  MARIADB,
  METABASE,
  MSSQL,
  MYSQL,
  ORACLE,
  PIPELINE_DEFAULT,
  POSTGRES,
  PREFECT,
  PRESTO,
  PULSAR,
  REDASH,
  REDSHIFT,
  serviceTypes,
  SNOWFLAKE,
  SUPERSET,
  TABLEAU,
  TOPIC_DEFAULT,
  TRINO,
  VERTICA,
} from '../constants/services.const';
import { TabSpecificField } from '../enums/entity.enum';
import { IngestionType, ServiceCategory } from '../enums/service.enum';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DatabaseServiceType } from '../generated/entity/services/databaseService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { PipelineType } from '../generated/operations/pipelines/airflowPipeline';
import { ApiData } from '../pages/services';

export const serviceTypeLogo = (type: string) => {
  switch (type) {
    case DatabaseServiceType.MySQL:
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

    case DatabaseServiceType.MariaDB:
      return MARIADB;

    case DatabaseServiceType.Vertica:
      return VERTICA;

    case MessagingServiceType.Kafka:
      return KAFKA;

    case MessagingServiceType.Pulsar:
      return PULSAR;

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

    case PipelineServiceType.Airflow:
      return AIRFLOW;

    case PipelineServiceType.Prefect:
      return PREFECT;
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

const getAllServiceList = (
  allServiceCollectionArr: Array<ServiceCollection>
): Promise<Array<ServiceDataObj>> => {
  let listArr = [];

  //   fetch services of all individual collection
  return new Promise<Array<ServiceDataObj>>((resolve, reject) => {
    if (allServiceCollectionArr.length) {
      let promiseArr = [];
      promiseArr = allServiceCollectionArr.map((obj) => {
        return getServices(obj.value);
      });
      Promise.allSettled(promiseArr)
        .then((result: PromiseSettledResult<AxiosResponse>[]) => {
          if (result.length) {
            let serviceArr = [];
            serviceArr = result.map((service) =>
              service.status === 'fulfilled' ? service.value?.data?.data : []
            );
            // converted array of arrays to array
            const allServices = serviceArr.reduce(
              (acc, el) => acc.concat(el),
              []
            );
            listArr = allServices.map((s: ApiData) => {
              return { ...s, ...s.jdbc };
            });
            resolve(listArr);
          } else {
            resolve([]);
          }
        })
        .catch((err) => reject(err));
    } else {
      resolve([]);
    }
  });
};

export const getAllServices = (
  onlyVisibleServices = true
): Promise<Array<ServiceDataObj>> => {
  return new Promise<Array<ServiceDataObj>>((resolve, reject) => {
    getServiceDetails().then((res: AxiosResponse) => {
      let allServiceCollectionArr: Array<ServiceCollection> = [];
      if (res.data.data?.length) {
        const arrServiceCat: Array<{ name: string; value: string }> =
          res.data.data.map((service: ServiceData) => {
            return {
              name: service.collection.name,
              value: service.collection.name,
            };
          });

        if (onlyVisibleServices) {
          allServiceCollectionArr = arrServiceCat.filter((service) =>
            arrServiceTypes.includes(service.name as ServiceTypes)
          );
        } else {
          allServiceCollectionArr = arrServiceCat;
        }
      }
      getAllServiceList(allServiceCollectionArr)
        .then((res) => resolve(res))
        .catch((err) => reject(err));
    });
  });
};

export const getServiceCategoryFromType = (
  type: string
): ServiceTypes | undefined => {
  let serviceCategory;
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

export const getIngestionTypeList = (
  serviceType: string,
  onlyMetaData = false
): Array<string> | undefined => {
  let ingestionType: Array<string> | undefined;
  switch (serviceType) {
    case DatabaseServiceType.BigQuery:
      ingestionType = onlyMetaData
        ? [IngestionType.BIGQUERY]
        : [IngestionType.BIGQUERY, IngestionType.BIGQUERY_USAGE];

      break;
    case DatabaseServiceType.Hive:
      ingestionType = [IngestionType.HIVE];

      break;

    case DatabaseServiceType.Mssql:
      ingestionType = [IngestionType.MSSQL];

      break;

    case DatabaseServiceType.MySQL:
      ingestionType = [IngestionType.MYSQL];

      break;

    case DatabaseServiceType.Postgres:
      ingestionType = [IngestionType.POSTGRES];

      break;

    case DatabaseServiceType.Redshift:
      ingestionType = onlyMetaData
        ? [IngestionType.REDSHIFT]
        : [IngestionType.REDSHIFT, IngestionType.REDSHIFT_USAGE];

      break;

    case DatabaseServiceType.Trino:
      ingestionType = [IngestionType.TRINO];

      break;

    case DatabaseServiceType.Snowflake:
      ingestionType = onlyMetaData
        ? [IngestionType.SNOWFLAKE]
        : [IngestionType.SNOWFLAKE, IngestionType.SNOWFLAKE_USAGE];

      break;

    case DatabaseServiceType.Vertica:
      ingestionType = [IngestionType.VERTICA];

      break;

    default:
      break;
  }

  return ingestionType;
};

export const getAirflowPipelineTypes = (
  serviceType: string,
  onlyMetaData = false
): Array<PipelineType> | undefined => {
  if (onlyMetaData) {
    return [PipelineType.Metadata];
  }
  switch (serviceType) {
    case DatabaseServiceType.Redshift:
    case DatabaseServiceType.BigQuery:
    case DatabaseServiceType.Snowflake:
      return [PipelineType.Metadata, PipelineType.QueryUsage];

    case DatabaseServiceType.Hive:
    case DatabaseServiceType.Mssql:
    case DatabaseServiceType.MySQL:
    case DatabaseServiceType.Postgres:
    case DatabaseServiceType.Trino:
    case DatabaseServiceType.Vertica:
      return [PipelineType.Metadata];

    default:
      return;
  }
};

export const getIsIngestionEnable = (serviceCategory: ServiceCategory) => {
  switch (serviceCategory) {
    case ServiceCategory.DATABASE_SERVICES:
      return true;

    case ServiceCategory.MESSAGING_SERVICES:
    case ServiceCategory.PIPELINE_SERVICES:
    case ServiceCategory.DASHBOARD_SERVICES:
      return false;

    default:
      break;
  }

  return false;
};

export const getKeyValuePair = (obj: DynamicObj) => {
  const newObj = Object.entries(obj).map((v) => {
    return {
      key: v[0],
      value: v[1],
    };
  });

  return newObj;
};

export const getKeyValueObject = (arr: DynamicFormFieldType[]) => {
  const keyValuePair: DynamicObj = {};

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
        data.databaseConnection?.hostPort || ''
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
    name: 'Activity Feed',
    path: 'activity_feed',
    field: TabSpecificField.ACTIVITY_FEED,
  },
  {
    name: 'Ingestions',
    path: 'ingestions',
  },
  {
    name: 'Connection Config',
    path: 'connection_config',
  },
  {
    name: 'Manage',
    path: 'manage',
  },
];

export const getCurrentServiceTab = (tab: string) => {
  let currentTab = 1;
  switch (tab) {
    case 'activity_feed':
      currentTab = 2;

      break;
    case 'ingestions':
      currentTab = 3;

      break;

    case 'connection_config':
      currentTab = 4;

      break;

    case 'manage':
      currentTab = 5;

      break;

    case 'entity':
    default:
      currentTab = 1;

      break;
  }

  return currentTab;
};
