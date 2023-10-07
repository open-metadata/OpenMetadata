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

export enum QueryFilterFieldsEnum {
  MUST = 'must',
  SHOULD = 'should',
}

export enum ExplorePageTabs {
  TABLES = 'tables',
  TOPICS = 'topics',
  DASHBOARDS = 'dashboards',
  PIPELINES = 'pipelines',
  MLMODELS = 'mlmodels',
  CONTAINERS = 'containers',
  GLOSSARY = 'glossaries',
  TAG = 'tags',
  DASHBOARD_DATA_MODEL = 'dashboardDataModel',
  STORED_PROCEDURE = 'storedProcedure',
  SEARCH_INDEX = 'searchIndexes',
  DATABASE = 'database',
  DATABASE_SCHEMA = 'databaseSchema',
  DATABASE_SERVICE = 'databaseService',
  MESSAGING_SERVICE = 'messagingService',
  DASHBOARD_SERVICE = 'dashboardService',
  PIPELINE_SERVICE = 'pipelineService',
  ML_MODEL_SERVICE = 'mlmodelService',
  STORAGE_SERVICE = 'storageService',
  SEARCH_INDEX_SERVICE = 'searchIndexService',
}
