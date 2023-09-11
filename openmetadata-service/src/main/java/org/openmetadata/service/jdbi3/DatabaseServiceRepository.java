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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.resources.EntityResource.searchClient;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class DatabaseServiceRepository extends ServiceEntityRepository<DatabaseService, DatabaseConnection> {
  public DatabaseServiceRepository(CollectionDAO dao) {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.DATABASE_SERVICE,
        dao,
        dao.dbServiceDAO(),
        DatabaseConnection.class,
        ServiceType.DATABASE);
    supportsSearchIndex = true;
  }

  @Override
  public void deleteFromSearch(DatabaseService entity, String changeType) {
    if (supportsSearchIndex) {
      if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
        searchClient.softDeleteOrRestoreEntityFromSearch(
            JsonUtils.deepCopy(entity, DatabaseService.class),
            changeType.equals(RestUtil.ENTITY_SOFT_DELETED),
            "service.fullyQualifiedName");
      } else {
        searchClient.updateSearchEntityDeleted(
            JsonUtils.deepCopy(entity, DatabaseService.class), "", "service.fullyQualifiedName");
      }
    }
  }

  @Override
  public void restoreFromSearch(DatabaseService entity) {
    if (supportsSearchIndex) {
      searchClient.softDeleteOrRestoreEntityFromSearch(
          JsonUtils.deepCopy(entity, DatabaseService.class), false, "service.fullyQualifiedName");
    }
  }
}
