/*
 *  Copyright 2026 Collate
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.RETURNS_DEEP_STUBS;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

class BulkImportChangeEventMaskingTest {
  private static final String PASSWORD = "fernet:encrypted-service-password";
  private static final String HOST = "warehouse.internal:3306";
  private CollectionDAO previousDao;
  private CollectionDAO daoCollection;
  private TestRepository repository;
  private DatabaseService service;

  @BeforeEach
  void setUp() {
    previousDao = Entity.getCollectionDAO();
    daoCollection = mock(CollectionDAO.class, RETURNS_DEEP_STUBS);
    Entity.setCollectionDAO(daoCollection);
    repository = new TestRepository(daoCollection.dbServiceDAO());
    service =
        new DatabaseService()
            .withId(UUID.randomUUID())
            .withName("warehouse")
            .withFullyQualifiedName("warehouse")
            .withServiceType(DatabaseServiceType.Mysql)
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort(HOST)
                            .withUsername("etl")
                            .withAuthType(new basicAuth().withPassword(PASSWORD))));
  }

  @AfterEach
  void tearDown() {
    Entity.setCollectionDAO(previousDao);
  }

  @Test
  void bulkImportMasksEventWithoutChangingStoredConnection() {
    when(daoCollection.dbServiceDAO().findEntityById(service.getId(), Include.NON_DELETED))
        .thenReturn(service);
    final CsvImportResult result =
        new CsvImportResult().withDryRun(false).withNumberOfRowsProcessed(2);

    repository.createChangeEventForBulkOperation(service, result, "admin");

    final ChangeEvent event = assertMaskedEvent();
    assertEquals(
        "bulkImport", event.getChangeDescription().getFieldsUpdated().getFirst().getName());
    final ArgumentCaptor<String> storedJson = ArgumentCaptor.forClass(String.class);
    verify(daoCollection.dbServiceDAO())
        .update(eq(service.getId()), eq(service.getFullyQualifiedName()), storedJson.capture());
    final DatabaseService stored =
        JsonUtils.readValue(storedJson.getValue(), DatabaseService.class);
    assertEquals(0.2, stored.getVersion());
    assertEquals(
        JsonUtils.valueToTree(service.getConnection()),
        JsonUtils.valueToTree(stored.getConnection()));
    @SuppressWarnings("unchecked")
    final ArgumentCaptor<List<String>> historyJsons = ArgumentCaptor.forClass(List.class);
    verify(daoCollection.entityExtensionDAO())
        .insertMany(
            eq(List.of(service.getId())),
            eq(List.of("databaseService.version.0.1")),
            eq(Entity.DATABASE_SERVICE),
            historyJsons.capture());
    assertEquals(1, historyJsons.getValue().size());
    assertEquals(
        JsonUtils.valueToTree(service),
        JsonUtils.valueToTree(
            JsonUtils.readValue(historyJsons.getValue().getFirst(), DatabaseService.class)));
  }

  @Test
  void approvedChangeMasksEventWithoutMutatingEntity() {
    final ChangeDescription changes =
        new ChangeDescription()
            .withFieldsUpdated(
                List.of(new FieldChange().withName("description").withNewValue("Approved")));
    final DatabaseService updated =
        JsonUtils.deepCopy(service, DatabaseService.class)
            .withVersion(0.2)
            .withDescription("Approved")
            .withChangeDescription(changes);
    final String connectionBefore = JsonUtils.pojoToJson(updated.getConnection());

    repository.createAndInsertChangeEvent(service, updated, changes, EventType.ENTITY_UPDATED);

    final ChangeEvent event = assertMaskedEvent();
    assertEquals(changes, event.getChangeDescription());
    assertEquals(connectionBefore, JsonUtils.pojoToJson(updated.getConnection()));
    assertEquals("Approved", updated.getDescription());
  }

  private ChangeEvent assertMaskedEvent() {
    final ArgumentCaptor<String> eventJson = ArgumentCaptor.forClass(String.class);
    verify(daoCollection.changeEventDAO()).insert(eventJson.capture());
    assertFalse(eventJson.getValue().contains(PASSWORD));
    assertFalse(eventJson.getValue().contains(HOST));
    final ChangeEvent event = JsonUtils.readValue(eventJson.getValue(), ChangeEvent.class);
    final String entityJson = assertInstanceOf(String.class, event.getEntity());
    final DatabaseService entity = JsonUtils.readValue(entityJson, DatabaseService.class);
    assertNull(entity.getConnection().getConfig());
    assertEquals(service.getName(), entity.getName());
    assertEquals(service.getId(), event.getEntityId());
    assertEquals(Entity.DATABASE_SERVICE, event.getEntityType());
    assertEquals(EventType.ENTITY_UPDATED, event.getEventType());
    assertEquals(0.1, event.getPreviousVersion());
    assertEquals(0.2, event.getCurrentVersion());
    return event;
  }

  private static class TestRepository extends EntityRepository<DatabaseService> {
    TestRepository(CollectionDAO.DatabaseServiceDAO dao) {
      super(
          "services/databaseServices",
          Entity.DATABASE_SERVICE,
          DatabaseService.class,
          dao,
          "",
          "",
          Set.of(),
          false);
    }

    @Override
    public Fields getPutFields() {
      return Fields.EMPTY_FIELDS;
    }

    @Override
    protected void setFields(DatabaseService entity, Fields fields, RelationIncludes includes) {}

    @Override
    protected void clearFields(DatabaseService entity, Fields fields) {}

    @Override
    protected void prepare(DatabaseService entity, boolean update) {}

    @Override
    protected void storeEntity(DatabaseService entity, boolean update) {}

    @Override
    protected void storeRelationships(DatabaseService entity) {}
  }
}
