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

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.mcp.tools.McpResponseUtils.PatchProjectionSpec;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.entity.ai.Env;
import org.openmetadata.schema.entity.ai.McpConnectionConfig;
import org.openmetadata.schema.entity.ai.McpServer;
import org.openmetadata.schema.entity.automations.TestServiceConnectionRequest;
import org.openmetadata.schema.entity.automations.Workflow;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.MetricGroup;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.metadataIngestion.DbtPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.dbtconfig.DbtGCSConfig;
import org.openmetadata.schema.security.credentials.GCPCredentials;
import org.openmetadata.schema.security.credentials.GCPValues;
import org.openmetadata.schema.services.connections.database.MysqlConnection;
import org.openmetadata.schema.services.connections.database.common.basicAuth;
import org.openmetadata.schema.tests.TestSuite;
import org.openmetadata.schema.tests.TestSuiteConnection;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.FieldDataType;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.SearchIndexDataType;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.TableConstraint;
import org.openmetadata.schema.type.TableJoins;
import org.openmetadata.schema.type.TagLabel;
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

  @Test
  void readsMaskMcpServerConnectionsWithoutMutatingStoredEntities() {
    final McpServer server =
        new McpServer()
            .withName("mcp")
            .withConnectionConfig(
                new McpConnectionConfig()
                    .withUrl(STORED_SECRET)
                    .withArgs(List.of(STORED_SECRET))
                    .withEnv(new Env().withAdditionalProperty("SETTING", STORED_SECRET)))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("connectionConfig")
                                .withOldValue(STORED_SECRET)
                                .withNewValue(STORED_SECRET))));
    final String original = JsonUtils.pojoToJson(server);

    final McpServer masked = (McpServer) McpResponseUtils.maskSecrets(server);

    assertFalse(JsonUtils.pojoToJson(masked).contains(STORED_SECRET));
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, masked.getConnectionConfig().getUrl());
    assertEquals(original, JsonUtils.pojoToJson(server), MUST_NOT_MUTATE);
  }

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
    final WorkflowDefinition workflow =
        GetEntityToolTest.gitSinkWorkflow("gitExport")
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("nodes"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(workflow, EventType.ENTITY_UPDATED);

    final var sinkConfig = JsonUtils.valueToTree(doc).at("/nodes/0/config/sinkConfig");
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/credentials/token").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/privateKey").asText());
    assertEquals(
        PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/signingKey/passphrase").asText());
    assertTrue(
        JsonUtils.pojoToJson(workflow).contains(GetEntityToolTest.GIT_TOKEN), MUST_NOT_MUTATE);
  }

  @Test
  void compactPatch_omitsUntouchedWorkflowNodes() {
    final WorkflowDefinition workflow =
        GetEntityToolTest.gitSinkWorkflow("gitExport").withDescription("Export workflow");

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            workflow, Entity.WORKFLOW_DEFINITION, EventType.ENTITY_UPDATED, Set.of("description"));

    assertFalse(doc.containsKey("nodes"));
    assertEquals("Export workflow", doc.get("description"));
    assertFalse(JsonUtils.pojoToJson(doc).contains(GetEntityToolTest.GIT_TOKEN));
  }

  @Test
  void fullPatch_masksWorkflowSinkSecretsAndIncludesConfirmationMetadata() {
    final WorkflowDefinition workflow =
        GetEntityToolTest.gitSinkWorkflow("gitExport")
            .withVersion(1.4)
            .withUpdatedAt(1_700_000_123_000L)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));

    final Map<String, Object> doc =
        McpResponseUtils.fullPatch(workflow, Entity.WORKFLOW_DEFINITION, EventType.ENTITY_UPDATED);

    final var sinkConfig = JsonUtils.valueToTree(doc).at("/nodes/0/config/sinkConfig");
    assertEquals(PasswordEntityMasker.PASSWORD_MASK, sinkConfig.at("/credentials/token").asText());
    assertEquals(Entity.WORKFLOW_DEFINITION, doc.get("entityType"));
    assertEquals(1.4, doc.get("version"));
    assertEquals(1_700_000_123_000L, doc.get("updatedAt"));
    assertEquals("updated", doc.get("_operation"));
    assertEquals(List.of("description"), doc.get("changed"));
    assertTrue(JsonUtils.pojoToJson(workflow).contains(GetEntityToolTest.GIT_TOKEN));
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
  void dropsMetricGroupMembers() {
    MetricGroup group =
        new MetricGroup()
            .withName("revenue")
            .withMetrics(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType("metric")
                        .withName("hidden_margin")));

    MetricGroup masked = (MetricGroup) McpResponseUtils.maskSecrets(group);

    assertNull(masked.getMetrics());
    assertNotNull(group.getMetrics(), MUST_NOT_MUTATE);
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
        PasswordEntityMasker.PASSWORD_MASK,
        masked.at("/destinations/0/config/endpoint").asText(),
        "an incoming-webhook URL is a credential");
    assertTrue(JsonUtils.pojoToJson(alert).contains(STORED_SECRET), MUST_NOT_MUTATE);
    assertTrue(JsonUtils.pojoToJson(alert).contains("https://hooks.example.com"), MUST_NOT_MUTATE);
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

  @Test
  void compactPatch_omitsUnpatchedBulkAndMetadataFieldsOnWideTable() {
    final Table table =
        wideTable()
            .withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(List.of(new FieldChange().withName("tags"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            table, Entity.TABLE, EventType.ENTITY_UPDATED, Set.of("tags"));

    assertEquals(table.getId().toString(), doc.get("id"));
    assertEquals("orders", doc.get("name"));
    assertEquals("shop.db.sales.orders", doc.get("fullyQualifiedName"));
    assertEquals(Entity.TABLE, doc.get("entityType"));
    assertEquals(0.2, doc.get("version"));
    assertEquals(1_700_000_000_000L, doc.get("updatedAt"));
    assertEquals("updated", doc.get("_operation"));
    assertEquals(List.of("tags"), doc.get("changed"));
    assertNotNull(doc.get("tags"));
    assertFalse(doc.containsKey("columns"));
    assertFalse(doc.containsKey("tableConstraints"));
    assertFalse(doc.containsKey("joins"));
    assertFalse(doc.containsKey("owners"));
    assertFalse(doc.containsKey("domains"));
    assertFalse(doc.containsKey("schemaDefinition"));
    assertFalse(doc.containsKey("changeDescription"));
    assertFalse(doc.containsKey("updatedBy"));
  }

  @Test
  void compactPatch_columnSubpathPatchDoesNotEchoColumnsArray() {
    final Table table =
        wideTable()
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(new FieldChange().withName("columns.col_0.description"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            table, Entity.TABLE, EventType.ENTITY_UPDATED, Set.of("columns"));

    assertEquals(List.of("columns.col_0.description"), doc.get("changed"));
    assertFalse(doc.containsKey("columns"));
  }

  @Test
  void compactPatch_topicMessageSchemaSubpathDoesNotEchoMessageSchema() {
    final Topic topic =
        new Topic()
            .withId(UUID.randomUUID())
            .withName("orders_events")
            .withFullyQualifiedName("kafka.orders_events")
            .withVersion(0.2)
            .withUpdatedAt(1_700_000_000_000L)
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaText("{\"type\":\"record\"}")
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("amount_cents")
                                .withDataType(FieldDataType.LONG)
                                .withDescription("Order total"))))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("messageSchema.schemaFields.amount_cents.description"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            topic, Entity.TOPIC, EventType.ENTITY_UPDATED, Set.of("messageSchema"));

    assertEquals(Entity.TOPIC, doc.get("entityType"));
    assertEquals(
        List.of("messageSchema.schemaFields.amount_cents.description"), doc.get("changed"));
    assertFalse(doc.containsKey("messageSchema"));
  }

  @Test
  void compactPatch_searchIndexFieldSubpathDoesNotEchoFieldsArray() {
    final SearchIndex searchIndex =
        new SearchIndex()
            .withId(UUID.randomUUID())
            .withName("orders_idx")
            .withFullyQualifiedName("es.orders_idx")
            .withVersion(0.2)
            .withUpdatedAt(1_700_000_000_000L)
            .withFields(
                List.of(
                    new SearchIndexField()
                        .withName("order_id")
                        .withDataType(SearchIndexDataType.KEYWORD)
                        .withDescription("Order identifier")))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(new FieldChange().withName("fields.order_id.description"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            searchIndex, Entity.SEARCH_INDEX, EventType.ENTITY_UPDATED, Set.of("fields"));

    assertEquals(Entity.SEARCH_INDEX, doc.get("entityType"));
    assertEquals(List.of("fields.order_id.description"), doc.get("changed"));
    assertFalse(doc.containsKey("fields"));
  }

  @Test
  void compactPatch_apiEndpointSchemaSubpathsDoNotEchoRequestOrResponseSchemas() {
    final APIEndpoint endpoint =
        new APIEndpoint()
            .withId(UUID.randomUUID())
            .withName("createOrder")
            .withFullyQualifiedName("payments.orders.createOrder")
            .withVersion(0.3)
            .withUpdatedAt(1_700_000_000_000L)
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(
                            new Field().withName("payload").withDataType(FieldDataType.RECORD))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(new Field().withName("status").withDataType(FieldDataType.STRING))))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(
                        List.of(
                            new FieldChange()
                                .withName("requestSchema.schemaFields.payload.description"),
                            new FieldChange()
                                .withName("responseSchema.schemaFields.status.description"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            endpoint,
            Entity.API_ENDPOINT,
            EventType.ENTITY_UPDATED,
            Set.of("requestSchema", "responseSchema"));

    assertEquals(Entity.API_ENDPOINT, doc.get("entityType"));
    assertEquals(
        List.of(
            "requestSchema.schemaFields.payload.description",
            "responseSchema.schemaFields.status.description"),
        doc.get("changed"));
    assertFalse(doc.containsKey("requestSchema"));
    assertFalse(doc.containsKey("responseSchema"));
  }

  @Test
  void compactPatch_noChangeEventOmitsStaleChangeDescription() {
    final Table table =
        wideTable()
            .withDescription("existing description")
            .withTags(List.of(new TagLabel().withTagFQN("PII.Sensitive")))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("tags"))));

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            table, Entity.TABLE, EventType.ENTITY_NO_CHANGE, Set.of("description"));

    assertFalse(doc.containsKey("changed"));
    assertFalse(doc.containsKey("tags"));
    assertEquals("existing description", doc.get("description"));
  }

  @Test
  void compactPatch_preservesEntityStatusAndDisplayNameWhenPresent() {
    final GlossaryTerm term =
        new GlossaryTerm()
            .withId(UUID.randomUUID())
            .withName("net_revenue")
            .withDisplayName("Net Revenue")
            .withFullyQualifiedName("Finance.net_revenue")
            .withEntityStatus(EntityStatus.IN_REVIEW)
            .withVersion(0.3)
            .withUpdatedAt(1_700_000_500_000L);

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(
            term, Entity.GLOSSARY_TERM, EventType.ENTITY_UPDATED, Set.of());

    assertEquals("Net Revenue", doc.get("displayName"));
    assertEquals(EntityStatus.IN_REVIEW.value(), doc.get("entityStatus"));
    assertEquals(Entity.GLOSSARY_TERM, doc.get("entityType"));
  }

  @Test
  void compactPatch_preservesDeletedTrueAndOmitsDeletedFalseOrNull() {
    final Glossary deletedGlossary = buildGlossary().withDeleted(true);
    final Glossary activeGlossary = buildGlossary().withDeleted(false);
    final Glossary nullDeletedGlossary = buildGlossary().withDeleted(null);

    final Map<String, Object> deletedDoc =
        McpResponseUtils.compactPatch(deletedGlossary, EventType.ENTITY_UPDATED);
    final Map<String, Object> activeDoc =
        McpResponseUtils.compactPatch(activeGlossary, EventType.ENTITY_UPDATED);
    final Map<String, Object> nullDeletedDoc =
        McpResponseUtils.compactPatch(nullDeletedGlossary, EventType.ENTITY_UPDATED);

    assertEquals(Boolean.TRUE, deletedDoc.get("deleted"));
    assertFalse(activeDoc.containsKey("deleted"));
    assertFalse(nullDeletedDoc.containsKey("deleted"));
  }

  @Test
  void compactPatch_extensionSubkeyEchoesOnlyTouchedCustomProperty() {
    final Map<String, Object> extension = new LinkedHashMap<>();
    extension.put("cost/center", "FIN-99");
    extension.put("a~b", "tilde");
    extension.put("untouchedProp", "x".repeat(500));
    final Table table =
        wideTable()
            .withExtension(extension)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsAdded(List.of(new FieldChange().withName("extension"))));
    final PatchProjectionSpec spec =
        new PatchProjectionSpec(
            Entity.TABLE, false, Set.of("extension"), Set.of("cost/center"), false);

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(table, EventType.ENTITY_UPDATED, spec);

    assertEquals(Map.of("cost/center", "FIN-99"), doc.get("extension"));
  }

  @Test
  void compactPatch_wholeExtensionReplaceEchoesEntireExtension() {
    final Map<String, Object> extension = Map.of("propA", "one", "propB", "two");
    final Table table =
        wideTable()
            .withExtension(extension)
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("extension"))));
    final PatchProjectionSpec spec =
        new PatchProjectionSpec(Entity.TABLE, false, Set.of("extension"), Set.of(), true);

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(table, EventType.ENTITY_UPDATED, spec);

    assertEquals(extension, doc.get("extension"));
  }

  @Test
  void compactPatch_removedExtensionSubkeyOmitsEmptyFilteredMap() {
    final Table table =
        wideTable()
            .withExtension(Map.of("untouchedProp", "still-present"))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsDeleted(List.of(new FieldChange().withName("extension"))));
    final PatchProjectionSpec spec =
        new PatchProjectionSpec(
            Entity.TABLE, false, Set.of("extension"), Set.of("removedProp"), false);

    final Map<String, Object> doc =
        McpResponseUtils.compactPatch(table, EventType.ENTITY_UPDATED, spec);

    assertFalse(doc.containsKey("extension"));
    assertEquals(List.of("extension"), doc.get("changed"));
  }

  private static Table wideTable() {
    final List<Column> columns = new ArrayList<>();
    for (int i = 0; i < 50; i++) {
      columns.add(
          new Column()
              .withName("col_" + i)
              .withDataType(ColumnDataType.VARCHAR)
              .withDataLength(256)
              .withDescription("Description for column " + i));
    }
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName("shop.db.sales.orders")
        .withVersion(0.2)
        .withUpdatedAt(1_700_000_000_000L)
        .withUpdatedBy("alice")
        .withColumns(columns)
        .withTableConstraints(
            List.of(
                new TableConstraint()
                    .withConstraintType(TableConstraint.ConstraintType.PRIMARY_KEY)
                    .withColumns(List.of("col_0"))))
        .withJoins(new TableJoins())
        .withSchemaDefinition("CREATE TABLE orders (col_0 VARCHAR(256))")
        .withOwners(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.USER)
                    .withName("owner1")))
        .withDomains(
            List.of(
                new EntityReference()
                    .withId(UUID.randomUUID())
                    .withType(Entity.DOMAIN)
                    .withName("Commerce")));
  }
}
