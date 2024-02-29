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

import { GlobalSettingOptions } from './settings.constant';

export const uuid = () => Cypress._.random(0, 1e6);
const id = uuid();

export const BASE_URL = location.origin;

export const LOGIN_ERROR_MESSAGE =
  'You have entered an invalid username or password.';

export const DATA_ASSETS = {
  tables: 'tables',
  topics: 'topics',
  dashboards: 'dashboards',
  pipelines: 'pipelines',
  mlmodels: 'mlmodels',
  service: 'service',
  user: 'user',
  teams: 'teams',
  testSuite: 'test-suite',
  containers: 'containers',
  glossaryTerms: 'glossary-terms',
  tags: 'tags',
  storedProcedures: 'storedProcedures',
  dataModel: 'dashboardDataModel',
  searchIndexes: 'searchIndexes',
};
export const EXPLORE_PAGE_TABS = {
  mlmodels: 'ml models',
  storedProcedures: 'stored procedures',
  dataProducts: 'data products',
  dataModel: 'dashboard data models',
  searchIndexes: 'search indexes',
};

export const SEARCH_INDEX = {
  tables: 'table_search_index',
  topics: 'topic_search_index',
  dashboards: 'dashboard_search_index',
  pipelines: 'pipeline_search_index',
  mlmodels: 'mlmodel_search_index',
  containers: 'container_search_index',
  searchIndexes: 'search_entity_search_index',
};

export const DATA_QUALITY_SAMPLE_DATA_TABLE = {
  term: 'dim_address',
  entity: DATA_ASSETS.tables,
  serviceName: 'sample_data',
  testCaseName: 'column_value_max_to_be_between',
  sqlTestCaseName: 'my_sql_test_case_cypress',
  sqlTestCase: 'Custom SQL Query',
  sqlQuery: 'Select * from dim_address',
};

export const COLUMN_NAME_FOR_APPLY_GLOSSARY_TERM = 'customer';

export const SEARCH_ENTITY_TABLE = {
  table_1: {
    term: 'raw_customer',
    displayName: 'raw_customer',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    entityType: 'Table',
  },
  table_2: {
    term: 'fact_session',
    displayName: 'fact_session',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    schemaName: 'shopify',
    entityType: 'Table',
  },
  table_3: {
    term: 'raw_product_catalog',
    displayName: 'raw_product_catalog',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    schemaName: 'shopify',
    entityType: 'Table',
  },
  table_4: {
    term: 'dim_address',
    displayName: 'dim_address',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    entityType: 'Table',
  },
  table_5: {
    term: 'dim.api/client',
    displayName: 'dim.api/client',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    entityType: 'Table',
  },
};

export const SEARCH_ENTITY_TOPIC = {
  topic_1: {
    term: 'shop_products',
    displayName: 'shop_products',
    entity: DATA_ASSETS.topics,
    serviceName: 'sample_kafka',
    entityType: 'Topic',
  },
  topic_2: {
    term: 'orders',
    entity: DATA_ASSETS.topics,
    serviceName: 'sample_kafka',
    entityType: 'Topic',
  },
};

export const SEARCH_ENTITY_DASHBOARD = {
  dashboard_1: {
    term: 'Slack Dashboard',
    displayName: 'Slack Dashboard',
    entity: DATA_ASSETS.dashboards,
    serviceName: 'sample_superset',
    entityType: 'Dashboard',
  },
  dashboard_2: {
    term: 'Unicode Test',
    entity: DATA_ASSETS.dashboards,
    serviceName: 'sample_superset',
    entityType: 'Dashboard',
  },
};

export const SEARCH_ENTITY_PIPELINE = {
  pipeline_1: {
    term: 'dim_product_etl',
    displayName: 'dim_product etl',
    entity: DATA_ASSETS.pipelines,
    serviceName: 'sample_airflow',
    entityType: 'Pipeline',
  },
  pipeline_2: {
    term: 'dim_user_etl',
    displayName: 'dim_user etl',
    entity: DATA_ASSETS.pipelines,
    serviceName: 'sample_airflow',
    entityType: 'Pipeline',
  },
};
export const SEARCH_ENTITY_MLMODEL = {
  mlmodel_1: {
    term: 'forecast_sales',
    entity: DATA_ASSETS.mlmodels,
    serviceName: 'mlflow_svc',
    entityType: 'ML Model',
  },
  mlmodel_2: {
    term: 'eta_predictions',
    entity: DATA_ASSETS.mlmodels,
    serviceName: 'mlflow_svc',
    displayName: 'ETA Predictions',
    entityType: 'ML Model',
  },
};

export const SEARCH_ENTITY_STORED_PROCEDURE = {
  stored_procedure_1: {
    term: 'update_dim_address_table',
    entity: DATA_ASSETS.storedProcedures,
    serviceName: 'sample_data',
    entityType: 'Stored Procedure',
  },
  stored_procedure_2: {
    term: 'update_dim_address_table',
    entity: DATA_ASSETS.storedProcedures,
    serviceName: 'sample_data',
    displayName: 'update_dim_address_table',
    entityType: 'Stored Procedure',
  },
};

export const SEARCH_ENTITY_DATA_MODEL = {
  data_model_1: {
    term: 'operations_view',
    entity: DATA_ASSETS.dataModel,
    serviceName: 'sample_looker',
    entityType: 'Data Model',
  },
  data_model_2: {
    term: 'orders_view',
    entity: DATA_ASSETS.dataModel,
    serviceName: 'sample_looker',
    displayName: 'Orders View',
    entityType: 'Data Model',
  },
};

export const DELETE_ENTITY = {
  table: {
    term: 'dim.shop',
    entity: DATA_ASSETS.tables,
    serviceName: 'sample_data',
    entityType: 'Table',
  },
  topic: {
    term: 'shop_updates',
    entity: DATA_ASSETS.topics,
    serviceName: 'sample_kafka',
    entityType: 'Table',
  },
};

export const RECENT_SEARCH_TITLE = 'Recent Search Terms';
export const RECENT_VIEW_TITLE = 'Recent Views';
export const MY_DATA_TITLE = 'My Data';
export const FOLLOWING_TITLE = 'Following';
export const TEAM_ENTITY = 'team_entity';

export const NO_SEARCHED_TERMS = 'No searched terms';
export const DELETE_TERM = 'DELETE';

export const TOTAL_SAMPLE_DATA_TEAMS_COUNT = 7;
export const TEAMS = {
  Cloud_Infra: { name: 'Cloud_Infra', users: 15 },
  Customer_Support: { name: 'Customer_Support', users: 20 },
  Data_Platform: { name: 'Data_Platform', users: 16 },
};

export const NEW_TEST_SUITE = {
  name: `mysql_matrix`,
  description: 'mysql critical matrix',
};

export const NEW_TABLE_TEST_CASE = {
  name: `table_column_name_to_exist_in_id_${uuid()}`,
  label: 'Table Column Name To Exist',
  type: 'tableColumnNameToExist',
  field: 'testCase',
  description: 'New table test case for TableColumnNameToExist',
};

export const NEW_COLUMN_TEST_CASE = {
  name: 'id_column_value_lengths_to_be_between',
  column: 'id',
  type: 'columnValueLengthsToBeBetween',
  label: 'Column Value Lengths To Be Between',
  min: 3,
  max: 6,
  description: 'New table test case for columnValueLengthsToBeBetween',
};

export const NEW_COLUMN_TEST_CASE_WITH_NULL_TYPE = {
  name: 'id_column_values_to_be_not_null',
  column: 'id',
  type: 'columnValuesToBeNotNull',
  label: 'Column Values To Be Not Null',
  description: 'New table test case for columnValuesToBeNotNull',
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

export const NEW_CLASSIFICATION = {
  name: 'CypressClassification',
  displayName: 'CypressClassification',
  description: 'This is the CypressClassification',
};
export const NEW_TAG = {
  name: 'CypressTag',
  displayName: 'CypressTag',
  renamedName: 'CypressTag-1',
  fqn: `${NEW_CLASSIFICATION.name}.CypressTag`,
  description: 'This is the CypressTag',
  color: '#FF5733',
  icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAACFCAMAAAAKN9SOAAAAA1BMVEXmGSCqexgYAAAAI0lEQVRoge3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAHgaMeAAAUWJHZ4AAAAASUVORK5CYII=',
};

export const NEW_GLOSSARY = {
  name: 'Cypress Glossary',
  description: 'This is the Cypress Glossary',
  reviewer: 'Aaron Johnson',
  addReviewer: true,
  tag: 'PersonalData.Personal',
  isMutually: true,
};
export const NEW_GLOSSARY_1 = {
  name: 'Cypress Product%Glossary',
  description: 'This is the Product glossary with percentage',
  reviewer: 'Brandy Miller',
  addReviewer: false,
};

export const CYPRESS_ASSETS_GLOSSARY = {
  name: 'Cypress Assets Glossary',
  description: 'This is the Assets Cypress Glossary',
  reviewer: '',
  addReviewer: false,
  tag: 'PII.None',
};

export const CYPRESS_ASSETS_GLOSSARY_1 = {
  name: 'Cypress Assets Glossary 1',
  description: 'Cypress Assets Glossary 1 desc',
  reviewer: '',
  addReviewer: false,
  tag: 'PII.None',
};

const COMMON_ASSETS = [
  {
    name: 'dim_customer',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_customer',
  },
  {
    name: 'raw_order',
    fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
  },
  {
    name: 'presto_etl',
    fullyQualifiedName: 'sample_airflow.presto_etl',
  },
];

export const CYPRESS_ASSETS_GLOSSARY_TERMS = {
  term_1: {
    name: 'Cypress%PercentTerm',
    description: 'This is the Cypress PercentTerm',
    synonyms: 'buy,collect,acquire',
    fullyQualifiedName: 'Cypress Assets Glossary.Cypress%PercentTerm',
    assets: COMMON_ASSETS,
  },
  term_2: {
    name: 'Cypress Space GTerm',
    description: 'This is the Cypress Sales',
    synonyms: 'give,disposal,deal',
    fullyQualifiedName: 'Cypress Assets Glossary.Cypress Space GTerm',
    assets: COMMON_ASSETS,
  },
  term_3: {
    name: 'Cypress.Dot.GTerm',
    description: 'This is the Cypress with space',
    synonyms: 'tea,coffee,water',
    fullyQualifiedName: 'Cypress Assets Glossary."Cypress.Dot.GTerm"',
    displayFqn: 'Cypress Assets Glossary.&quot;Cypress.Dot.GTerm&quot;',
    assets: COMMON_ASSETS,
  },
};

export const CYPRESS_ASSETS_GLOSSARY_TERMS_1 = {
  term_1: {
    name: 'Term1',
    description: 'term1 desc',
    fullyQualifiedName: 'Cypress Assets Glossary 1.Term1',
    synonyms: 'buy,collect,acquire',
    assets: COMMON_ASSETS,
  },
  term_2: {
    name: 'Term2',
    description: 'term2 desc',
    synonyms: 'give,disposal,deal',
    fullyQualifiedName: 'Cypress Assets Glossary 1.Term2',
    assets: COMMON_ASSETS,
  },
  term_3: {
    name: 'Term3',
    synonyms: 'tea,coffee,water',
    description: 'term3 desc',
    fullyQualifiedName: 'Cypress Assets Glossary 1.Term3',
    assets: COMMON_ASSETS,
  },
  term_4: {
    name: 'Term4',
    description: 'term4 desc',
    synonyms: 'milk,biscuit,water',
    fullyQualifiedName: 'Cypress Assets Glossary 1.Term4',
    assets: COMMON_ASSETS,
  },
};

export const NEW_GLOSSARY_TERMS = {
  term_1: {
    name: 'CypressPurchase',
    description: 'This is the Cypress Purchase',
    synonyms: 'buy,collect,acquire',
    fullyQualifiedName: 'Cypress Glossary.CypressPurchase',
  },
  term_2: {
    name: 'CypressSales',
    description: 'This is the Cypress Sales',
    synonyms: 'give,disposal,deal',
    fullyQualifiedName: 'Cypress Glossary.CypressSales',
  },
  term_3: {
    name: 'Cypress Space',
    description: 'This is the Cypress with space',
    synonyms: 'tea,coffee,water',
    fullyQualifiedName: 'Cypress Glossary.Cypress Space',
    assets: COMMON_ASSETS,
  },
};
export const GLOSSARY_TERM_WITH_DETAILS = {
  name: 'Accounts',
  description: 'This is the Accounts',
  tag: 'PersonalData.Personal',
  synonyms: 'book,ledger,results',
  relatedTerms: 'CypressSales',
  reviewer: 'Colin Ho',
  inheritedReviewer: 'Aaron Johnson',
  fullyQualifiedName: 'Cypress Glossary.Accounts',
};

export const NEW_GLOSSARY_1_TERMS = {
  term_1: {
    name: 'Features%Term',
    description: 'This is the Features',
    synonyms: 'data,collect,time',
    fullyQualifiedName: 'Cypress Product%Glossary.Features%Term',
    color: '#FF5733',
    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF8AAACFCAMAAAAKN9SOAAAAA1BMVEXmGSCqexgYAAAAI0lEQVRoge3BMQEAAADCoPVPbQwfoAAAAAAAAAAAAAAAAHgaMeAAAUWJHZ4AAAAASUVORK5CYII=',
  },
  term_2: {
    name: 'Uses',
    description: 'This is the Uses',
    synonyms: 'home,business,adventure',
    fullyQualifiedName: 'Cypress Product%Glossary.Uses',
    color: '#50C878',
    icon: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAKEAAAB5CAMAAABm4rHGAAAAA1BMVEUA7gBnh+O4AAAAKUlEQVR4nO3BAQEAAACCIP+vbkhAAQAAAAAAAAAAAAAAAAAAAAAAAL8GTJIAAVDbVToAAAAASUVORK5CYII=',
  },
};

export const service = {
  name: 'Glue',
  description: 'This is a Glue service',
  newDescription: 'This is updated Glue service description',
  Owner: 'Aaron Johnson',
};

export const SERVICE_TYPE = {
  Database: GlobalSettingOptions.DATABASES,
  Messaging: GlobalSettingOptions.MESSAGING,
  Dashboard: GlobalSettingOptions.DASHBOARDS,
  Pipeline: GlobalSettingOptions.PIPELINES,
  MLModels: GlobalSettingOptions.MLMODELS,
  Storage: GlobalSettingOptions.STORAGES,
  Search: GlobalSettingOptions.SEARCH,
  StoredProcedure: GlobalSettingOptions.STORED_PROCEDURES,
};

export const ENTITY_SERVICE_TYPE = {
  Database: 'Database',
  Messaging: 'Messaging',
  Dashboard: 'Dashboard',
  Pipeline: 'Pipeline',
  MLModels: 'ML Models',
  Storage: 'Storage',
  StoredProcedure: 'StoredProcedure',
  Search: 'Search',
};

export const ENTITIES = {
  entity_table: {
    name: 'table',
    description: 'This is Table custom property',
    integerValue: '45',
    stringValue: 'This is string propery',
    markdownValue: 'This is markdown value',
    enumConfig: {
      values: ['enum1', 'enum2', 'enum3'],
      multiSelect: false,
    },
    entityObj: SEARCH_ENTITY_TABLE.table_1,
    entityApiType: 'tables',
  },
  entity_topic: {
    name: 'topic',
    description: 'This is Topic custom property',
    integerValue: '23',
    stringValue: 'This is string propery',
    markdownValue: 'This is markdown value',
    enumConfig: {
      values: ['enum1', 'enum2', 'enum3'],
      multiSelect: false,
    },
    entityObj: SEARCH_ENTITY_TOPIC.topic_1,
    entityApiType: 'topics',
  },
  // commenting the dashboard test for not, need to make changes in dynamic data-test side
  //   entity_dashboard: {
  //     name: 'dashboard',
  //     description: 'This is Dashboard custom property',
  //     integerValue: '14',
  //     stringValue: 'This is string propery',
  //     markdownValue: 'This is markdown value',
  //     entityObj: SEARCH_ENTITY_DASHBOARD.dashboard_1,
  // entityApiType: "dashboards"
  //   },
  entity_pipeline: {
    name: 'pipeline',
    description: 'This is Pipeline custom property',
    integerValue: '78',
    stringValue: 'This is string propery',
    markdownValue: 'This is markdown value',
    enumConfig: {
      values: ['enum1', 'enum2', 'enum3'],
      multiSelect: true,
    },
    entityObj: SEARCH_ENTITY_PIPELINE.pipeline_1,
    entityApiType: 'pipelines',
  },
};

export const LOGIN = {
  username: 'admin',
  password: 'admin',
};

// For now skipping the dashboard entity "SEARCH_ENTITY_DASHBOARD.dashboard_1"
export const ANNOUNCEMENT_ENTITIES = [
  SEARCH_ENTITY_TABLE.table_1,
  SEARCH_ENTITY_TOPIC.topic_1,
  SEARCH_ENTITY_PIPELINE.pipeline_1,
];

export const HTTP_CONFIG_SOURCE = {
  DBT_CATALOG_HTTP_PATH:
    'https://raw.githubusercontent.com/OnkarVO7/dbt_git_test/master/catalog.json',
  DBT_MANIFEST_HTTP_PATH:
    'https://raw.githubusercontent.com/OnkarVO7/dbt_git_test/master/manifest.json',
  DBT_RUN_RESULTS_FILE_PATH:
    'https://raw.githubusercontent.com/OnkarVO7/dbt_git_test/master/run_results.json',
};

export const DBT = {
  classification: 'dbtTags',
  tagName: 'model_tag_two',
  dbtQuery: 'select * from "dev"."dbt_jaffle"."stg_orders"',
  dbtLineageNodeLabel: 'customers',
  dbtLineageNode: 'dev.dbt_jaffle.stg_customers',
  dataQualityTest1: 'dbt_utils_equal_rowcount_customers_ref_orders_',
  dataQualityTest2: 'not_null_customers_customer_id',
};

export const API_SERVICE = {
  databaseServices: 'databaseServices',
  messagingServices: 'messagingServices',
  pipelineServices: 'pipelineServices',
  dashboardServices: 'dashboardServices',
  mlmodelServices: 'mlmodelServices',
  storageServices: 'storageServices',
};

export const TEST_CASE = {
  testCaseAlert: `TestCaseAlert-ct-test-${uuid()}`,
  testCaseDescription: 'This is test case alert description',
  dataAsset: 'Test Case',
  filters: 'Test Results === Failed',
};

export const DESTINATION = {
  webhook: {
    name: `webhookAlert-ct-test-${uuid()}`,
    locator: 'Webhook',
    description: 'This is webhook description',
    url: 'http://localhost:8585',
  },
  slack: {
    name: `slackAlert-ct-test-${uuid()}`,
    locator: 'Slack',
    description: 'This is slack description',
    url: 'http://localhost:8585',
  },
  msteams: {
    name: `msteamsAlert-ct-test-${uuid()}`,
    locator: 'MS Teams',
    description: 'This is ms teams description',
    url: 'http://localhost:8585',
  },
};

export const CUSTOM_PROPERTY_INVALID_NAMES = {
  CAPITAL_CASE: 'CapitalCase',
  WITH_UNDERSCORE: 'with_underscore',
  WITH_DOTS: 'with.',
  WITH_SPACE: 'with ',
};

export const CUSTOM_PROPERTY_NAME_VALIDATION_ERROR =
  'Name must start with lower case with no space, underscore, or dots.';

export const TAG_INVALID_NAMES = {
  MIN_LENGTH: 'c',
  MAX_LENGTH: 'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890ab',
  WITH_SPECIAL_CHARS: '!@#$%^&*()',
};

export const INVALID_NAMES = {
  MAX_LENGTH:
    'a87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890aba87439625b1c2d3e4f5061728394a5b6c7d8e90a1b2c3d4e5f67890abName can be a maximum of 128 characters',
  WITH_SPECIAL_CHARS: '::normalName::',
};

export const NAME_VALIDATION_ERROR =
  'Name must contain only letters, numbers, underscores, hyphens, periods, parenthesis, and ampersands.';

export const NAME_MIN_MAX_LENGTH_VALIDATION_ERROR =
  'Name size must be between 2 and 64';

export const NAME_MAX_LENGTH_VALIDATION_ERROR =
  'Name can be a maximum of 128 characters';

export const DOMAIN_1 = {
  name: 'Cypress%Domain',
  updatedName: 'Cypress_Domain_Name',
  fullyQualifiedName: 'Cypress%Domain',
  updatedDisplayName: 'Cypress_Domain_Display_Name',
  description:
    'This is the Cypress for testing domain creation with percent and dot',
  updatedDescription:
    'This is the updated description for Cypress for testing domain creation',
  experts: 'Aaron Johnson',
  owner: 'Alex Pollard',
  updatedOwner: 'Aaron Johnson',
  domainType: 'Source-aligned',
  dataProducts: [
    {
      name: 'Cypress.Data.Product1',
      description:
        'This is the data product description for Cypress.Data.Product1',
      experts: 'Aaron Johnson',
      owner: 'Aaron Johnson',
    },
    {
      name: 'Cypress.Data.Product2With%',
      description:
        'This is the data product description for Cypress.Data.Product2With%',
      experts: 'Aaron Johnson',
      owner: 'Aaron Johnson',
    },
  ],
};

export const DOMAIN_2 = {
  name: 'Cypress.Domain.New',
  updatedName: 'Cypress.Domain.New',
  updatedDisplayName: 'Cypress.Domain.New',
  fullyQualifiedName: '"Cypress.Domain.New"',
  description: 'This is the Cypress for testing domain creation',
  experts: 'Alex Pollard',
  owner: 'Alex Pollard',
  domainType: 'Source-aligned',
  dataProducts: [
    {
      name: 'Cypress DataProduct Assets',
      description:
        'This is the data product description for Cypress DataProduct Assets',
      experts: 'Aaron Johnson',
      owner: 'Aaron Johnson',
      assets: [
        {
          name: 'dim_customer',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
        },
        {
          name: 'raw_order',
          fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
        },
        {
          name: 'presto_etl',
          fullyQualifiedName: 'sample_airflow.presto_etl',
        },
      ],
    },
  ],
  assets: [
    {
      name: 'dim_customer',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.dim_address',
    },
    {
      name: 'raw_order',
      fullyQualifiedName: 'sample_data.ecommerce_db.shopify.raw_order',
    },
    {
      name: 'presto_etl',
      fullyQualifiedName: 'sample_airflow.presto_etl',
    },
  ],
};

export const DOMAIN_3 = {
  name: 'Cypress Space',
  updatedName: 'Cypress Space',
  updatedDisplayName: 'Cypress Space',
  fullyQualifiedName: 'Cypress Space',
  description: 'This is the Cypress for testing domain with space creation',
  experts: 'Alex Pollard',
  owner: 'Alex Pollard',
  domainType: 'Source-aligned',
  dataProducts: [
    {
      name: 'Cypress%PercentDP',
      description:
        'This is the data product description for Cypress DataProduct Assets',
      experts: 'Aaron Johnson',
      owner: 'Aaron Johnson',
      assets: [
        {
          name: 'forecast_sales_performance',
          fullyQualifiedName: 'sample_superset.forecast_sales_performance',
        },
        {
          name: 'eta_predictions',
          fullyQualifiedName: 'mlflow_svc.eta_predictions',
        },
        {
          name: 'operations_view',
          fullyQualifiedName: 'sample_looker.model.operations_view',
        },
      ],
    },
  ],
  assets: [
    {
      name: 'forecast_sales_performance',
      fullyQualifiedName: 'sample_superset.forecast_sales_performance',
    },
    {
      name: 'eta_predictions',
      fullyQualifiedName: 'mlflow_svc.eta_predictions',
    },
    {
      name: 'operations_view',
      fullyQualifiedName: 'sample_looker.model.operations_view',
    },
  ],
};
export const GLOBAL_SETTING_PERMISSIONS = {
  metadata: {
    testid: GlobalSettingOptions.METADATA,
  },
  customAttributesTable: {
    testid: GlobalSettingOptions.TABLES,
    isCustomProperty: true,
  },
  customAttributesTopics: {
    testid: GlobalSettingOptions.TOPICS,
    isCustomProperty: true,
  },
  customAttributesDashboards: {
    testid: GlobalSettingOptions.DASHBOARDS,
    isCustomProperty: true,
  },
  customAttributesPipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    isCustomProperty: true,
  },
  customAttributesMlModels: {
    testid: GlobalSettingOptions.MLMODELS,
    isCustomProperty: true,
  },
  bots: {
    testid: GlobalSettingOptions.BOTS,
  },
};
export const ID = {
  teams: {
    testid: GlobalSettingOptions.TEAMS,
    button: 'add-team',
  },
  users: {
    testid: GlobalSettingOptions.USERS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  admins: {
    testid: GlobalSettingOptions.ADMINS,
    button: 'add-user',
    api: '/api/v1/users?*',
  },
  databases: {
    testid: GlobalSettingOptions.DATABASES,
    button: 'add-service-button',
    api: '/api/v1/services/databaseServices?*',
  },
  messaging: {
    testid: GlobalSettingOptions.MESSAGING,
    button: 'add-service-button',
    api: '/api/v1/services/messagingServices?*',
  },
  dashboard: {
    testid: GlobalSettingOptions.DASHBOARDS,
    button: 'add-service-button',
    api: '/api/v1/services/dashboardServices?*',
  },
  pipelines: {
    testid: GlobalSettingOptions.PIPELINES,
    button: 'add-service-button',
    api: '/api/v1/services/pipelineServices?*',
  },
  mlmodels: {
    testid: GlobalSettingOptions.MLMODELS,
    button: 'add-service-button',
    api: '/api/v1/services/mlmodelServices?*',
  },
  storage: {
    testid: GlobalSettingOptions.STORAGES,
    button: 'add-service-button',
    api: '/api/v1/services/storageServices?*',
  },
};
