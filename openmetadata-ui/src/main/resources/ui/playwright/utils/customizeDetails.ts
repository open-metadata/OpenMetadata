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
import { Domain } from '../support/domain/Domain';
import { ApiCollectionClass } from '../support/entity/ApiCollectionClass';
import { ApiEndpointClass } from '../support/entity/ApiEndpointClass';
import { ContainerClass } from '../support/entity/ContainerClass';
import { DashboardClass } from '../support/entity/DashboardClass';
import { DashboardDataModelClass } from '../support/entity/DashboardDataModelClass';
import { DatabaseClass } from '../support/entity/DatabaseClass';
import { DatabaseSchemaClass } from '../support/entity/DatabaseSchemaClass';
import { MlModelClass } from '../support/entity/MlModelClass';
import { PipelineClass } from '../support/entity/PipelineClass';
import { SearchIndexClass } from '../support/entity/SearchIndexClass';
import { StoredProcedureClass } from '../support/entity/StoredProcedureClass';
import { TableClass } from '../support/entity/TableClass';
import { TopicClass } from '../support/entity/TopicClass';
import { Glossary } from '../support/glossary/Glossary';
import { GlossaryTerm } from '../support/glossary/GlossaryTerm';

export const getCustomizeDetailsEntity = (
  type: ECustomizedDataAssets | ECustomizedGovernance
) => {
  switch (type) {
    case ECustomizedDataAssets.TABLE:
      return new TableClass();
    case ECustomizedDataAssets.TOPIC:
      return new TopicClass();
    case ECustomizedDataAssets.DASHBOARD:
      return new DashboardClass();
    case ECustomizedDataAssets.ML_MODEL:
      return new MlModelClass();
    case ECustomizedDataAssets.PIPELINE:
      return new PipelineClass();
    case ECustomizedDataAssets.DASHBOARD_DATA_MODEL:
      return new DashboardDataModelClass();
    case ECustomizedDataAssets.API_COLLECTION:
      return new ApiCollectionClass();
    case ECustomizedDataAssets.SEARCH_INDEX:
      return new SearchIndexClass();
    case ECustomizedDataAssets.CONTAINER:
      return new ContainerClass();
    case ECustomizedDataAssets.DATABASE:
      return new DatabaseClass();
    case ECustomizedDataAssets.DATABASE_SCHEMA:
      return new DatabaseSchemaClass();
    case ECustomizedDataAssets.STORED_PROCEDURE:
      return new StoredProcedureClass();
    case ECustomizedDataAssets.API_ENDPOINT:
      return new ApiEndpointClass();
    case ECustomizedGovernance.DOMAIN:
      return new Domain();
    case ECustomizedGovernance.GLOSSARY:
      return new Glossary();
    case ECustomizedGovernance.GLOSSARY_TERM:
      return new GlossaryTerm();
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
