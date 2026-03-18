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

export enum SearchIndex {
  ALL = 'all',
  DATA_ASSET = 'dataAsset',
  TABLE = 'table',
  COLUMN = 'tableColumn',
  TOPIC = 'topic',
  CHART = 'chart',
  DASHBOARD = 'dashboard',
  PIPELINE = 'pipeline',
  USER = 'user',
  TEAM = 'team',
  GLOSSARY = 'glossary',
  GLOSSARY_TERM = 'glossaryTerm',
  MLMODEL = 'mlmodel',
  TAG = 'tag',
  CONTAINER = 'container',
  QUERY = 'query',
  TEST_CASE = 'testCase',
  TEST_SUITE = 'testSuite',
  DATABASE_SCHEMA = 'databaseSchema',
  DATABASE = 'database',
  DATABASE_SERVICE = 'databaseService',
  MESSAGING_SERVICE = 'messagingService',
  PIPELINE_SERVICE = 'pipelineService',
  SEARCH_SERVICE = 'searchService',
  DASHBOARD_SERVICE = 'dashboardService',
  ML_MODEL_SERVICE = 'mlModelService',
  STORAGE_SERVICE = 'storageService',
  DRIVE_SERVICE = 'driveService',
  DOMAIN = 'domain',
  SEARCH_INDEX = 'searchIndex',
  STORED_PROCEDURE = 'storedProcedure',
  DASHBOARD_DATA_MODEL = 'dashboardDataModel',
  DATA_PRODUCT = 'dataProduct',
  INGESTION_PIPELINE = 'ingestionPipeline',
  API_SERVICE = 'apiService',
  METADATA_SERVICE = 'metadataService',
  API_COLLECTION = 'apiCollection',
  API_ENDPOINT = 'apiEndpoint',
  METRIC = 'metric',
  SERVICE = 'service',
  DIRECTORY = 'directory',
  FILE = 'file',
  SPREADSHEET = 'spreadsheet',
  WORKSHEET = 'worksheet',
}
