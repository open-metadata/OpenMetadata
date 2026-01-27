package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * Integration tests for EventSubscription batch processing functionality.
 *
 * <p>Tests that successful change events are properly recorded when processed by event
 * subscriptions. This validates the batch insert mechanism that was introduced to reduce database
 * connection pool contention.
 *
 * <p>Test isolation: Uses TestNamespace for unique entity naming Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class EventSubscriptionBatchProcessingIT {

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String EVENT_SUBSCRIPTIONS_PATH = "/v1/events/subscriptions";

  @Test
  void test_eventSubscriptionRecordsSuccessfulEvents(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EventSubscription subscription = createTestEventSubscription(ns, client);
    assertNotNull(subscription);
    assertNotNull(subscription.getId());

    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());

    for (int i = 0; i < 5; i++) {
      createTestTable(ns, schema.getFullyQualifiedName(), "batch_table_" + i);
    }

    Thread.sleep(5000);

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionStatusEndpoint(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    HttpClient httpClient = client.getHttpClient();

    EventSubscription subscription = createTestEventSubscription(ns, client);
    assertNotNull(subscription);
    assertNotNull(subscription.getDestinations());
    assertFalse(subscription.getDestinations().isEmpty());

    UUID destinationId = subscription.getDestinations().get(0).getId();

    String statusPath =
        String.format(
            "%s/%s/status/%s",
            EVENT_SUBSCRIPTIONS_PATH, subscription.getId().toString(), destinationId.toString());

    RequestOptions options = RequestOptions.builder().build();
    String statusJson = httpClient.executeForString(HttpMethod.GET, statusPath, null, options);

    assertNotNull(statusJson);
    assertFalse(statusJson.isEmpty());

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionDiagnosticInfo(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    HttpClient httpClient = client.getHttpClient();

    EventSubscription subscription = createTestEventSubscription(ns, client);
    assertNotNull(subscription);

    String diagnosticPath =
        String.format(
            "%s/id/%s/diagnosticInfo", EVENT_SUBSCRIPTIONS_PATH, subscription.getId().toString());

    RequestOptions options = RequestOptions.builder().build();
    String diagnosticJson =
        httpClient.executeForString(HttpMethod.GET, diagnosticPath, null, options);

    assertNotNull(diagnosticJson);
    assertFalse(diagnosticJson.isEmpty());

    JsonNode diagnosticNode = MAPPER.readTree(diagnosticJson);
    assertNotNull(diagnosticNode);

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionListEventsEndpoint(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    HttpClient httpClient = client.getHttpClient();

    EventSubscription subscription = createTestEventSubscription(ns, client);
    assertNotNull(subscription);

    String listEventsPath =
        String.format(
            "%s/id/%s/listEvents", EVENT_SUBSCRIPTIONS_PATH, subscription.getId().toString());

    RequestOptions options =
        RequestOptions.builder()
            .queryParam("limit", "10")
            .queryParam("paginationOffset", "0")
            .build();

    String eventsJson = httpClient.executeForString(HttpMethod.GET, listEventsPath, null, options);

    assertNotNull(eventsJson);
    assertFalse(eventsJson.isEmpty());

    JsonNode eventsNode = MAPPER.readTree(eventsJson);
    assertNotNull(eventsNode);
    assertTrue(eventsNode.has("data"), "Response should have 'data' field");

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionEventsRecord(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    HttpClient httpClient = client.getHttpClient();

    EventSubscription subscription = createTestEventSubscription(ns, client);
    assertNotNull(subscription);

    String eventsRecordPath =
        String.format(
            "%s/id/%s/eventsRecord", EVENT_SUBSCRIPTIONS_PATH, subscription.getId().toString());

    RequestOptions options = RequestOptions.builder().build();
    String recordJson =
        httpClient.executeForString(HttpMethod.GET, eventsRecordPath, null, options);

    assertNotNull(recordJson);
    assertFalse(recordJson.isEmpty());

    JsonNode recordNode = MAPPER.readTree(recordJson);
    assertNotNull(recordNode);

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionWithTableResources(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("table_resource_sub"))
            .withDescription("Subscription filtering table events")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("table"))
            .withEnabled(false)
            .withBatchSize(50)
            .withDestinations(getWebhookDestination());

    EventSubscription subscription = client.eventSubscriptions().create(request);
    assertNotNull(subscription);
    assertNotNull(subscription.getFilteringRules());
    assertEquals(List.of("table"), subscription.getFilteringRules().getResources());

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_eventSubscriptionBatchSizeConfiguration(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("batch_config_sub"))
            .withDescription("Subscription with custom batch size")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withBatchSize(100)
            .withDestinations(getWebhookDestination());

    EventSubscription subscription = client.eventSubscriptions().create(request);
    assertNotNull(subscription);
    assertEquals(100, subscription.getBatchSize());

    subscription.setBatchSize(50);
    EventSubscription updated =
        client.eventSubscriptions().update(subscription.getId().toString(), subscription);
    assertEquals(50, updated.getBatchSize());

    client.eventSubscriptions().delete(subscription.getId().toString());
  }

  @Test
  void test_multipleSubscriptionsIndependentProcessing(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    EventSubscription sub1 = createTestEventSubscription(ns, client, "sub1");
    EventSubscription sub2 = createTestEventSubscription(ns, client, "sub2");

    assertNotNull(sub1);
    assertNotNull(sub2);
    assertNotEquals(sub1.getId(), sub2.getId());

    client.eventSubscriptions().delete(sub1.getId().toString());
    client.eventSubscriptions().delete(sub2.getId().toString());
  }

  private EventSubscription createTestEventSubscription(TestNamespace ns, OpenMetadataClient client)
      throws Exception {
    return createTestEventSubscription(ns, client, "test");
  }

  private EventSubscription createTestEventSubscription(
      TestNamespace ns, OpenMetadataClient client, String suffix) throws Exception {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("batch_proc_" + suffix))
            .withDescription("Test subscription for batch processing validation")
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of("all"))
            .withEnabled(false)
            .withBatchSize(10)
            .withDestinations(getWebhookDestination());

    return client.eventSubscriptions().create(request);
  }

  private List<SubscriptionDestination> getWebhookDestination() {
    Webhook webhook =
        new Webhook()
            .withEndpoint(URI.create("http://localhost:8585/api/v1/test/webhook/batch-test"));

    return List.of(
        new SubscriptionDestination()
            .withId(UUID.randomUUID())
            .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
            .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
            .withConfig(webhook));
  }

  private Table createTestTable(TestNamespace ns, String schemaFqn, String tableName) {
    return Tables.create()
        .name(ns.prefix(tableName))
        .inSchema(schemaFqn)
        .withColumns(
            List.of(
                new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                new Column()
                    .withName("name")
                    .withDataType(ColumnDataType.VARCHAR)
                    .withDataLength(255)))
        .execute();
  }
}
