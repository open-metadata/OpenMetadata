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

import { uuid } from '../common/common';

export const MYDATA_SUMMARY_OPTIONS = {
  tables: 'tables',
  topics: 'topics',
  dashboards: 'dashboards',
  pipelines: 'pipelines',
  service: 'service',
  user: 'user',
  terms: 'terms',
};

export const SEARCH_ENTITY_TABLE = {
  table_1: { term: 'raw_customer', entity: MYDATA_SUMMARY_OPTIONS.tables },
  table_2: { term: 'fact_session', entity: MYDATA_SUMMARY_OPTIONS.tables },
  table_3: {
    term: 'raw_product_catalog',
    entity: MYDATA_SUMMARY_OPTIONS.tables,
  },
};

export const SEARCH_ENTITY_TOPIC = {
  topic_1: {
    term: 'shop_products',
    entity: MYDATA_SUMMARY_OPTIONS.topics,
  },
  topic_2: { term: 'orders', entity: MYDATA_SUMMARY_OPTIONS.topics },
};

export const SEARCH_ENTITY_DASHBOARD = {
  dashboard_1: {
    term: 'Slack Dashboard',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
  dashboard_2: {
    term: 'Unicode Test',
    entity: MYDATA_SUMMARY_OPTIONS.dashboards,
  },
};

export const SEARCH_ENTITY_PIPELINE = {
  pipeline_1: { term: 'Snowflake ETL', entity: MYDATA_SUMMARY_OPTIONS.pipelines },
  pipeline_2: {
    term: 'Hive ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
  },
  pipeline_3: {
    term: 'Trino ETL',
    entity: MYDATA_SUMMARY_OPTIONS.pipelines,
  },
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

export const TOTAL_SAMPLE_DATA_TEAMS_COUNT = 7;
export const TEAMS = {
  Cloud_Infra: { name: 'Cloud_Infra', users: 15 },
  Customer_Support: { name: 'Customer_Support', users: 20 },
  Data_Platform: { name: 'Data_Platform', users: 16 },
};

export const NEW_TEAM = {
  team_1: {
    name: 'account',
    display_name: 'Account',
    description: 'Account department',
  },
  team_2: {
    name: 'service',
    display_name: 'Service',
    description: 'Service department',
  },
};
const id = uuid();
export const NEW_USER = {
  email: `test_${id}@gmail.com`,
  display_name: `Test user ${id}`,
  description: 'Hello, I am test user',
};

export const NEW_ADMIN = {
  email: `test_${id}@gmail.com`,
  display_name: `Test admin ${id}`,
  description: 'Hello, I am test admin',
};

export const NEW_TAG_CATEGORY = {
  name: 'TestCategory',
  description: 'This is the TestCategory',
};
export const NEW_TAG = {
  name: 'test',
  description: 'This is the Test tag',
};

export const NEW_GLOSSARY = {
  name: 'Business Glossary',
  description: 'This is the Business glossary',
};
export const NEW_GLOSSARY_TERMS = {
  term_1: {
    name: 'Purchase',
    description: 'This is the Purchase',
    synonyms: 'buy,collect,acquire',
  },
  term_2: {
    name: 'Sales',
    description: 'This is the Sales',
    synonyms: 'give,disposal,deal',
  },
};
