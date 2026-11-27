package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.DriveService;
import org.openmetadata.schema.entity.services.SecurityService;
import org.openmetadata.schema.type.ApiStatus;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.csv.CsvImportResult;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;

@Isolated
class EntityRepositoryBulkImportSecretsTest {
  private static final String PASSWORD = "bulk-import-regression-secret";
  private CollectionDAO collectionDAO;
  private final AtomicReference<String> eventJson = new AtomicReference<>();
  private final AtomicReference<String> storedJson = new AtomicReference<>();
  private final AtomicReference<String> historyJson = new AtomicReference<>();

  @BeforeEach
  void setUp() {
    Fernet.getInstance().setFernetKey("jJ/9sz0g0OHxsfxOoSfdFdmk3ysNmPRnH3TUAbz3IHA=");
    collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.dbServiceDAO()).thenReturn(mock(CollectionDAO.DatabaseServiceDAO.class));
    when(collectionDAO.driveServiceDAO()).thenReturn(mock(CollectionDAO.DriveServiceDAO.class));
    when(collectionDAO.securityServiceDAO())
        .thenReturn(mock(CollectionDAO.SecurityServiceDAO.class));
    when(collectionDAO.relationshipDAO())
        .thenReturn(mock(CollectionDAO.EntityRelationshipDAO.class));
    when(collectionDAO.tagUsageDAO()).thenReturn(mock(CollectionDAO.TagUsageDAO.class));
    when(collectionDAO.entityExtensionDAO())
        .thenReturn(mock(CollectionDAO.EntityExtensionDAO.class));
    when(collectionDAO.changeEventDAO()).thenReturn(mock(CollectionDAO.ChangeEventDAO.class));
    when(collectionDAO.dbServiceDAO().getEntityClass()).thenReturn(DatabaseService.class);
    when(collectionDAO.driveServiceDAO().getEntityClass()).thenReturn(DriveService.class);
    when(collectionDAO.securityServiceDAO().getEntityClass()).thenReturn(SecurityService.class);
    Entity.setCollectionDAO(collectionDAO);
    Entity.setEntityRelationshipRepository(new EntityRelationshipRepository(collectionDAO));
    var changeEventDAO = collectionDAO.changeEventDAO();
    var extensionDAO = collectionDAO.entityExtensionDAO();
    doAnswer(
            invocation -> {
              eventJson.set(invocation.getArgument(0));
              return null;
            })
        .when(changeEventDAO)
        .insert(anyString());
    doAnswer(
            invocation -> {
              final List<String> jsons = invocation.getArgument(3);
              historyJson.set(jsons.getFirst());
              return null;
            })
        .when(extensionDAO)
        .insertMany(anyList(), anyList(), anyString(), anyList());
  }

  @AfterEach
  void tearDown() {
    Entity.cleanup();
    Fernet.getInstance().setFernetKey((String) null);
  }

  @ParameterizedTest
  @ValueSource(strings = {Entity.DATABASE_SERVICE, Entity.DRIVE_SERVICE, Entity.SECURITY_SERVICE})
  void bulkImportOmitsConnectionSecretsFromTheStoredEvent(String entityType) {
    switch (entityType) {
      case Entity.DATABASE_SERVICE -> assertMasked(
          new DatabaseServiceRepository(), DatabaseService.class);
      case Entity.DRIVE_SERVICE -> assertMasked(new DriveServiceRepository(), DriveService.class);
      case Entity.SECURITY_SERVICE -> assertMasked(
          new SecurityServiceRepository(), SecurityService.class);
      default -> throw new IllegalArgumentException(entityType);
    }
  }

  private <T extends EntityInterface<?>> void assertMasked(
      EntityRepository<T> repository, Class<T> entityClass) {
    String ciphertext = Fernet.getInstance().encrypt(PASSWORD);
    T original =
        JsonUtils.readValue(
            """
        {"id":"%s","name":"bulk-service","fullyQualifiedName":"bulk-service",
         "version":0.1,"updatedBy":"admin","updatedAt":1,
         "connection":{"config":{"password":"%s"}}}
        """
                .formatted(UUID.randomUUID(), ciphertext),
            entityClass);
    when(repository.getDao().findEntityById(original.getId(), Include.NON_DELETED))
        .thenReturn(original);
    doAnswer(
            invocation -> {
              storedJson.set(invocation.getArgument(2));
              return null;
            })
        .when(repository.getDao())
        .update(any(UUID.class), anyString(), anyString());

    repository.createChangeEventForBulkOperation(
        original,
        new CsvImportResult()
            .withDryRun(false)
            .withStatus(ApiStatus.SUCCESS)
            .withNumberOfRowsProcessed(2)
            .withNumberOfRowsPassed(2)
            .withNumberOfRowsFailed(0),
        "importer");

    assertNotNull(eventJson.get());
    assertFalse(eventJson.get().contains(ciphertext));
    assertFalse(eventJson.get().contains(PASSWORD));
    ChangeEvent event = JsonUtils.readValue(eventJson.get(), ChangeEvent.class);
    JsonNode payload = JsonUtils.readTree((String) event.getEntity());
    assertFalse(payload.path("connection").has("config"));
    assertEquals(original.getName(), payload.path("name").asText());
    assertEquals(0.2, payload.path("version").asDouble());
    assertEquals(original.getId(), event.getEntityId());
    assertEquals(original.getFullyQualifiedName(), event.getEntityFullyQualifiedName());
    assertEquals(EventType.ENTITY_UPDATED, event.getEventType());
    assertEquals("importer", event.getUserName());
    assertEquals(0.1, event.getPreviousVersion());
    assertEquals(0.2, event.getCurrentVersion());
    assertEquals(
        "bulkImport", event.getChangeDescription().getFieldsUpdated().getFirst().getName());
    assertEquals(
        2,
        JsonUtils.valueToTree(
                event.getChangeDescription().getFieldsUpdated().getFirst().getNewValue())
            .path("numberOfRowsPassed")
            .asInt());
    assertEquals(
        ciphertext,
        JsonUtils.readTree(storedJson.get()).at("/connection/config/password").asText());
    assertEquals(
        ciphertext,
        JsonUtils.readTree(historyJson.get()).at("/connection/config/password").asText());
    assertEquals(
        PASSWORD,
        Fernet.getInstance()
            .decrypt(
                JsonUtils.readTree(storedJson.get()).at("/connection/config/password").asText()));
    assertEquals(0.1, original.getVersion());
    assertEquals(
        ciphertext, JsonUtils.valueToTree(original).at("/connection/config/password").asText());
  }
}
