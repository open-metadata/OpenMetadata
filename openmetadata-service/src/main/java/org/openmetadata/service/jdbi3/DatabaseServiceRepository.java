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
  public void postUpdate(DatabaseService original, DatabaseService updated) {
    if (supportsSearchIndex) {
      if (original.getOwner() == null && updated.getOwner() != null) {
        String scriptTxt = "if(ctx._source.owner == null){ ctx._source.put('owner', params)}";
        searchClient.updateSearchByQuery(
            JsonUtils.deepCopy(updated, DatabaseService.class), scriptTxt, "service.id", updated.getOwner());
      }
      if (original.getDomain() == null && updated.getDomain() != null) {
        String scriptTxt = "if(ctx._source.domain == null){ ctx._source.put('domain', params)}";
        searchClient.updateSearchByQuery(
            JsonUtils.deepCopy(updated, DatabaseService.class), scriptTxt, "service.id", updated.getDomain());
      }
      if (original.getOwner() != null && updated.getOwner() == null) {
        String scriptTxt =
            String.format(
                "if(ctx._source.owner.id == '%s'){ ctx._source.remove('owner')}",
                original.getOwner().getId().toString());
        searchClient.updateSearchByQuery(
            JsonUtils.deepCopy(updated, DatabaseService.class), scriptTxt, "service.id", updated.getOwner());
      }
      if (original.getDomain() != null && updated.getDomain() == null) {
        String scriptTxt =
            String.format(
                "if(ctx._source.domain.id == '%s'){ ctx._source.remove('domain')}",
                original.getDomain().getId().toString());
        ;
        searchClient.updateSearchByQuery(
            JsonUtils.deepCopy(updated, DatabaseService.class), scriptTxt, "service.id", updated.getDomain());
      }
      String scriptTxt = "for (k in params.keySet()) { ctx._source.put(k, params.get(k)) }";
      searchClient.updateSearchEntityUpdated(JsonUtils.deepCopy(updated, DatabaseService.class), scriptTxt, "");
    }
  }

  @Override
  public void deleteFromSearch(DatabaseService entity, String changeType) {
    if (supportsSearchIndex) {
      if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
        searchClient.softDeleteOrRestoreEntityFromSearch(
            JsonUtils.deepCopy(entity, DatabaseService.class),
            changeType.equals(RestUtil.ENTITY_SOFT_DELETED),
            "service.id");
      } else {
        searchClient.updateSearchEntityDeleted(JsonUtils.deepCopy(entity, DatabaseService.class), "", "service.id");
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
