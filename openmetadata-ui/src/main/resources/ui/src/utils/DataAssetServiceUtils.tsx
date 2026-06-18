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

type DataAssetServiceCategory =
  | 'api'
  | 'dashboard'
  | 'database'
  | 'drive'
  | 'mlmodel'
  | 'pipeline'
  | 'search'
  | 'security'
  | 'storage'
  | 'topic';

const DATABASE_SERVICE_TYPES = new Set([
  'athena',
  'azuresql',
  'bigquery',
  'bigtable',
  'burstiq',
  'cassandra',
  'clickhouse',
  'cockroach',
  'couchbase',
  'customdatabase',
  'databricks',
  'datalake',
  'db2',
  'dbt',
  'deltalake',
  'dremio',
  'domodatabase',
  'doris',
  'druid',
  'dynamodb',
  'epic',
  'exasol',
  'glue',
  'greenplum',
  'hive',
  'iceberg',
  'impala',
  'informix',
  'iomete',
  'mariadb',
  'microsoftaccess',
  'microsoftfabric',
  'mongodb',
  'mssql',
  'mysql',
  'oracle',
  'pinotdb',
  'postgres',
  'presto',
  'querylog',
  'questdb',
  'redshift',
  'salesforce',
  'saperp',
  'saphana',
  'sapsuccessfactors',
  'sas',
  'servicenow',
  'singlestore',
  'snowflake',
  'sqlite',
  'ssas',
  'starrocks',
  'synapse',
  'teradata',
  'timescale',
  'trino',
  'unitycatalog',
  'vertica',
]);

const MESSAGING_SERVICE_TYPES = new Set([
  'custommessaging',
  'kafka',
  'kinesis',
  'pubsub',
  'redpanda',
]);

const DASHBOARD_SERVICE_TYPES = new Set([
  'customdashboard',
  'domodashboard',
  'grafana',
  'hex',
  'lightdash',
  'looker',
  'metabase',
  'microstrategy',
  'mode',
  'powerbi',
  'powerbireportserver',
  'qliksense',
  'quicksight',
  'redash',
  'saps4hana',
  'sigma',
  'ssrs',
  'superset',
  'tableau',
  'thoughtspot',
]);

const PIPELINE_SERVICE_TYPES = new Set([
  'airbyte',
  'airflow',
  'custompipeline',
  'dagster',
  'datafactory',
  'databrickspipeline',
  'dbtcloud',
  'fivetran',
  'flink',
  'gluepipeline',
  'kafkaconnect',
  'matillion',
  'microsoftfabricpipeline',
  'mulesoft',
  'nifi',
  'openlineage',
  'snowplow',
  'spark',
  'spline',
  'ssis',
  'stitch',
  'wherescape',
]);

const ML_MODEL_SERVICE_TYPES = new Set([
  'custommlmodel',
  'mlflow',
  'sagemaker',
  'scikit',
  'vertexai',
]);

const STORAGE_SERVICE_TYPES = new Set([
  'adls',
  'customstorage',
  'gcs',
  's3',
]);

const SEARCH_SERVICE_TYPES = new Set([
  'customsearch',
  'elasticsearch',
  'opensearch',
]);

const API_SERVICE_TYPES = new Set(['customapi', 'rest', 'webhook']);

const DRIVE_SERVICE_TYPES = new Set([
  'customdrive',
  'googledrive',
  'sftp',
  'sharepoint',
]);

const SECURITY_SERVICE_TYPES = new Set(['customsecurity', 'ranger']);

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
    alationsink: () =>
      import('../assets/img/service-icon-alation-sink.webp'),
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
    microstrategy: () =>
      import('../assets/img/service-icon-microstrategy.svg'),
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
    unitycatalog: () =>
      import('../assets/img/service-icon-unitycatalog.svg'),
    vertica: () => import('../assets/img/service-icon-vertica.webp'),
  };

const DEFAULT_ICON_IMPORTS: Record<
  DataAssetServiceCategory,
  () => Promise<{ default: string }>
> = {
  api: () => import('../assets/svg/ic-service-rest-api.svg'),
  dashboard: () => import('../assets/svg/dashboard.svg'),
  database: () => import('../assets/svg/ic-custom-database.svg'),
  drive: () => import('../assets/svg/ic-drive-service.svg'),
  mlmodel: () => import('../assets/svg/ic-custom-model.svg'),
  pipeline: () => import('../assets/svg/pipeline.svg'),
  search: () => import('../assets/svg/ic-custom-search.svg'),
  security: () => import('../assets/svg/security-safe.svg'),
  storage: () => import('../assets/svg/ic-custom-storage.svg'),
  topic: () => import('../assets/svg/topic.svg'),
};

const normalizeServiceType = (serviceType: string) =>
  serviceType.toLowerCase().replaceAll(/[_\s-]/g, '');

export const getDataAssetServiceCategory = (
  serviceType: string
): DataAssetServiceCategory => {
  const normalizedServiceType = normalizeServiceType(serviceType);

  if (MESSAGING_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'topic';
  }
  if (DASHBOARD_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'dashboard';
  }
  if (PIPELINE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'pipeline';
  }
  if (ML_MODEL_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'mlmodel';
  }
  if (STORAGE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'storage';
  }
  if (SEARCH_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'search';
  }
  if (API_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'api';
  }
  if (DRIVE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'drive';
  }
  if (SECURITY_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'security';
  }

  if (DATABASE_SERVICE_TYPES.has(normalizedServiceType)) {
    return 'database';
  }

  return 'database';
};

export const getDataAssetExploreTab = (serviceType: string): ExplorePageTabs => {
  const category = getDataAssetServiceCategory(serviceType);

  const tabByCategory: Record<DataAssetServiceCategory, ExplorePageTabs> = {
    api: ExplorePageTabs.API_ENDPOINT,
    dashboard: ExplorePageTabs.DASHBOARDS,
    database: ExplorePageTabs.TABLES,
    drive: ExplorePageTabs.TABLES,
    mlmodel: ExplorePageTabs.MLMODELS,
    pipeline: ExplorePageTabs.PIPELINES,
    search: ExplorePageTabs.SEARCH_INDEX,
    security: ExplorePageTabs.TABLES,
    storage: ExplorePageTabs.CONTAINERS,
    topic: ExplorePageTabs.TOPICS,
  };

  return tabByCategory[category];
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
  const [logo, setLogo] = useState<string>();

  useEffect(() => {
    let isMounted = true;
    const loadIcon =
      SERVICE_ICON_IMPORTS[normalizedServiceType] ??
      DEFAULT_ICON_IMPORTS[category];

    loadIcon()
      .then((icon) => {
        if (isMounted) {
          setLogo(icon.default);
        }
      })
      .catch(() => {
        if (isMounted) {
          setLogo(undefined);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [category, normalizedServiceType]);

  return logo ? <img alt="" className={className} src={logo} /> : null;
};
