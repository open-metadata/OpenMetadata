/*
 *  Copyright 2023 Collate.
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
  ExtentionEntities,
  ExtentionEntitiesKeys,
} from '../../components/common/CustomPropertyTable/CustomPropertyTable.interface';
import { EntityType, TabSpecificField } from '../../enums/entity.enum';
import { SearchIndex } from '../../enums/search.enum';
import { getDashboardByFqn } from '../../rest/dashboardAPI';
import {
  getDatabaseDetailsByFQN,
  getDatabaseSchemaDetailsByFQN,
} from '../../rest/databaseAPI';
import { getGlossaryTermByFQN } from '../../rest/glossaryAPI';
import { getMlModelByFQN } from '../../rest/mlModelAPI';
import { getPipelineByFqn } from '../../rest/pipelineAPI';
import { getSearchIndexDetailsByFQN } from '../../rest/SearchIndexAPI';
import { getContainerByFQN } from '../../rest/storageAPI';
import { getStoredProceduresByFqn } from '../../rest/storedProceduresAPI';
import { getTableDetailsByFQN } from '../../rest/tableAPI';
import { getTopicByFqn } from '../../rest/topicsAPI';

export const getEntityExtentionDetailsFromEntityType = <
  T extends ExtentionEntitiesKeys
>(
  type: T,
  fqn: string
): Promise<ExtentionEntities[ExtentionEntitiesKeys]> | void => {
  switch (type) {
    case EntityType.TABLE:
      return getTableDetailsByFQN(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.TOPIC:
      return getTopicByFqn(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.DASHBOARD:
      return getDashboardByFqn(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.PIPELINE:
      return getPipelineByFqn(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.MLMODEL:
      return getMlModelByFQN(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.CONTAINER:
      return getContainerByFQN(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.SEARCH_INDEX:
      return getSearchIndexDetailsByFQN(fqn, {
        fields: TabSpecificField.EXTENSION,
      });
    case EntityType.STORED_PROCEDURE:
      return getStoredProceduresByFqn(fqn, {
        fields: TabSpecificField.EXTENSION,
      });
    case EntityType.GLOSSARY_TERM:
      return getGlossaryTermByFQN(fqn, { fields: TabSpecificField.EXTENSION });
    case EntityType.DATABASE:
      return getDatabaseDetailsByFQN(fqn, {
        fields: TabSpecificField.EXTENSION,
      });
    case EntityType.DATABASE_SCHEMA:
      return getDatabaseSchemaDetailsByFQN(fqn, {
        fields: TabSpecificField.EXTENSION,
      });
    default:
      // eslint-disable-next-line no-console
      console.error(`Custom properties for Entity: ${type} not supported yet.`);
  }
};

export const EntitiesSupportedCustomProperties: string[] = [
  SearchIndex.DATABASE,
  SearchIndex.DATABASE_SCHEMA,
  SearchIndex.TABLE,
  SearchIndex.STORED_PROCEDURE,
  SearchIndex.DASHBOARD,
  SearchIndex.PIPELINE,
  SearchIndex.TOPIC,
  SearchIndex.CONTAINER,
  SearchIndex.MLMODEL,
  SearchIndex.SEARCH_INDEX,
  SearchIndex.GLOSSARY_TERM,
];
