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
  ServiceTypes,
} from 'Models';
import { getServiceDetails, getServices } from '../axiosAPIs/serviceAPI';
import { ServiceDataObj } from '../components/Modals/AddServiceModal/AddServiceModal';
import {
  AIRFLOW,
  ATHENA,
  BIGQUERY,
  GLUE,
  HIVE,
  KAFKA,
  LOOKER,
  MARIADB,
  METABASE,
  MSSQL,
  MYSQL,
  ORACLE,
  POSTGRES,
  PREFECT,
  PRESTO,
  PULSAR,
  REDASH,
  REDSHIFT,
  serviceTypes,
  SERVICE_DEFAULT,
  SNOWFLAKE,
  SUPERSET,
  TABLEAU,
  TRINO,
  VERTICA,
} from '../constants/services.const';
import {
  DashboardServiceType,
  DatabaseServiceType,
  IngestionType,
  MessagingServiceType,
  PipelineServiceType,
  ServiceCategory,
} from '../enums/service.enum';
import { PipelineType } from '../generated/operations/pipelines/airflowPipeline';
import { ApiData } from '../pages/services';

export const serviceTypeLogo = (type: string) => {
  switch (type) {
    case DatabaseServiceType.MYSQL:
      return MYSQL;

    case DatabaseServiceType.REDSHIFT:
      return REDSHIFT;

    case DatabaseServiceType.BIGQUERY:
      return BIGQUERY;

    case DatabaseServiceType.HIVE:
      return HIVE;

    case DatabaseServiceType.POSTGRES:
      return POSTGRES;

    case DatabaseServiceType.ORACLE:
      return ORACLE;

    case DatabaseServiceType.SNOWFLAKE:
      return SNOWFLAKE;

    case DatabaseServiceType.MSSQL:
      return MSSQL;

    case DatabaseServiceType.ATHENA:
      return ATHENA;

    case DatabaseServiceType.PRESTO:
      return PRESTO;

    case DatabaseServiceType.TRINO:
      return TRINO;

    case DatabaseServiceType.GLUE:
      return GLUE;

    case DatabaseServiceType.MARIADB:
      return MARIADB;

    case DatabaseServiceType.VERTICA:
      return VERTICA;

    case MessagingServiceType.KAFKA:
      return KAFKA;

    case MessagingServiceType.PULSAR:
      return PULSAR;

    case DashboardServiceType.SUPERSET:
      return SUPERSET;

    case DashboardServiceType.LOOKER:
      return LOOKER;

    case DashboardServiceType.TABLEAU:
      return TABLEAU;

    case DashboardServiceType.REDASH:
      return REDASH;

    case DashboardServiceType.METABASE:
      return METABASE;

    case PipelineServiceType.AIRFLOW:
      return AIRFLOW;

    case PipelineServiceType.PREFECT:
      return PREFECT;
    default:
      return SERVICE_DEFAULT;
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

export const getAllServices = (): Promise<Array<ServiceDataObj>> => {
  return new Promise<Array<ServiceDataObj>>((resolve, reject) => {
    getServiceDetails().then((res: AxiosResponse) => {
      let allServiceCollectionArr: Array<ServiceCollection> = [];
      if (res.data.data?.length) {
        allServiceCollectionArr = res.data.data.map((service: ServiceData) => {
          return {
            name: service.collection.name,
            value: service.collection.name,
          };
        });
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
    switch (bucket.key) {
      case DatabaseServiceType.ATHENA:
      case DatabaseServiceType.BIGQUERY:
      case DatabaseServiceType.HIVE:
      case DatabaseServiceType.MSSQL:
      case DatabaseServiceType.MYSQL:
      case DatabaseServiceType.ORACLE:
      case DatabaseServiceType.POSTGRES:
      case DatabaseServiceType.PRESTO:
      case DatabaseServiceType.TRINO:
      case DatabaseServiceType.GLUE:
      case DatabaseServiceType.MARIADB:
      case DatabaseServiceType.VERTICA:
      case DatabaseServiceType.REDSHIFT:
      case DatabaseServiceType.SNOWFLAKE:
        entityCounts.tableCount += bucket.doc_count;

        break;
      case MessagingServiceType.KAFKA:
      case MessagingServiceType.PULSAR:
        entityCounts.topicCount += bucket.doc_count;

        break;
      case DashboardServiceType.SUPERSET:
      case DashboardServiceType.LOOKER:
      case DashboardServiceType.TABLEAU:
      case DashboardServiceType.REDASH:
      case DashboardServiceType.METABASE:
        entityCounts.dashboardCount += bucket.doc_count;

        break;
      case PipelineServiceType.AIRFLOW:
      case PipelineServiceType.PREFECT:
        entityCounts.pipelineCount += bucket.doc_count;

        break;
      default:
        break;
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
    case DatabaseServiceType.BIGQUERY:
      ingestionType = onlyMetaData
        ? [IngestionType.BIGQUERY]
        : [IngestionType.BIGQUERY, IngestionType.BIGQUERY_USAGE];

      break;
    case DatabaseServiceType.HIVE:
      ingestionType = [IngestionType.HIVE];

      break;

    case DatabaseServiceType.MSSQL:
      ingestionType = [IngestionType.MSSQL];

      break;

    case DatabaseServiceType.MYSQL:
      ingestionType = [IngestionType.MYSQL];

      break;

    case DatabaseServiceType.POSTGRES:
      ingestionType = [IngestionType.POSTGRES];

      break;

    case DatabaseServiceType.REDSHIFT:
      ingestionType = onlyMetaData
        ? [IngestionType.REDSHIFT]
        : [IngestionType.REDSHIFT, IngestionType.REDSHIFT_USAGE];

      break;

    case DatabaseServiceType.TRINO:
      ingestionType = [IngestionType.TRINO];

      break;

    case DatabaseServiceType.SNOWFLAKE:
      ingestionType = onlyMetaData
        ? [IngestionType.SNOWFLAKE]
        : [IngestionType.SNOWFLAKE, IngestionType.SNOWFLAKE_USAGE];

      break;

    case DatabaseServiceType.VERTICA:
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
    case DatabaseServiceType.REDSHIFT:
    case DatabaseServiceType.BIGQUERY:
    case DatabaseServiceType.SNOWFLAKE:
      return [PipelineType.Metadata, PipelineType.QueryUsage];

    case DatabaseServiceType.HIVE:
    case DatabaseServiceType.MSSQL:
    case DatabaseServiceType.MYSQL:
    case DatabaseServiceType.POSTGRES:
    case DatabaseServiceType.TRINO:
    case DatabaseServiceType.VERTICA:
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
