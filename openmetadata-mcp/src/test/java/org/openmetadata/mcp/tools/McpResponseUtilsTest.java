package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.TestSuiteConnection;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DatabaseServiceRepository;
import org.openmetadata.service.jdbi3.TestSuiteRepository;
import org.openmetadata.service.secrets.masker.EntityMaskerFactory;
import org.openmetadata.service.secrets.masker.PasswordEntityMasker;

class McpResponseUtilsTest {

  private static final String STORED_SECRET = "fernet:stored-ciphertext";
  private static final String MUST_NOT_MUTATE =
      "masking must not mutate the entity the repository returned";

  private static Glossary buildGlossary() {
    Glossary glossary = new Glossary();
    glossary.setName("BusinessGlossary");
    glossary.setVersion(1.0);
    glossary.setUpdatedBy("x");
    glossary.setDeleted(false);
    return glossary;
  }

  private static Glossary patchedGlossary() {
    Glossary glossary = buildGlossary();
    glossary.setVersion(1.3);
    glossary.setChangeDescription(
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName("description")))
            .withFieldsAdded(List.of(new FieldChange().withName("tags"))));
    return glossary;
  }

  @Test
  void writeResponsesMaskWorkflowSinkSecrets() {
    var workflow = GetEntityToolTest.gitSinkWorkflow("gitExport");

    Map<String, Object> doc = McpResponseUtils.compactPatch(workflow, EventType.ENTITY_UPDATED);

    var sinkConfig = JsonUtils.valueToTree(doc).at("/nodes/0/config/sinkConfig");
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/credentials/token").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/privateKey").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/passphrase").asText());
    assertTrue(
        JsonUtils.pojoToJson(workflow).contains(GetEntityToolTest.GIT_TOKEN),
        "masking must not mutate the entity the repository returned");
  }

  @Test
  void readsMaskServiceConnectionPasswords() {
    String storedPassword = "fernet:stored-ciphertext";
    DatabaseService service =
        new DatabaseService()
            .withName("mysqlService")
            .withServiceType(CreateDatabaseService.DatabaseServiceType.Mysql)
            .withConnection(
                new DatabaseConnection()
                    .withConfig(
                        new MysqlConnection()
                            .withHostPort("localhost:3306")
                            .withUsername("test")
                            .withAuthType(new basicAuth().withPassword(storedPassword))));
    DatabaseServiceRepository repository = mock(DatabaseServiceRepository.class);
    when(repository.getServiceType()).thenReturn(ServiceType.DATABASE);
    EntityMaskerFactory.createEntityMasker();
    EntityInterface<?> masked;

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities
          .when(() -> Entity.getEntityTypeFromObject(service))
          .thenReturn(Entity.DATABASE_SERVICE);
      entities
          .when(() -> Entity.getEntityRepository(Entity.DATABASE_SERVICE))
          .thenReturn(repository);
      masked = McpResponseUtils.maskSecrets(service);
    }

    var config = JsonUtils.valueToTree(masked).at("/connection/config");
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, config.at("/authType/password").asText());
    assertEquals("localhost:3306", config.at("/hostPort").asText());
    assertTrue(
        JsonUtils.pojoToJson(service).contains(storedPassword),
        "masking must not mutate the entity the repository returned");
  }

  @Test
  void readsMaskIngestionPipelineSourceConfigSecrets() {
    IngestionPipeline pipeline =
        new IngestionPipeline()
            .withName("dbtPipeline")
            .withPipelineType(PipelineType.DBT)
            .withSourceConfig(
                new SourceConfig()
                    .withConfig(
                        new DbtPipeline()
                            .withDbtConfigSource(
                                new DbtGCSConfig()
                                    .withDbtSecurityConfig(
                                        new GCPCredentials()
                                            .withGcpConfig(
                                                new GCPValues().withPrivateKey(STORED_SECRET))))));
    EntityMaskerFactory.createEntityMasker();

    var masked = JsonUtils.valueToTree(McpResponseUtils.maskSecrets(pipeline));

    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        masked
            .at("/sourceConfig/config/dbtConfigSource/dbtSecurityConfig/gcpConfig/privateKey")
            .asText());
    assertTrue(JsonUtils.pojoToJson(pipeline).contains(STORED_SECRET), MUST_NOT_MUTATE);
  }

  @Test
  void readsDropUserAuthenticationMechanism() {
    User bot =
        new User()
            .withName("ingestion-bot")
            .withIsBot(true)
            .withAuthenticationMechanism(
                new AuthenticationMechanism()
                    .withAuthType(AuthenticationMechanism.AuthType.JWT)
                    .withConfig(new JWTAuthMechanism().withJWTToken(STORED_SECRET)));

    User masked = (User) McpResponseUtils.maskSecrets(bot);

    assertNull(masked.getAuthenticationMechanism());
    assertNotNull(bot.getAuthenticationMechanism(), MUST_NOT_MUTATE);
  }

  @Test
  void readsMaskAutomationsWorkflowRequest() {
    Workflow workflow =
        new Workflow()
            .withName("testConnection")
            .withRequest(
                new TestServiceConnectionRequest()
                    .withConnection(
                        new DatabaseConnection()
                            .withConfig(
                                new MysqlConnection()
                                    .withAuthType(new basicAuth().withPassword(STORED_SECRET))))
                    .withServiceType(ServiceType.DATABASE)
                    .withConnectionType("Mysql"));
    EntityMaskerFactory.createEntityMasker();

    var masked = JsonUtils.valueToTree(McpResponseUtils.maskSecrets(workflow));

    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        masked.at("/request/connection/config/authType/password").asText());
    assertTrue(JsonUtils.pojoToJson(workflow).contains(STORED_SECRET), MUST_NOT_MUTATE);
  }

  @Test
  void readsMaskAlertWebhookCredentials() {
    EventSubscription alert =
        new EventSubscription()
            .withName("alert")
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withConfig(
                            Map.of(
                                "endpoint",
                                "https://hooks.example.com",
                                "authType",
                                Map.of("type", "bearer", "secretKey", STORED_SECRET)))));

    var masked = JsonUtils.valueToTree(McpResponseUtils.maskSecrets(alert));

    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK,
        masked.at("/destinations/0/config/authType/secretKey").asText());
    assertEquals(
        "https://hooks.example.com", masked.at("/destinations/0/config/endpoint").asText());
    assertTrue(JsonUtils.pojoToJson(alert).contains(STORED_SECRET), MUST_NOT_MUTATE);
  }

  @Test
  void readsPassTestSuitePlaceholderConnectionThrough() {
    TestSuite suite = new TestSuite().withName("suite").withConnection(new TestSuiteConnection());
    TestSuiteRepository repository = mock(TestSuiteRepository.class);
    EntityInterface<?> masked;

    try (MockedStatic<Entity> entities = mockStatic(Entity.class)) {
      entities.when(() -> Entity.getEntityTypeFromObject(suite)).thenReturn(Entity.TEST_SUITE);
      entities.when(() -> Entity.getEntityRepository(Entity.TEST_SUITE)).thenReturn(repository);
      masked = McpResponseUtils.maskSecrets(suite);
    }

    assertSame(suite, masked);
  }

  @Test
  void compactPatchKeepsWhatOnlyAnUpdateCanAnswer() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(patchedGlossary(), EventType.ENTITY_UPDATED);

    // compact() strips both of these because they are meaningless on a create. On a patch they are
    // the confirmation the caller wrote for, so aligning the response must not drop them.
    assertEquals(1.3, doc.get("version"), "the new version must survive the slimming");
    // Order is added-then-updated-then-deleted, which is not a contract - the set is.
    assertEquals(
        Set.of("description", "tags"),
        Set.copyOf((List<?>) doc.get("changed")),
        "which fields actually changed is the answer to 'did my update land'");
    assertEquals("updated", doc.get("_operation"));
  }

  @Test
  void compactPatchStillDropsTheNoise() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(patchedGlossary(), EventType.ENTITY_UPDATED);

    assertFalse(doc.containsKey("updatedBy"));
    assertFalse(
        doc.containsKey("changeDescription"),
        "the full object carries old and new values for every field - the names are enough");
  }

  @Test
  void compactPatchOmitsChangedWhenNothingIsRecorded() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(buildGlossary(), EventType.ENTITY_UPDATED);

    assertFalse(doc.containsKey("changed"), "an empty list would read as 'nothing changed'");
  }

  @Test
  void testCompactCreated() {
    Glossary glossary = buildGlossary();

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_CREATED);

    assertEquals("created", doc.get("_operation"));
    assertTrue(doc.containsKey("name"));
    assertFalse(doc.containsKey("version"));
    assertFalse(doc.containsKey("updatedBy"));
    assertFalse(doc.containsKey("deleted"));
  }

  @Test
  void testCompactUpdated() {
    Glossary glossary = buildGlossary();

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_UPDATED);

    assertEquals("updated", doc.get("_operation"));
  }

  @Test
  void testCompactKeepsDeletedWhenTrue() {
    Glossary glossary = buildGlossary();
    glossary.setDeleted(true);

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_CREATED);

    assertTrue(doc.containsKey("deleted"));
    assertEquals(Boolean.TRUE, doc.get("deleted"));
  }
}
