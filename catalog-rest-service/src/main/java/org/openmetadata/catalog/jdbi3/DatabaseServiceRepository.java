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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.catalog.Entity.FIELD_OWNER;
import static org.openmetadata.catalog.util.EntityUtil.objectMatch;

import java.io.IOException;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.services.DatabaseConnection;
import org.openmetadata.catalog.entity.services.DatabaseService;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.fernet.Fernet;
import org.openmetadata.catalog.resources.services.database.DatabaseServiceResource;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class DatabaseServiceRepository extends EntityRepository<DatabaseService> {
  private static final String UPDATE_FIELDS = "owner";
  private final Fernet fernet;

  public DatabaseServiceRepository(CollectionDAO dao) {
    super(
        DatabaseServiceResource.COLLECTION_PATH,
        Entity.DATABASE_SERVICE,
        DatabaseService.class,
        dao.dbServiceDAO(),
        dao,
        "",
        UPDATE_FIELDS);
    this.allowEdits = true;
    fernet = Fernet.getInstance();
  }

  public void rotate() throws IOException {
    if (!fernet.isKeyDefined()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.FERNET_KEY_NULL);
    }
    ListFilter filter = new ListFilter(Include.ALL);
    List<String> jsons = dao.listAfter(filter, Integer.MAX_VALUE, "");
    for (String json : jsons) {
      DatabaseService databaseService = JsonUtils.readValue(json, DatabaseService.class);
      DatabaseConnection databaseConnection = databaseService.getConnection();
      fernet.encryptOrDecryptDatabaseConnection(databaseConnection, databaseService.getServiceType(), true);
      storeEntity(databaseService, true);
    }
  }

  @Override
  public DatabaseService setFields(DatabaseService entity, Fields fields) throws IOException {
    entity.setPipelines(fields.contains("pipelines") ? getIngestionPipelines(entity) : null);
    entity.setOwner(fields.contains(FIELD_OWNER) ? getOwner(entity) : null);
    return entity;
  }

  private List<EntityReference> getIngestionPipelines(DatabaseService service) throws IOException {
    List<String> ingestionPipelineIds =
        findTo(service.getId(), Entity.DATABASE_SERVICE, Relationship.CONTAINS, Entity.INGESTION_PIPELINE);
    List<EntityReference> ingestionPipelines = new ArrayList<>();
    for (String ingestionPipelineId : ingestionPipelineIds) {
      ingestionPipelines.add(
          daoCollection
              .ingestionPipelineDAO()
              .findEntityReferenceById(UUID.fromString(ingestionPipelineId), Include.ALL));
    }
    return ingestionPipelines;
  }

  @Override
  public void prepare(DatabaseService databaseService) throws IOException {
    setFullyQualifiedName(databaseService);
    // Check if owner is valid and set the relationship
    databaseService.setOwner(Entity.getEntityReference(databaseService.getOwner()));
    // encrypt database service connection
    fernet.encryptOrDecryptDatabaseConnection(databaseService.getConnection(), databaseService.getServiceType(), true);
  }

  @Override
  public void storeEntity(DatabaseService service, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    EntityReference owner = service.getOwner();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    service.withOwner(null).withHref(null);

    store(service.getId(), service, update);

    // Restore the relationships
    service.withOwner(owner);
  }

  @Override
  public void storeRelationships(DatabaseService entity) {
    // Add owner relationship
    storeOwner(entity, entity.getOwner());
  }

  @Override
  public EntityUpdater getUpdater(DatabaseService original, DatabaseService updated, Operation operation) {
    return new DatabaseServiceUpdater(original, updated, operation);
  }

  public class DatabaseServiceUpdater extends EntityUpdater {
    public DatabaseServiceUpdater(DatabaseService original, DatabaseService updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateDatabaseConnectionConfig();
    }

    private void updateDatabaseConnectionConfig() throws IOException {
      DatabaseConnection origConn = original.getConnection();
      DatabaseConnection updatedConn = updated.getConnection();
      String origJson = JsonUtils.pojoToJson(origConn);
      String updatedJson = JsonUtils.pojoToJson(updatedConn);
      DatabaseConnection decryptedOrigConn = JsonUtils.readValue(origJson, DatabaseConnection.class);
      DatabaseConnection decryptedUpdatedConn = JsonUtils.readValue(updatedJson, DatabaseConnection.class);
      fernet.encryptOrDecryptDatabaseConnection(decryptedOrigConn, original.getServiceType(), false);
      fernet.encryptOrDecryptDatabaseConnection(decryptedUpdatedConn, updated.getServiceType(), false);
      if (!objectMatch.test(decryptedOrigConn, decryptedUpdatedConn)) {
        recordChange("connection", origConn, updatedConn, true);
      }
    }
  }
}
