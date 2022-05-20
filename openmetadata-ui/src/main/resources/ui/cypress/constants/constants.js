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

export const MYDATA_SUMMARY_OPTIONS = {
  tables: 'tables',
  topics: 'topics',
  dashboards: 'dashboards',
  pipelines: 'pipelines',
  service: 'service',
  user: 'user',
  terms: 'terms',
};

export const SEARCH_TERMS = {
  raw_product_catalog: {
    term: 'raw_product_catalog',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
  },
  raw_customer: { term: 'raw_customer', entity: MYDATA_SUMMARY_OPTIONS.tables },
  fact_session: { term: 'fact_session', entity: MYDATA_SUMMARY_OPTIONS.tables },
  sales: { term: 'sales', entity: MYDATA_SUMMARY_OPTIONS.topics },
  orders: { term: 'orders', entity: MYDATA_SUMMARY_OPTIONS.topics },
  eta_predictions_performance: {
    term: 'ETA Predictions Performance',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
  video_game_sales: {
    term: 'Video Game Sales',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
  unicode_test: {
    term: 'Unicode Test',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
  snowflake_etl: {
    term: 'Snowflake ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
  },
  hive_etl: { term: 'Hive ETL', entity: MYDATA_SUMMARY_OPTIONS.pipelines },
};

export const DELETE_ENTITY = {
  table: {
    term: 'fact_line_item',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
  },
  topic: {
    term: 'shop_updates',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
  },
  dashboard: {
    term: 'Misc Charts',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
  pipeline: {
    term: 'Presto ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
  },
};

export const RECENT_SEARCH_TITLE = 'Recent Search Terms';
export const RECENT_VIEW_TITLE = 'Recent Views';
export const MY_DATA_TITLE = 'My Data';
export const FOLLOWING_TITLE = 'Following';

export const NO_SEARCHED_TERMS = 'No searched terms';
export const DELETE_TERM = 'DELETE';
