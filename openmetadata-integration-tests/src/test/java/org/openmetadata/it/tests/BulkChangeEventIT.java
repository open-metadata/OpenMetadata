package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.BulkApi;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.models.ListResponse;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * Integration tests for ChangeEvent emission on the bulk create/update path ({@code PUT
 * /v1/tables/bulk}) — the endpoint the ingestion REST sink uses for every data asset.
 *
 * <p>Regression coverage for #32092, where {@code updateWithDeferredStore()} never populated the
 * incremental change description, so every bulk entity update was classified {@code
 * ENTITY_NO_CHANGE} and no row was written to {@code change_event}. The entity and its version
 * history were persisted, so the write looked successful while every downstream consumer —
 * observability alerts, notification alerts, the activity feed, and the audit log — saw nothing.
 *
 * <p>The rule these tests hold the bulk path to, scoped to event emission rather than versioning:
 * for every entity a batch actually changed, the same change event must be written that a single
 * PUT would have written. Bulk deliberately skips session consolidation, so versions are not
 * expected to match across the two paths.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class BulkChangeEventIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static final HttpClient HTTP_CLIENT = HttpClient.newHttpClient();
  private static final String EVENTS_PATH = "/v1/events";
  private static final String EVENT_SUBSCRIPTIONS_PATH = "/v1/events/subscriptions";
  private static final String TABLE = Entity.TABLE;
  private static final Duration EVENT_TIMEOUT = Duration.ofSeconds(30);

  /**
   * A bulk update that adds a column must emit ENTITY_UPDATED carrying a top-level {@code columns}
   * entry in fieldsAdded — that is exactly what {@code matchAnyFieldChange({'columns', ...})} in the
   * "Get Schema Changes" alert rule matches on. Runs as ingestion-bot to mirror the real sink.
   */
  @Test
  void test_bulkColumnAdd_emitsEntityUpdatedChangeEvent(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable create = table(ns, schemaFqn, "evt_add", null);
    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    String fqn = tableFqn(schemaFqn, create.getName());
    Table before = getTable(fqn);
    long since = System.currentTimeMillis();

    BulkApi.upsert(
        "tables", List.of(withExtraColumn(create, "added_col")), false, BulkApi.botToken());

    ChangeEvent event = awaitUpdatedEvent(before.getId(), since);
    assertTrue(
        fieldNames(event.getChangeDescription().getFieldsAdded()).contains("columns"),
        "bulk column add must record a top-level 'columns' change, got: "
            + fieldNames(event.getChangeDescription().getFieldsAdded()));
    assertTrue(
        getTable(fqn).getVersion() > before.getVersion(), "bulk column add must bump the version");
  }

  /**
   * A bulk update that changes nothing must emit no event, so the fix does not turn into the
   * opposite failure of re-notifying on every ingestion cycle (#31782). Covers both routes to "no
   * change": the {@code sourceHash} fast-path that short-circuits before any diffing (what real
   * connectors hit, since they always stamp a hash) and the full diff that finds nothing.
   */
  @ParameterizedTest(name = "no-op bulk update emits no event [sourceHash={0}]")
  @ValueSource(booleans = {true, false})
  void test_bulkNoOpUpdate_emitsNoChangeEvent(boolean withSourceHash, TestNamespace ns)
      throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable create =
        table(ns, schemaFqn, "evt_noop_" + withSourceHash, withSourceHash ? "stable-hash" : null);
    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    Table before = getTable(tableFqn(schemaFqn, create.getName()));
    long since = System.currentTimeMillis();

    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    assertNoUpdatedEvent(before.getId(), since);
    assertEquals(
        before.getVersion(),
        getTable(tableFqn(schemaFqn, create.getName())).getVersion(),
        "an unchanged bulk re-send must not bump the version");
  }

  /**
   * The same column add through the single-entity endpoint produces an event of the same shape.
   * Asserts on event emission only — bulk skips consolidation by design, so versions are not
   * expected to line up across the two paths.
   */
  @Test
  void test_bulkUpdate_matchesSingleEntityPut(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);

    CreateTable bulkTable = table(ns, schemaFqn, "evt_cmp_bulk", null);
    BulkApi.upsert("tables", List.of(bulkTable), false, BulkApi.botToken());
    Table bulkBefore = getTable(tableFqn(schemaFqn, bulkTable.getName()));
    long bulkSince = System.currentTimeMillis();
    BulkApi.upsert(
        "tables", List.of(withExtraColumn(bulkTable, "added_col")), false, BulkApi.botToken());
    ChangeEvent bulkEvent = awaitUpdatedEvent(bulkBefore.getId(), bulkSince);

    CreateTable putTable = table(ns, schemaFqn, "evt_cmp_put", null);
    BulkApi.upsert("tables", List.of(putTable), false, BulkApi.botToken());
    Table putBefore = getTable(tableFqn(schemaFqn, putTable.getName()));
    long putSince = System.currentTimeMillis();
    putTable(withExtraColumn(putTable, "added_col"));
    ChangeEvent putEvent = awaitUpdatedEvent(putBefore.getId(), putSince);

    assertEquals(
        putEvent.getEventType(),
        bulkEvent.getEventType(),
        "bulk and single PUT must agree on the event type");
    assertEquals(
        fieldNames(putEvent.getChangeDescription().getFieldsAdded()),
        fieldNames(bulkEvent.getChangeDescription().getFieldsAdded()),
        "bulk and single PUT must agree on which fields changed");
  }

  /**
   * Bulk-PUTting a soft-deleted entity restores it, and {@code updateDeleted()} records a {@code
   * deleted} field change — so this now emits ENTITY_UPDATED where before the fix it emitted
   * nothing. New behaviour, matching the single-PUT path, pinned here so it cannot regress silently.
   */
  @Test
  void test_bulkUndeleteViaBulkPut_emitsEvent(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable create = table(ns, schemaFqn, "evt_undel", null);
    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    String fqn = tableFqn(schemaFqn, create.getName());
    Table created = getTable(fqn);
    softDelete(created.getId().toString());
    long since = System.currentTimeMillis();

    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    ChangeEvent event = awaitUpdatedEvent(created.getId(), since);
    assertNotNull(event.getChangeDescription(), "un-delete event must carry a change description");
    assertTrue(
        allFieldNames(event).contains("deleted"),
        "bulk un-delete must record the 'deleted' field change, got: " + allFieldNames(event));
  }

  /**
   * End-to-end assertion the issue asks for: a "Get Schema Changes" observability alert scoped to
   * the table must receive the event a bulk column add produces. Filter-rejected events are never
   * counted, so {@code totalEventsCount} incrementing is itself proof the rule matched.
   */
  @Test
  void test_bulkColumnAdd_triggersSchemaChangeAlert(TestNamespace ns) throws Exception {
    String schemaFqn = setupSchema(ns);
    CreateTable create = table(ns, schemaFqn, "evt_alert", null);
    BulkApi.upsert("tables", List.of(create), false, BulkApi.botToken());

    String fqn = tableFqn(schemaFqn, create.getName());
    EventSubscription alert = createSchemaChangeAlert(ns, fqn);
    long baseline = totalEventsCount(alert.getId());

    BulkApi.upsert(
        "tables", List.of(withExtraColumn(create, "alert_col")), false, BulkApi.botToken());

    Awaitility.await("schema-change alert receives the bulk update")
        .pollInterval(Duration.ofSeconds(1))
        .atMost(EVENT_TIMEOUT)
        .untilAsserted(
            () ->
                assertTrue(
                    totalEventsCount(alert.getId()) > baseline,
                    "alert must count the bulk-produced change event"));
  }

  // ---------------------------------------------------------------- change events

  private ChangeEvent awaitUpdatedEvent(UUID entityId, long since) {
    return Awaitility.await("ENTITY_UPDATED change event for " + entityId)
        .pollInterval(Duration.ofMillis(500))
        .atMost(EVENT_TIMEOUT)
        .until(() -> findUpdatedEvent(entityId, since), Objects::nonNull);
  }

  /**
   * Asserts no event appears, and keeps asserting it for a few seconds. The event stream is
   * asynchronous, so a single read straight after the write would pass simply by being early.
   */
  private void assertNoUpdatedEvent(UUID entityId, long since) {
    Awaitility.await("no ENTITY_UPDATED change event for " + entityId)
        .during(Duration.ofSeconds(5))
        .atMost(Duration.ofSeconds(15))
        .pollInterval(Duration.ofSeconds(1))
        .untilAsserted(
            () ->
                assertNull(
                    findUpdatedEvent(entityId, since),
                    "an unchanged bulk re-send must not emit a change event"));
  }

  private ChangeEvent findUpdatedEvent(UUID entityId, long since) throws Exception {
    Map<String, String> queryParams = new HashMap<>();
    queryParams.put("entityUpdated", TABLE);
    queryParams.put("timestamp", Long.toString(since));
    RequestOptions options = RequestOptions.builder().queryParams(queryParams).build();
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, EVENTS_PATH, null, options);
    ListResponse<ChangeEvent> events =
        JsonUtils.readValue(json, new TypeReference<ListResponse<ChangeEvent>>() {});
    if (events == null || events.getData() == null) {
      return null;
    }
    return events.getData().stream()
        .filter(event -> entityId.equals(event.getEntityId()))
        .filter(event -> event.getEventType() == EventType.ENTITY_UPDATED)
        .findFirst()
        .orElse(null);
  }

  private List<String> fieldNames(List<FieldChange> changes) {
    List<String> names = new ArrayList<>();
    for (FieldChange change : changes) {
      names.add(change.getName());
    }
    return names;
  }

  private List<String> allFieldNames(ChangeEvent event) {
    List<String> names = new ArrayList<>();
    names.addAll(fieldNames(event.getChangeDescription().getFieldsAdded()));
    names.addAll(fieldNames(event.getChangeDescription().getFieldsUpdated()));
    names.addAll(fieldNames(event.getChangeDescription().getFieldsDeleted()));
    return names;
  }

  // ---------------------------------------------------------------- alert

  private EventSubscription createSchemaChangeAlert(TestNamespace ns, String tableFqn) {
    ArgumentsInput fqnFilter =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withPrefixCondition(ArgumentsInput.PrefixCondition.AND)
            .withArguments(
                List.of(new Argument().withName("fqnList").withInput(List.of(tableFqn))));
    ArgumentsInput schemaChangeAction =
        new ArgumentsInput()
            .withName("GetTableSchemaChanges")
            .withEffect(ArgumentsInput.Effect.INCLUDE)
            .withPrefixCondition(ArgumentsInput.PrefixCondition.AND)
            .withArguments(List.of());

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("schema_change_alert"))
            .withAlertType(CreateEventSubscription.AlertType.OBSERVABILITY)
            .withResources(List.of(TABLE))
            .withEnabled(true)
            .withPollInterval(1)
            .withBatchSize(10)
            .withInput(
                new AlertFilteringInput()
                    .withFilters(List.of(fqnFilter))
                    .withActions(List.of(schemaChangeAction)))
            .withDestinations(webhookDestination());

    EventSubscription subscription = SdkClients.adminClient().eventSubscriptions().create(request);
    ns.trackRoot(Entity.EVENT_SUBSCRIPTION, subscription);
    return subscription;
  }

  private List<SubscriptionDestination> webhookDestination() {
    Webhook webhook =
        new Webhook().withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/test"));
    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhook));
  }

  private long totalEventsCount(UUID subscriptionId) throws Exception {
    String path = EVENT_SUBSCRIPTIONS_PATH + "/id/" + subscriptionId + "/eventsRecord";
    String json =
        SdkClients.adminClient()
            .getHttpClient()
            .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    return OBJECT_MAPPER.readTree(json).path("totalEventsCount").asLong();
  }

  // ---------------------------------------------------------------- fixtures

  private String setupSchema(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);
    return schema.getFullyQualifiedName();
  }

  private CreateTable table(
      TestNamespace ns, String schemaFqn, String baseName, String sourceHash) {
    CreateTable createTable =
        new CreateTable()
            .withName(ns.prefix(baseName))
            .withDatabaseSchema(schemaFqn)
            .withColumns(List.of(new Column().withName("c1").withDataType(ColumnDataType.STRING)));
    createTable.setSourceHash(sourceHash);
    return createTable;
  }

  private CreateTable withExtraColumn(CreateTable base, String columnName) {
    List<Column> columns = new ArrayList<>(base.getColumns());
    columns.add(new Column().withName(columnName).withDataType(ColumnDataType.STRING));
    CreateTable copy =
        new CreateTable()
            .withName(base.getName())
            .withDatabaseSchema(base.getDatabaseSchema())
            .withColumns(columns);
    // A connector re-stamps the hash whenever the source changed; keeping the old one would send
    // the entity down the sourceHash fast-path and skip the diff entirely.
    copy.setSourceHash(base.getSourceHash() == null ? null : base.getSourceHash() + "-changed");
    return copy;
  }

  private String tableFqn(String schemaFqn, String tableName) {
    return schemaFqn + "." + tableName;
  }

  private Table getTable(String fqn) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/tables/name/"
                        + fqn
                        + "?fields=columns,sourceHash&include=all"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertEquals(200, response.statusCode(), "get table " + fqn + ": " + response.body());
    Table table = OBJECT_MAPPER.readValue(response.body(), Table.class);
    assertNotNull(table.getId());
    return table;
  }

  private void putTable(CreateTable create) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables"))
            .header("Authorization", "Bearer " + BulkApi.botToken())
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(OBJECT_MAPPER.writeValueAsString(create)))
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 201,
        "single PUT failed: " + response.statusCode() + " " + response.body());
  }

  private void softDelete(String tableId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/tables/" + tableId))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .DELETE()
            .build();
    HttpResponse<String> response = HTTP_CLIENT.send(request, HttpResponse.BodyHandlers.ofString());
    assertTrue(
        response.statusCode() == 200 || response.statusCode() == 204,
        "soft delete failed: " + response.statusCode() + " " + response.body());
  }
}
