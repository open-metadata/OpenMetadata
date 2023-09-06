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

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.ElasticsearchException;
import org.elasticsearch.index.engine.DocumentMissingException;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.services.database.DatabaseServiceResource;
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
      String contextInfo = entity != null ? String.format("Entity Info : %s", entity) : null;
      CompletableFuture.runAsync(
          () -> {
            try {
              if (changeType.equals(RestUtil.ENTITY_SOFT_DELETED) || changeType.equals(RestUtil.ENTITY_RESTORED)) {
                searchClient.softDeleteOrRestoreEntityFromSearch(
                    entity.getEntityReference(), changeType.equals(RestUtil.ENTITY_SOFT_DELETED));
              } else {
                searchClient.updateSearchEntityDeleted(entity.getEntityReference(), "", "service.fullyQualifiedName");
              }
            } catch (DocumentMissingException ex) {
              handleDocumentMissingException(contextInfo, ex);
            } catch (ElasticsearchException e) {
              handleElasticsearchException(contextInfo, e);
            } catch (IOException ie) {
              handleIOException(contextInfo, ie);
            }
          });
    }
  }
}
