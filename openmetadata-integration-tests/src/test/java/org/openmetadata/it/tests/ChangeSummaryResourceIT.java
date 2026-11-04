package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Stream;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.APIServiceTestFactory;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DriveServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.MlModelServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.factories.SearchServiceTestFactory;
import org.openmetadata.it.factories.StorageServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.tasks.CreateTask;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.TaskCategory;
import org.openmetadata.schema.type.TaskEntityType;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for the changeSummary API, focusing on correct tracking of who changed each
 * field when multiple users accept suggestions sequentially.
 *
 * <p>Key bug scenario: when two suggestions propose the same description text (common with
 * AI-generated suggestions), the second acceptance produces no JSON patch diff, so the
 * changeSummary never updates to reflect the second user. The "same value" tests below reproduce
 * this exact issue.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class ChangeSummaryResourceIT {

  private static final ObjectMapper MAPPER =
      new ObjectMapper().configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

  private static final String SHARED_DESCRIPTION =
      "AI-suggested description for analytics and reporting";

  @BeforeAll
  public static void setup() {
    SdkClients.adminClient();
  }

  /**
   * Reproduces the core bug: two suggestions with the SAME description text accepted by different
   * users. The second acceptance sets an identical value, producing an empty JSON patch, so the
   * changeSummary still shows the first user.
   */
  @Test
  void testChangeSummaryUpdatesWhenSameValueAcceptedByDifferentUser(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns);

    OpenMetadataClient user1Client = sharedUser1ClientWithTestAdminRole();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // Shared user accepts a description suggestion
    Task suggestion1 =
        createSuggestionTask(table.getFullyQualifiedName(), "table", "description", "shared_user1");
    awaitTaskReadyForWorkflowResolution(suggestion1.getId());
    assertSuggestionResolutionContext(user1Client, suggestion1.getId(), "shared_user1");
    applySuggestion(user1Client, suggestion1.getId().toString());

    // Verify changeSummary reflects user1
    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    assertNotNull(entries1.get("description"));

    String firstChangedBy = (String) entries1.get("description").get("changedBy");
    long firstChangedAt = ((Number) entries1.get("description").get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with the SAME description value
    Task suggestion2 =
        createSuggestionTask(table.getFullyQualifiedName(), "table", "description", "admin");
    awaitTaskReadyForWorkflowResolution(suggestion2.getId());
    applySuggestion(adminClient, suggestion2.getId().toString());

    // The description value is the same, but a different user accepted it.
    // changeSummary must reflect the latest acceptor.
    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    assertNotNull(entries2.get("description"));

    String secondChangedBy = (String) entries2.get("description").get("changedBy");
    long secondChangedAt = ((Number) entries2.get("description").get("changedAt")).longValue();

    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin after second acceptance but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /** Same bug at the column level: same column description accepted by two different users. */
  @Test
  void testChangeSummaryUpdatesColumnWhenSameValueAcceptedByDifferentUser(TestNamespace ns)
      throws Exception {
    Table table = createTestTableWithColumns(ns);

    OpenMetadataClient user1Client = sharedUser1ClientWithTestAdminRole();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // Shared user accepts a column description suggestion
    Task suggestion1 =
        createSuggestionTask(
            table.getFullyQualifiedName(), "table", "columns.name.description", "shared_user1");
    awaitTaskReadyForWorkflowResolution(suggestion1.getId());
    applySuggestion(user1Client, suggestion1.getId().toString());

    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    Map<String, Object> colEntry1 = findEntryByPrefix(entries1, "columns.name.description");
    assertNotNull(colEntry1);

    String firstChangedBy = (String) colEntry1.get("changedBy");
    long firstChangedAt = ((Number) colEntry1.get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with the SAME description
    Task suggestion2 =
        createSuggestionTask(
            table.getFullyQualifiedName(), "table", "columns.name.description", "admin");
    awaitTaskReadyForWorkflowResolution(suggestion2.getId());
    applySuggestion(adminClient, suggestion2.getId().toString());

    // changeSummary must reflect admin, not user1
    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    Map<String, Object> colEntry2 = findEntryByPrefix(entries2, "columns.name.description");
    assertNotNull(colEntry2);

    String secondChangedBy = (String) colEntry2.get("changedBy");
    long secondChangedAt = ((Number) colEntry2.get("changedAt")).longValue();
    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin after second acceptance but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /**
   * Sanity check: when two suggestions have DIFFERENT values, the changeSummary updates correctly.
   * This already works today; the bug only manifests when the value is the same.
   */
  @Test
  void testChangeSummaryUpdatesWhenDifferentValuesAcceptedByDifferentUsers(TestNamespace ns)
      throws Exception {
    Table table = createTestTable(ns);

    OpenMetadataClient user1Client = sharedUser1ClientWithTestAdminRole();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // Shared user accepts a description suggestion
    Task suggestion1 =
        createSuggestionTask(
            table.getFullyQualifiedName(),
            "table",
            "description",
            "Description from first suggestion",
            "shared_user1");
    awaitTaskReadyForWorkflowResolution(suggestion1.getId());
    applySuggestion(user1Client, suggestion1.getId().toString());

    Map<String, Object> summary1 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries1 = extractChangeSummary(summary1);
    assertNotNull(entries1.get("description"));

    String firstChangedBy = (String) entries1.get("description").get("changedBy");
    long firstChangedAt = ((Number) entries1.get("description").get("changedAt")).longValue();
    assertTrue(
        firstChangedBy.contains("shared_user1"),
        "Expected changedBy to contain shared_user1 but was: " + firstChangedBy);

    // Admin accepts a second suggestion with a DIFFERENT description
    Task suggestion2 =
        createSuggestionTask(
            table.getFullyQualifiedName(),
            "table",
            "description",
            "Description from second suggestion",
            "admin");
    awaitTaskReadyForWorkflowResolution(suggestion2.getId());
    applySuggestion(adminClient, suggestion2.getId().toString());

    Table updatedTable = Tables.findByName(table.getFullyQualifiedName()).fetch().get();
    assertEquals("Description from second suggestion", updatedTable.getDescription());

    Map<String, Object> summary2 = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries2 = extractChangeSummary(summary2);
    assertNotNull(entries2.get("description"));

    String secondChangedBy = (String) entries2.get("description").get("changedBy");
    long secondChangedAt = ((Number) entries2.get("description").get("changedAt")).longValue();

    assertTrue(
        secondChangedBy.contains("admin"),
        "Expected changedBy to contain admin but was: " + secondChangedBy);
    assertTrue(
        secondChangedAt >= firstChangedAt,
        "Expected second changedAt (%d) >= first changedAt (%d)"
            .formatted(secondChangedAt, firstChangedAt));
  }

  /** Verifies independent columns are tracked correctly with different users. */
  @Test
  void testChangeSummaryTracksMultipleColumnsIndependently(TestNamespace ns) throws Exception {
    Table table = createTestTableWithColumns(ns);

    OpenMetadataClient user1Client = sharedUser1ClientWithTestAdminRole();
    OpenMetadataClient adminClient = SdkClients.adminClient();

    // Shared user accepts a suggestion on column "name"
    Task suggestion1 =
        createSuggestionTask(
            table.getFullyQualifiedName(),
            "table",
            "columns.name.description",
            "Name column description by user1",
            "shared_user1");
    awaitTaskReadyForWorkflowResolution(suggestion1.getId());
    applySuggestion(user1Client, suggestion1.getId().toString());

    // Admin accepts a suggestion on column "email"
    Task suggestion2 =
        createSuggestionTask(
            table.getFullyQualifiedName(),
            "table",
            "columns.email.description",
            "Email column description by admin",
            "admin");
    awaitTaskReadyForWorkflowResolution(suggestion2.getId());
    applySuggestion(adminClient, suggestion2.getId().toString());

    Map<String, Object> summary = getChangeSummary("table", table.getFullyQualifiedName());
    Map<String, Map<String, Object>> entries = extractChangeSummary(summary);

    Map<String, Object> nameEntry = findEntryByPrefix(entries, "columns.name.description");
    Map<String, Object> emailEntry = findEntryByPrefix(entries, "columns.email.description");

    assertNotNull(nameEntry, "Expected changeSummary entry for columns.name.description");
    assertNotNull(emailEntry, "Expected changeSummary entry for columns.email.description");

    String nameChangedBy = (String) nameEntry.get("changedBy");
    String emailChangedBy = (String) emailEntry.get("changedBy");

    assertTrue(
        nameChangedBy.contains("shared_user1"),
        "Expected name column changedBy to contain shared_user1 but was: " + nameChangedBy);
    assertTrue(
        emailChangedBy.contains("admin"),
        "Expected email column changedBy to contain admin but was: " + emailChangedBy);
  }

  /**
   * A task's field path and the key the entity records the change under are one format: approving
   * a suggestion on a nested or dotted child of any entity type records exactly the task's path, in
   * the entity's history and in its change summary.
   */
  @ParameterizedTest
  @MethodSource("childFieldCases")
  void applyingASuggestion_recordsTheChangeUnderTheTaskPath(
      ChildFieldCase childField, TestNamespace ns) throws Exception {
    JsonNode entity = post(childField.collection(), childField.request().apply(ns));
    String fqn = entity.path("fullyQualifiedName").asText();

    Task suggestion = createSuggestionTask(fqn, childField.entityType(), childField.fieldPath());
    awaitTaskReadyForWorkflowResolution(suggestion.getId());
    applySuggestion(SdkClients.adminClient(), suggestion.getId().toString());

    JsonNode updated = get(childField.collection() + "/" + entity.path("id").asText());
    assertEquals(
        Set.of(childField.fieldPath()),
        changedFieldNames(updated.path("changeDescription")),
        "the entity's history records the change under the task's path");
    assertEquals(
        Set.of(childField.fieldPath()),
        extractChangeSummary(getChangeSummary(childField.entityType(), fqn)).keySet(),
        "the change summary keeps one key for the field, the task's path");
  }

  static Stream<ChildFieldCase> childFieldCases() {
    return Stream.of(
        new ChildFieldCase(
            "table",
            "/v1/tables",
            ns ->
                table(
                    ns,
                    Map.of(
                        "name",
                        "address",
                        "dataType",
                        "STRUCT",
                        "children",
                        List.of(column("street", "STRING")))),
            "columns.address.street.description"),
        new ChildFieldCase(
            "table",
            "/v1/tables",
            ns -> table(ns, column("order.id", "STRING")),
            "columns.\"order.id\".description"),
        new ChildFieldCase(
            "topic",
            "/v1/topics",
            ChangeSummaryResourceIT::topic,
            "messageSchema.schemaFields.\"order.id\".description"),
        new ChildFieldCase(
            "pipeline",
            "/v1/pipelines",
            ChangeSummaryResourceIT::pipeline,
            "tasks.\"extract.load\".description"),
        new ChildFieldCase(
            "mlmodel",
            "/v1/mlmodels",
            ChangeSummaryResourceIT::mlModel,
            "mlFeatures.\"user.age\".description"),
        new ChildFieldCase(
            "container",
            "/v1/containers",
            ChangeSummaryResourceIT::container,
            "dataModel.columns.\"pay.load\".description"),
        new ChildFieldCase(
            "searchIndex",
            "/v1/searchIndexes",
            ChangeSummaryResourceIT::searchIndex,
            "fields.\"title.raw\".description"),
        new ChildFieldCase(
            "apiEndpoint",
            "/v1/apiEndpoints",
            ChangeSummaryResourceIT::apiEndpoint,
            "responseSchema.schemaFields.\"user.id\".description"),
        new ChildFieldCase(
            "dashboardDataModel",
            "/v1/dashboard/datamodels",
            ChangeSummaryResourceIT::dashboardDataModel,
            "columns.\"total.amount\".description"),
        new ChildFieldCase(
            "worksheet",
            "/v1/drives/worksheets",
            ChangeSummaryResourceIT::worksheet,
            "columns.\"row.id\".description"));
  }

  /** An entity type with child fields: how to create one with the child, and that child's path. */
  record ChildFieldCase(
      String entityType,
      String collection,
      Function<TestNamespace, Map<String, Object>> request,
      String fieldPath) {
    @Override
    public String toString() {
      return entityType + " " + fieldPath;
    }
  }

  // --- Helper methods ---

  private static Map<String, Object> table(TestNamespace ns, Map<String, Object> column) {
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName(ns.shortPrefix("svc"), ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName(ns.shortPrefix("sc"), ns, service);
    return Map.of(
        "name",
        ns.shortPrefix("tbl"),
        "databaseSchema",
        schema.getFullyQualifiedName(),
        "columns",
        List.of(column));
  }

  private static Map<String, Object> topic(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("topic"),
        "service",
        MessagingServiceTestFactory.createKafka(ns).getFullyQualifiedName(),
        "partitions",
        1,
        "messageSchema",
        Map.of("schemaType", "JSON", "schemaFields", List.of(column("order.id", "STRING"))));
  }

  private static Map<String, Object> pipeline(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("pipeline"),
        "service",
        PipelineServiceTestFactory.createAirflow(ns).getFullyQualifiedName(),
        "tasks",
        List.of(Map.of("name", "extract.load")));
  }

  private static Map<String, Object> mlModel(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("model"),
        "service",
        MlModelServiceTestFactory.createMlflow(ns).getFullyQualifiedName(),
        "algorithm",
        "xgboost",
        "mlFeatures",
        List.of(Map.of("name", "user.age")));
  }

  private static Map<String, Object> container(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("bucket"),
        "service",
        StorageServiceTestFactory.createS3(ns).getFullyQualifiedName(),
        "dataModel",
        Map.of("columns", List.of(column("pay.load", "STRING"))));
  }

  private static Map<String, Object> searchIndex(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("index"),
        "service",
        SearchServiceTestFactory.createElasticSearch(ns).getFullyQualifiedName(),
        "fields",
        List.of(column("title.raw", "TEXT")));
  }

  private static Map<String, Object> apiEndpoint(TestNamespace ns) {
    JsonNode collection =
        post(
            "/v1/apiCollections",
            Map.of(
                "name",
                ns.shortPrefix("users"),
                "service",
                APIServiceTestFactory.createRest(ns).getFullyQualifiedName()));
    return Map.of(
        "name",
        ns.shortPrefix("getUser"),
        "apiCollection",
        collection.path("fullyQualifiedName").asText(),
        "endpointURL",
        "https://example.com/users",
        "responseSchema",
        Map.of("schemaFields", List.of(column("user.id", "STRING"))));
  }

  private static Map<String, Object> dashboardDataModel(TestNamespace ns) {
    return Map.of(
        "name",
        ns.shortPrefix("model"),
        "service",
        DashboardServiceTestFactory.createMetabase(ns).getFullyQualifiedName(),
        "dataModelType",
        "MetabaseDataModel",
        "columns",
        List.of(column("total.amount", "INT")));
  }

  private static Map<String, Object> worksheet(TestNamespace ns) {
    JsonNode spreadsheet =
        post(
            "/v1/drives/spreadsheets",
            Map.of(
                "name",
                ns.shortPrefix("sheet"),
                "service",
                DriveServiceTestFactory.createGoogleDrive(ns).getFullyQualifiedName()));
    return Map.of(
        "name",
        ns.shortPrefix("worksheet"),
        "spreadsheet",
        spreadsheet.path("fullyQualifiedName").asText(),
        "columns",
        List.of(column("row.id", "STRING")));
  }

  private static Map<String, Object> column(String name, String dataType) {
    return Map.of("name", name, "dataType", dataType);
  }

  private static JsonNode post(String collection, Map<String, Object> request) {
    return send(HttpMethod.POST, collection, request);
  }

  private static JsonNode get(String path) {
    return send(HttpMethod.GET, path, null);
  }

  private static JsonNode send(HttpMethod method, String path, Map<String, Object> request) {
    try {
      String body = request == null ? null : MAPPER.writeValueAsString(request);
      return MAPPER.readTree(
          SdkClients.adminClient()
              .getHttpClient()
              .executeForString(method, path, body, RequestOptions.builder().build()));
    } catch (JsonProcessingException e) {
      throw new IllegalStateException(e);
    }
  }

  private static Set<String> changedFieldNames(JsonNode changeDescription) {
    Set<String> names = new HashSet<>();
    for (String kind : List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted")) {
      changeDescription.path(kind).forEach(change -> names.add(change.path("name").asText()));
    }
    return names;
  }

  private Table createTestTable(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);
    Table table =
        TableTestFactory.createSimpleWithName("tbl" + shortId, ns, schema.getFullyQualifiedName());

    User sharedUser1 = SdkClients.adminClient().users().getByName("shared_user1");
    table.setOwners(List.of(sharedUser1.getEntityReference()));

    return SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private Table createTestTableWithColumns(TestNamespace ns) {
    String shortId = ns.shortPrefix();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("svc" + shortId, ns);
    DatabaseSchema schema =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service);

    List<Column> columns =
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build(),
            ColumnBuilder.of("email", "VARCHAR").dataLength(255).build());

    Table table =
        Tables.create()
            .name("tbl" + shortId)
            .inSchema(schema.getFullyQualifiedName())
            .withColumns(columns)
            .execute();

    User sharedUser1 = SdkClients.adminClient().users().getByName("shared_user1");
    table.setOwners(List.of(sharedUser1.getEntityReference()));

    return SdkClients.adminClient().tables().update(table.getId().toString(), table);
  }

  private Task createSuggestionTask(String entityFqn, String aboutType, String fieldPath) {
    return createSuggestionTask(entityFqn, aboutType, fieldPath, SHARED_DESCRIPTION, "admin");
  }

  private Task createSuggestionTask(
      String entityFqn, String aboutType, String fieldPath, String assignee) {
    return createSuggestionTask(entityFqn, aboutType, fieldPath, SHARED_DESCRIPTION, assignee);
  }

  private Task createSuggestionTask(
      String entityFqn,
      String aboutType,
      String fieldPath,
      String suggestedValue,
      String assignee) {
    return SdkClients.adminClient()
        .tasks()
        .create(
            new CreateTask()
                .withName("change-summary-suggestion-" + UUID.randomUUID())
                .withDescription("Change summary suggestion")
                .withCategory(TaskCategory.MetadataUpdate)
                .withType(TaskEntityType.Suggestion)
                .withAbout(String.format("<#E::%s::%s>", aboutType, entityFqn))
                .withAssignees(List.of(assignee))
                .withPayload(
                    Map.of(
                        "suggestionType",
                        "Description",
                        "fieldPath",
                        fieldPath,
                        "suggestedValue",
                        suggestedValue,
                        "source",
                        "Agent",
                        "confidence",
                        85.0)));
  }

  private void applySuggestion(OpenMetadataClient client, String taskId) throws Exception {
    client
        .getHttpClient()
        .execute(HttpMethod.PUT, "/v1/tasks/" + taskId + "/suggestion/apply", null, Task.class);
  }

  private Map<String, Object> getChangeSummary(String entityType, String fqn) throws Exception {
    String response =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/changeSummary/" + entityType + "/name/" + fqn,
                null,
                RequestOptions.builder().build());
    return MAPPER.readValue(response, new TypeReference<Map<String, Object>>() {});
  }

  @SuppressWarnings("unchecked")
  private Map<String, Map<String, Object>> extractChangeSummary(Map<String, Object> response) {
    return (Map<String, Map<String, Object>>) response.get("changeSummary");
  }

  private Map<String, Object> findEntryByPrefix(
      Map<String, Map<String, Object>> entries, String prefix) {
    return entries.entrySet().stream()
        .filter(e -> e.getKey().startsWith(prefix) || e.getKey().equals(prefix))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  private void awaitTaskReadyForWorkflowResolution(UUID taskId) {
    Awaitility.await("task workflow materialization for " + taskId)
        .atMost(Duration.ofSeconds(20))
        .pollInterval(Duration.ofMillis(250))
        .untilAsserted(
            () -> {
              Task task =
                  SdkClients.adminClient()
                      .tasks()
                      .get(
                          taskId.toString(),
                          "status,workflowDefinitionId,workflowInstanceId,workflowStageId,availableTransitions");

              assertNotNull(task.getWorkflowDefinitionId(), "workflow definition should be bound");
              assertNotNull(task.getWorkflowStageId(), "workflow stage should be materialized");
              assertNotNull(task.getAvailableTransitions(), "workflow transitions should exist");
              assertFalse(
                  task.getAvailableTransitions().isEmpty(),
                  "workflow transitions should be available before resolution");
            });
  }

  private void assertSuggestionResolutionContext(
      OpenMetadataClient client, UUID taskId, String expectedUserName) throws Exception {
    String loggedInUserResponse =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/users/loggedInUser", null, RequestOptions.builder().build());
    User loggedInUser = MAPPER.readValue(loggedInUserResponse, User.class);
    assertEquals(expectedUserName, loggedInUser.getName(), "unexpected client principal");

    Task task =
        SdkClients.adminClient().tasks().get(taskId.toString(), "assignees,about,createdBy");
    assertNotNull(task.getAssignees(), "task assignees should be materialized");
    assertTrue(
        task.getAssignees().stream().anyMatch(ref -> expectedUserName.equals(ref.getName())),
        "expected task assignees to include "
            + expectedUserName
            + " but were "
            + task.getAssignees());
  }

  private OpenMetadataClient sharedUser1ClientWithTestAdminRole() {
    return SdkClients.createClient(
        "shared_user1@test.openmetadata.org",
        "shared_user1@test.openmetadata.org",
        new String[] {"shared_test_admin_role"});
  }
}
