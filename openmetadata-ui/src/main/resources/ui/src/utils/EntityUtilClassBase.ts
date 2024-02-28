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
import {
  getContainerDetailPath,
  getDashboardDetailsPath,
  getDatabaseDetailsPath,
  getDatabaseSchemaDetailsPath,
  getDataModelDetailsPath,
  getEditWebhookPath,
  getMlModelPath,
  getPipelineDetailsPath,
  getServiceDetailsPath,
  getStoredProcedureDetailPath,
  getTableDetailsPath,
  getTableTabPath,
  getTagsDetailsPath,
  getTopicDetailsPath,
  getUserPath,
} from '../constants/constants';
import { GlobalSettingsMenuCategory } from '../constants/GlobalSettings.constants';
import { EntityTabs, EntityType } from '../enums/entity.enum';
import { SearchIndex } from '../enums/search.enum';
import { getTableFQNFromColumnFQN } from './CommonUtils';
import {
  getDataProductsDetailsPath,
  getDomainDetailsPath,
  getGlossaryPath,
  getSettingPath,
  getTeamsWithFqnPath,
} from './RouterUtils';
import { getSearchIndexDetailsPath } from './SearchIndexUtils';

class EntityUtilClassBase {
  public getEntityLink(indexType: string, fullyQualifiedName: string) {
    switch (indexType) {
      case SearchIndex.TOPIC:
      case EntityType.TOPIC:
        return getTopicDetailsPath(fullyQualifiedName);

      case SearchIndex.DASHBOARD:
      case EntityType.DASHBOARD:
        return getDashboardDetailsPath(fullyQualifiedName);

      case SearchIndex.PIPELINE:
      case EntityType.PIPELINE:
        return getPipelineDetailsPath(fullyQualifiedName);

      case EntityType.DATABASE:
        return getDatabaseDetailsPath(fullyQualifiedName);

      case EntityType.DATABASE_SCHEMA:
        return getDatabaseSchemaDetailsPath(fullyQualifiedName);

      case EntityType.GLOSSARY:
      case SearchIndex.GLOSSARY:
      case EntityType.GLOSSARY_TERM:
      case SearchIndex.GLOSSARY_TERM:
        return getGlossaryPath(fullyQualifiedName);

      case EntityType.DATABASE_SERVICE:
      case EntityType.DASHBOARD_SERVICE:
      case EntityType.MESSAGING_SERVICE:
      case EntityType.PIPELINE_SERVICE:
      case EntityType.MLMODEL_SERVICE:
      case EntityType.METADATA_SERVICE:
      case EntityType.STORAGE_SERVICE:
      case EntityType.SEARCH_SERVICE:
        return getServiceDetailsPath(fullyQualifiedName, `${indexType}s`);

      case EntityType.WEBHOOK:
        return getEditWebhookPath(fullyQualifiedName);

      case EntityType.TYPE:
        return getSettingPath(
          GlobalSettingsMenuCategory.CUSTOM_PROPERTIES,
          `${fullyQualifiedName}s`
        );

      case EntityType.MLMODEL:
      case SearchIndex.MLMODEL:
        return getMlModelPath(fullyQualifiedName);

      case EntityType.CONTAINER:
      case SearchIndex.CONTAINER:
        return getContainerDetailPath(fullyQualifiedName);
      case SearchIndex.TAG:
        return getTagsDetailsPath(fullyQualifiedName);

      case SearchIndex.DASHBOARD_DATA_MODEL:
      case EntityType.DASHBOARD_DATA_MODEL:
        return getDataModelDetailsPath(fullyQualifiedName);

      case SearchIndex.STORED_PROCEDURE:
      case EntityType.STORED_PROCEDURE:
        return getStoredProcedureDetailPath(fullyQualifiedName);

      case EntityType.TEST_CASE:
        return `${getTableTabPath(
          getTableFQNFromColumnFQN(fullyQualifiedName),
          EntityTabs.PROFILER
        )}?activeTab=Data Quality`;

      case EntityType.SEARCH_INDEX:
      case SearchIndex.SEARCH_INDEX:
        return getSearchIndexDetailsPath(fullyQualifiedName);

      case EntityType.DOMAIN:
      case SearchIndex.DOMAIN:
        return getDomainDetailsPath(fullyQualifiedName);

      case EntityType.DATA_PRODUCT:
      case SearchIndex.DATA_PRODUCT:
        return getDataProductsDetailsPath(fullyQualifiedName);

      case EntityType.USER:
      case SearchIndex.USER:
        return getUserPath(fullyQualifiedName);

      case EntityType.TEAM:
      case SearchIndex.TEAM:
        return getTeamsWithFqnPath(fullyQualifiedName);

      case SearchIndex.TABLE:
      case EntityType.TABLE:
      default:
        return getTableDetailsPath(fullyQualifiedName);
    }
  }
}

const entityUtilClassBase = new EntityUtilClassBase();

export default entityUtilClassBase;

export { EntityUtilClassBase };
