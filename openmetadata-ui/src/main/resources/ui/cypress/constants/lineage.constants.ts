/*
 *  Copyright 2024 Collate.
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
import { DATA_ASSETS, SEARCH_INDEX } from './constants';

export const PIPELINE_SUPPORTED_TYPES = ['Table', 'Topic'];

export const LINEAGE_ITEMS = [
  {
    term: 'marketing',
    displayName: 'marketing',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    entityType: 'Table',
    fqn: 'sample_data.ecommerce_db.shopify.marketing',
    searchIndex: SEARCH_INDEX.tables,
    columns: ['sample_data.ecommerce_db.shopify.marketing.ad_id'],
  },
  {
    term: 'fact_session',
    displayName: 'fact_session',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    schemaName: 'shopify',
    entityType: 'Table',
    fqn: 'sample_data.ecommerce_db.shopify.fact_session',
    searchIndex: SEARCH_INDEX.tables,
    columns: ['sample_data.ecommerce_db.shopify.fact_session.shop_id'],
  },
  {
    term: 'shop_products',
    displayName: 'shop_products',
    entity: DATA_ASSETS.topics,
    serviceName: 'sample_kafka',
    fqn: 'sample_kafka.shop_products',
    entityType: 'Topic',
    searchIndex: SEARCH_INDEX.topics,
    columns: ['sample_kafka.shop_products.Shop.shop_id'],
  },
  {
    term: 'forecast_sales',
    entity: DATA_ASSETS.mlmodels,
    serviceName: 'mlflow_svc',
    entityType: 'ML Model',
    fqn: 'mlflow_svc.forecast_sales',
    searchIndex: SEARCH_INDEX.mlmodels,
    columns: [],
  },
  {
    term: 'transactions',
    entity: DATA_ASSETS.containers,
    serviceName: 's3_storage_sample',
    entityType: 'Container',
    fqn: 's3_storage_sample.transactions',
    searchIndex: SEARCH_INDEX.containers,
    columns: ['s3_storage_sample.transactions.transaction_id'],
  },
  {
    term: 'customers',
    entity: DATA_ASSETS.dashboards,
    serviceName: 'sample_looker',
    entityType: 'Dashboard',
    fqn: 'sample_looker.customers',
    searchIndex: SEARCH_INDEX.dashboards,
    columns: ['sample_looker.chart_1'],
  },
];

export const PIPELINE_ITEMS = [
  {
    term: 'dim_location_etl',
    name: 'dim_location etl',
    entity: DATA_ASSETS.pipelines,
    fqn: 'sample_airflow.dim_location_etl',
    searchIndex: SEARCH_INDEX.pipelines,
  },
  {
    term: 'dim_address_etl',
    name: 'dim_address etl',
    entity: DATA_ASSETS.pipelines,
    fqn: 'sample_airflow.dim_address_etl',
    searchIndex: SEARCH_INDEX.pipelines,
  },
];
