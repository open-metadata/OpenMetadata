/*
 *  Copyright 2026 Collate.
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
import { startCase } from 'lodash';
import { useEffect, useState } from 'react';
import { ExplorePageTabs } from '../enums/Explore.enum';
import { ServiceCategory } from '../enums/service.enum';
import { APIServiceType } from '../generated/entity/services/apiService';
import { DashboardServiceType } from '../generated/entity/services/dashboardService';
import { DriveServiceType } from '../generated/entity/services/driveService';
import { MessagingServiceType } from '../generated/entity/services/messagingService';
import { MlModelServiceType } from '../generated/entity/services/mlmodelService';
import { PipelineServiceType } from '../generated/entity/services/pipelineService';
import { SearchServiceType } from '../generated/entity/services/searchService';
import { Type as SecurityServiceType } from '../generated/entity/services/securityService';
import { StorageServiceType } from '../generated/entity/services/storageService';
import { LANDING_WIDGET_DEFAULT_ICON_URL } from './LandingPageWidgetIconUtils.constants';

const SERVICE_TYPE_LABELS: Record<string, string> = {
  azuresql: 'Azure SQL',
  bigquery: 'Big Query',
  bigtable: 'Big Table',
  customapi: 'Custom API',
  customdashboard: 'Custom Dashboard',
  customdatabase: 'Custom Database',
  customdrive: 'Custom Drive',
  custommessaging: 'Custom Messaging',
  custommlmodel: 'Custom ML Model',
  custompipeline: 'Custom Pipeline',
  customsearch: 'Custom Search',
  customsecurity: 'Custom Security',
  customstorage: 'Custom Storage',
  dbtcloud: 'dbt Cloud',
  deltalake: 'DeltaLake',
  domodashboard: 'Domo Dashboard',
  domodatabase: 'Domo Database',
  dynamodb: 'Dynamo DB',
  mlflow: 'MLflow',
  mongodb: 'Mongo DB',
  mssql: 'MS SQL',
  mysql: 'MySQL',
  pinotdb: 'PinotDB',
  powerbi: 'Power BI',
  powerbireportserver: 'Power BI Report Server',
  qliksense: 'Qlik Sense',
  saperp: 'SAP ERP',
  saphana: 'SAP Hana',
  saps4hana: 'SAP S/4HANA',
  sqlite: 'SQLite',
};

const SERVICE_ICON_IMPORTS: Record<string, () => Promise<{ default: string }>> =
  {
    airflow: () => import('../assets/img/service-icon-airflow.webp'),
    airbyte: () => import('../assets/img/Airbyte.webp'),
    alationsink: () => import('../assets/img/service-icon-alation-sink.webp'),
    amundsen: () => import('../assets/img/service-icon-amundsen.webp'),
    athena: () => import('../assets/img/service-icon-athena.webp'),
    atlas: () => import('../assets/img/service-icon-atlas.svg'),
    azuresql: () => import('../assets/img/service-icon-azuresql.webp'),
    bigquery: () => import('../assets/img/service-icon-query.webp'),
    bigtable: () => import('../assets/img/service-icon-bigtable.webp'),
    burstiq: () => import('../assets/img/service-icon-burstiq.webp'),
    cassandra: () => import('../assets/img/service-icon-cassandra.webp'),
    clickhouse: () => import('../assets/img/service-icon-clickhouse.webp'),
    cockroach: () => import('../assets/img/service-icon-cockroach.webp'),
    couchbase: () => import('../assets/img/service-icon-couchbase.svg'),
    dagster: () => import('../assets/img/service-icon-dagster.webp'),
    databricks: () => import('../assets/img/service-icon-databrick.webp'),
    databrickspipeline: () =>
      import('../assets/img/service-icon-databrick.webp'),
    datalake: () => import('../assets/img/service-icon-datalake.webp'),
    dbtcloud: () => import('../assets/img/service-icon-dbt.webp'),
    deltalake: () => import('../assets/img/service-icon-delta-lake.webp'),
    domodashboard: () => import('../assets/img/service-icon-domo.webp'),
    domodatabase: () => import('../assets/img/service-icon-domo.webp'),
    domopipeline: () => import('../assets/img/service-icon-domo.webp'),
    doris: () => import('../assets/img/service-icon-doris.webp'),
    druid: () => import('../assets/img/service-icon-druid.webp'),
    dynamodb: () => import('../assets/img/service-icon-dynamodb.webp'),
    elasticsearch: () => import('../assets/svg/elasticsearch.svg'),
    exasol: () => import('../assets/img/service-icon-exasol.webp'),
    fivetran: () => import('../assets/img/service-icon-fivetran.webp'),
    flink: () => import('../assets/img/service-icon-flink.webp'),
    gcs: () => import('../assets/img/service-icon-gcs.webp'),
    glue: () => import('../assets/img/service-icon-glue.webp'),
    gluepipeline: () => import('../assets/img/service-icon-glue.webp'),
    googledrive: () => import('../assets/svg/service-icon-google-drive.svg'),
    grafana: () => import('../assets/img/service-icon-grafana.webp'),
    greenplum: () => import('../assets/img/service-icon-greenplum.webp'),
    hex: () => import('../assets/svg/service-icon-hex.svg'),
    hive: () => import('../assets/img/service-icon-hive.webp'),
    impala: () => import('../assets/img/service-icon-impala.webp'),
    iomete: () => import('../assets/img/service-icon-iomete.webp'),
    kafka: () => import('../assets/img/service-icon-kafka.webp'),
    kafkaconnect: () => import('../assets/img/service-icon-kafka.webp'),
    kinesis: () => import('../assets/img/service-icon-kinesis.webp'),
    lightdash: () => import('../assets/img/service-icon-lightdash.webp'),
    looker: () => import('../assets/img/service-icon-looker.webp'),
    mariadb: () => import('../assets/img/service-icon-mariadb.webp'),
    metabase: () => import('../assets/img/service-icon-metabase.webp'),
    microstrategy: () => import('../assets/img/service-icon-microstrategy.svg'),
    mlflow: () => import('../assets/svg/service-icon-mlflow.svg'),
    mongodb: () => import('../assets/img/service-icon-mongodb.webp'),
    mssql: () => import('../assets/img/service-icon-mssql.webp'),
    mysql: () => import('../assets/img/service-icon-sql.webp'),
    nifi: () => import('../assets/img/service-icon-nifi.webp'),
    opensearch: () => import('../assets/svg/open-search.svg'),
    openlineage: () => import('../assets/img/service-icon-openlineage.svg'),
    oracle: () => import('../assets/img/service-icon-oracle.webp'),
    pinotdb: () => import('../assets/img/service-icon-pinot.webp'),
    postgres: () => import('../assets/img/service-icon-post.webp'),
    powerbi: () => import('../assets/img/service-icon-power-bi.webp'),
    presto: () => import('../assets/img/service-icon-presto.webp'),
    pubsub: () => import('../assets/svg/service-icon-pubsub.svg'),
    qliksense: () => import('../assets/img/service-icon-qlik-sense.webp'),
    questdb: () => import('../assets/img/service-icon-questdb.webp'),
    quicksight: () => import('../assets/img/service-icon-quicksight.webp'),
    redash: () => import('../assets/img/service-icon-redash.webp'),
    redpanda: () => import('../assets/img/service-icon-redpanda.webp'),
    redshift: () => import('../assets/img/service-icon-redshift.webp'),
    rest: () => import('../assets/svg/ic-service-rest-api.svg'),
    s3: () => import('../assets/img/service-icon-amazon-s3.svg'),
    sagemaker: () => import('../assets/img/service-icon-sagemaker.webp'),
    salesforce: () => import('../assets/img/service-icon-salesforce.webp'),
    saperp: () => import('../assets/img/service-icon-sap-erp.webp'),
    saphana: () => import('../assets/img/service-icon-sap-hana.webp'),
    sas: () => import('../assets/img/service-icon-sas.svg'),
    scikit: () => import('../assets/img/service-icon-scikit.webp'),
    sftp: () => import('../assets/svg/service-icon-sftp.svg'),
    sigma: () => import('../assets/img/service-icon-sigma.webp'),
    singlestore: () => import('../assets/img/service-icon-singlestore.webp'),
    snowflake: () => import('../assets/img/service-icon-snowflakes.webp'),
    spark: () => import('../assets/img/service-icon-spark.webp'),
    spline: () => import('../assets/img/service-icon-spline.webp'),
    sqlite: () => import('../assets/img/service-icon-sqlite.webp'),
    ssrs: () => import('../assets/img/service-icon-ssrs.webp'),
    starrocks: () => import('../assets/img/service-icon-starrocks.webp'),
    superset: () => import('../assets/img/service-icon-superset.webp'),
    tableau: () => import('../assets/img/service-icon-tableau.webp'),
    teradata: () => import('../assets/svg/teradata.svg'),
    timescale: () => import('../assets/img/service-icon-timescale.webp'),
    trino: () => import('../assets/img/service-icon-trino.webp'),
    unitycatalog: () => import('../assets/img/service-icon-unitycatalog.svg'),
    vertica: () => import('../assets/img/service-icon-vertica.webp'),
  };

const DEFAULT_ICON_IMPORTS: Partial<
  Record<
    ServiceCategory,
    () => Promise<{
      default: string;
    }>
  >
> = {
  [ServiceCategory.API_SERVICES]: () =>
    import('../assets/svg/ic-service-rest-api.svg'),
  [ServiceCategory.DASHBOARD_SERVICES]: () =>
    import('../assets/svg/dashboard.svg'),
  [ServiceCategory.DATABASE_SERVICES]: () =>
    import('../assets/svg/ic-custom-database.svg'),
  [ServiceCategory.DRIVE_SERVICES]: () =>
    import('../assets/svg/ic-drive-service.svg'),
  [ServiceCategory.ML_MODEL_SERVICES]: () =>
    import('../assets/svg/ic-custom-model.svg'),
  [ServiceCategory.PIPELINE_SERVICES]: () =>
    import('../assets/svg/pipeline.svg'),
  [ServiceCategory.SEARCH_SERVICES]: () =>
    import('../assets/svg/ic-custom-search.svg'),
  [ServiceCategory.SECURITY_SERVICES]: () =>
    import('../assets/svg/security-safe.svg'),
  [ServiceCategory.STORAGE_SERVICES]: () =>
    import('../assets/svg/ic-custom-storage.svg'),
  [ServiceCategory.MESSAGING_SERVICES]: () => import('../assets/svg/topic.svg'),
};

type ServiceTypeEnum = Record<string, string>;

const normalizeServiceType = (serviceType: string) =>
  serviceType.toLowerCase().replaceAll(/[_\s-]/g, '');

const matchesLegacyServiceKey = (
  normalizedServiceType: string,
  legacyKeys: string[] = []
) => legacyKeys.includes(normalizedServiceType);

const isGeneratedServiceType = (
  normalizedServiceType: string,
  serviceTypes: ServiceTypeEnum,
  ignoredServiceTypes: string[] = []
) => {
  const ignoredKeys = ignoredServiceTypes.map(normalizeServiceType);

  return Object.values(serviceTypes).some(
    (serviceType) =>
      normalizeServiceType(serviceType) === normalizedServiceType &&
      !ignoredKeys.includes(normalizedServiceType)
  );
};

export const getDataAssetServiceCategory = (
  serviceType: string
): ServiceCategory => {
  const normalizedServiceType = normalizeServiceType(serviceType);

  if (isGeneratedServiceType(normalizedServiceType, MessagingServiceType)) {
    return ServiceCategory.MESSAGING_SERVICES;
  }
  if (
    isGeneratedServiceType(normalizedServiceType, DashboardServiceType, [
      DashboardServiceType.QlikCloud,
    ])
  ) {
    return ServiceCategory.DASHBOARD_SERVICES;
  }
  if (
    isGeneratedServiceType(normalizedServiceType, PipelineServiceType, [
      PipelineServiceType.DomoPipeline,
      PipelineServiceType.KinesisFirehose,
    ])
  ) {
    return ServiceCategory.PIPELINE_SERVICES;
  }
  if (
    matchesLegacyServiceKey(normalizedServiceType, ['scikit']) ||
    isGeneratedServiceType(normalizedServiceType, MlModelServiceType, [
      MlModelServiceType.Sklearn,
    ])
  ) {
    return ServiceCategory.ML_MODEL_SERVICES;
  }
  if (isGeneratedServiceType(normalizedServiceType, StorageServiceType)) {
    return ServiceCategory.STORAGE_SERVICES;
  }
  if (isGeneratedServiceType(normalizedServiceType, SearchServiceType)) {
    return ServiceCategory.SEARCH_SERVICES;
  }
  if (
    matchesLegacyServiceKey(normalizedServiceType, ['customapi']) ||
    isGeneratedServiceType(normalizedServiceType, APIServiceType)
  ) {
    return ServiceCategory.API_SERVICES;
  }
  if (isGeneratedServiceType(normalizedServiceType, DriveServiceType)) {
    return ServiceCategory.DRIVE_SERVICES;
  }
  if (
    matchesLegacyServiceKey(normalizedServiceType, ['customsecurity']) ||
    isGeneratedServiceType(normalizedServiceType, SecurityServiceType)
  ) {
    return ServiceCategory.SECURITY_SERVICES;
  }

  return ServiceCategory.DATABASE_SERVICES;
};

export const getDataAssetExploreTab = (
  serviceType: string
): ExplorePageTabs => {
  const category = getDataAssetServiceCategory(serviceType);

  const tabByCategory: Partial<Record<ServiceCategory, ExplorePageTabs>> = {
    [ServiceCategory.API_SERVICES]: ExplorePageTabs.API_ENDPOINT,
    [ServiceCategory.DASHBOARD_SERVICES]: ExplorePageTabs.DASHBOARDS,
    [ServiceCategory.DATABASE_SERVICES]: ExplorePageTabs.TABLES,
    [ServiceCategory.DRIVE_SERVICES]: ExplorePageTabs.DIRECTORIES,
    [ServiceCategory.ML_MODEL_SERVICES]: ExplorePageTabs.MLMODELS,
    [ServiceCategory.PIPELINE_SERVICES]: ExplorePageTabs.PIPELINES,
    [ServiceCategory.SEARCH_SERVICES]: ExplorePageTabs.SEARCH_INDEX,
    [ServiceCategory.SECURITY_SERVICES]: ExplorePageTabs.TABLES,
    [ServiceCategory.STORAGE_SERVICES]: ExplorePageTabs.CONTAINERS,
    [ServiceCategory.MESSAGING_SERVICES]: ExplorePageTabs.TOPICS,
  };

  return tabByCategory[category] ?? ExplorePageTabs.TABLES;
};

export const getFormattedDataAssetServiceType = (serviceType: string) => {
  const normalizedServiceType = normalizeServiceType(serviceType);

  return (
    SERVICE_TYPE_LABELS[normalizedServiceType] ??
    startCase(serviceType.replaceAll(/[_-]/g, ' '))
  );
};

export const DataAssetServiceLogo = ({
  serviceType,
  className = '',
}: {
  serviceType: string;
  className?: string;
}): JSX.Element | null => {
  const category = getDataAssetServiceCategory(serviceType);
  const normalizedServiceType = normalizeServiceType(serviceType);
  const [logo, setLogo] = useState<string>(LANDING_WIDGET_DEFAULT_ICON_URL);

  useEffect(() => {
    let isMounted = true;
    const defaultIconImport =
      DEFAULT_ICON_IMPORTS[category] ??
      DEFAULT_ICON_IMPORTS[ServiceCategory.DATABASE_SERVICES];
    const loadIcon =
      SERVICE_ICON_IMPORTS[normalizedServiceType] ?? defaultIconImport;

    loadIcon?.()
      .then((icon) => {
        if (isMounted) {
          setLogo(icon.default);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLogo(LANDING_WIDGET_DEFAULT_ICON_URL);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [category, normalizedServiceType]);

  return <img alt="" className={className} src={logo} />;
};
