/*
 *  Copyright 2025 Collate.
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
import {
  API_COLLECTION_DEFAULT_TABS,
  API_ENDPOINT_DEFAULT_TABS,
  CONTAINER_DEFAULT_TABS,
  DASHBOARD_DATA_MODEL_DEFAULT_TABS,
  DASHBOARD_DEFAULT_TABS,
  DATABASE_DEFAULT_TABS,
  DATABASE_SCHEMA_DEFAULT_TABS,
  DOMAIN_DEFAULT_TABS,
  ECustomizedDataAssets,
  ECustomizedGovernance,
  GLOSSARY_DEFAULT_TABS,
  GLOSSARY_TERM_DEFAULT_TABS,
  ML_MODEL_DEFAULT_TABS,
  PIPELINE_DEFAULT_TABS,
  SEARCH_INDEX_DEFAULT_TABS,
  STORED_PROCEDURE_DEFAULT_TABS,
  TABLE_DEFAULT_TABS,
  TOPIC_DEFAULT_TABS,
} from '../constant/customizeDetail';
import { EntityDataClass } from '../support/entity/EntityDataClass';

export const getCustomizeDetailsEntity = (
  type: ECustomizedDataAssets | ECustomizedGovernance
) => {
  switch (type) {
    case ECustomizedDataAssets.TABLE:
      return EntityDataClass.table1;
    case ECustomizedDataAssets.TOPIC:
      return EntityDataClass.topic1;
    case ECustomizedDataAssets.DASHBOARD:
      return EntityDataClass.dashboard1;
    case ECustomizedDataAssets.ML_MODEL:
      return EntityDataClass.mlModel1;
    case ECustomizedDataAssets.PIPELINE:
      return EntityDataClass.pipeline1;
    case ECustomizedDataAssets.DASHBOARD_DATA_MODEL:
      return EntityDataClass.dashboardDataModel1;
    case ECustomizedDataAssets.API_COLLECTION:
      return EntityDataClass.apiCollection1;
    case ECustomizedDataAssets.SEARCH_INDEX:
      return EntityDataClass.searchIndex1;
    case ECustomizedDataAssets.CONTAINER:
      return EntityDataClass.container1;
    case ECustomizedDataAssets.DATABASE:
      return EntityDataClass.database;
    case ECustomizedDataAssets.DATABASE_SCHEMA:
      return EntityDataClass.databaseSchema;
    case ECustomizedDataAssets.STORED_PROCEDURE:
      return EntityDataClass.storedProcedure1;
    case ECustomizedDataAssets.API_ENDPOINT:
      return EntityDataClass.apiEndpoint1;
    case ECustomizedGovernance.DOMAIN:
      return EntityDataClass.domain1;
    case ECustomizedGovernance.GLOSSARY:
      return EntityDataClass.glossary1;
    case ECustomizedGovernance.GLOSSARY_TERM:
      return EntityDataClass.glossaryTerm1;

    default:
      throw new Error(`Invalid entity type: ${type}`);
  }
};

export const getCustomizeDetailsDefaultTabs = (
  type: ECustomizedDataAssets | ECustomizedGovernance
) => {
  switch (type) {
    case ECustomizedDataAssets.TABLE:
      return TABLE_DEFAULT_TABS;
    case ECustomizedDataAssets.TOPIC:
      return TOPIC_DEFAULT_TABS;
    case ECustomizedDataAssets.DASHBOARD:
      return DASHBOARD_DEFAULT_TABS;
    case ECustomizedDataAssets.ML_MODEL:
      return ML_MODEL_DEFAULT_TABS;
    case ECustomizedDataAssets.PIPELINE:
      return PIPELINE_DEFAULT_TABS;
    case ECustomizedDataAssets.DASHBOARD_DATA_MODEL:
      return DASHBOARD_DATA_MODEL_DEFAULT_TABS;
    case ECustomizedDataAssets.API_COLLECTION:
      return API_COLLECTION_DEFAULT_TABS;
    case ECustomizedDataAssets.STORED_PROCEDURE:
      return STORED_PROCEDURE_DEFAULT_TABS;
    case ECustomizedDataAssets.API_ENDPOINT:
      return API_ENDPOINT_DEFAULT_TABS;
    case ECustomizedDataAssets.DATABASE_SCHEMA:
      return DATABASE_SCHEMA_DEFAULT_TABS;
    case ECustomizedDataAssets.SEARCH_INDEX:
      return SEARCH_INDEX_DEFAULT_TABS;
    case ECustomizedDataAssets.CONTAINER:
      return CONTAINER_DEFAULT_TABS;
    case ECustomizedDataAssets.DATABASE:
      return DATABASE_DEFAULT_TABS;
    case ECustomizedGovernance.DOMAIN:
      return DOMAIN_DEFAULT_TABS;
    case ECustomizedGovernance.GLOSSARY:
      return GLOSSARY_DEFAULT_TABS;
    case ECustomizedGovernance.GLOSSARY_TERM:
      return GLOSSARY_TERM_DEFAULT_TABS;
  }
};
