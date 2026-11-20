package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.InputStream;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.sdk.fluent.Databases;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AbstractEventConsumer;

/**
 * An alert created disabled has never run, so reading its page must not decide where it starts:
 * once enabled it sends what happens from then on, not what happened since its page was first read.
 * Isolated because it waits for a scheduled alert to deliver.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class AlertCreatedDisabledIT {

  private static final String ALERTS_PATH = "/v1/events/subscriptions";

  @Test
  void readingTheDetailsPageOfAnAlertCreatedDisabledDoesNotDecideWhereItStarts(TestNamespace ns)
      throws Exception {
    List<String> received = new CopyOnWriteArrayList<>();
    HttpServer receiver = HttpServer.create(new InetSocketAddress(0), 0);
    receiver.createContext("/webhook", exchange -> record(exchange, received));
    receiver.start();
    try {
      DatabaseSchema schema = schemaOf(ns);
      EventSubscription alert = createDisabled(ns, receiver.getAddress().getPort());

      readTheDetailsPage(alert);
      assertNull(
          Entity.getCollectionDAO()
              .eventSubscriptionDAO()
              .getSubscriberExtension(
                  alert.getId().toString(), AbstractEventConsumer.OFFSET_EXTENSION),
          "a read must not save an offset");

      String whileDisabled = createTable(ns, schema, "while_disabled");
      enable(alert);
      String onceEnabled = createTable(ns, schema, "once_enabled");

      Awaitility.await("the table created once the alert is enabled to be delivered")
          .pollInterval(Duration.ofSeconds(1))
          .atMost(Duration.ofSeconds(90))
          .until(() -> received.stream().anyMatch(body -> body.contains(onceEnabled)));
      assertFalse(
          received.stream().anyMatch(body -> body.contains(whileDisabled)),
          "nothing from before the alert was enabled");
    } finally {
      receiver.stop(0);
    }
  }

  private static DatabaseSchema schemaOf(TestNamespace ns) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    Database database =
        Databases.create().name(ns.prefix("db")).in(service.getFullyQualifiedName()).execute();
    return DatabaseSchemaTestFactory.create(ns, database.getFullyQualifiedName());
  }

  private static EventSubscription createDisabled(TestNamespace ns, int port) {
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("created_disabled"))
            .withAlertType(CreateEventSubscription.AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withEnabled(false)
            .withPollInterval(1)
            .withBatchSize(100)
            .withDestinations(
                List.of(
                    new SubscriptionDestination()
                        .withId(UUID.randomUUID())
                        .withType(SubscriptionDestination.SubscriptionType.WEBHOOK)
                        .withCategory(SubscriptionDestination.SubscriptionCategory.EXTERNAL)
                        .withConfig(
                            new Webhook()
                                .withEndpoint(
                                    URI.create("http://localhost:" + port + "/webhook")))));
    EventSubscription alert = SdkClients.adminClient().eventSubscriptions().create(request);
    ns.trackRoot(Entity.EVENT_SUBSCRIPTION, alert);
    return alert;
  }

  // The calls the alert's details page makes.
  private static void readTheDetailsPage(EventSubscription alert) {
    String byId = ALERTS_PATH + "/id/" + alert.getId();
    for (String path : List.of(byId + "/eventsRecord", byId + "/diagnosticInfo")) {
      SdkClients.adminClient()
          .getHttpClient()
          .executeForString(HttpMethod.GET, path, null, RequestOptions.builder().build());
    }
  }

  private static void enable(EventSubscription alert) {
    EventSubscription stored =
        SdkClients.adminClient().eventSubscriptions().get(alert.getId().toString());
    stored.setEnabled(true);
    EventSubscription enabled =
        SdkClients.adminClient().eventSubscriptions().update(alert.getId().toString(), stored);
    assertEquals(Boolean.TRUE, enabled.getEnabled());
  }

  private static String createTable(TestNamespace ns, DatabaseSchema schema, String name) {
    return Tables.create()
        .name(ns.prefix(name))
        .inSchema(schema.getFullyQualifiedName())
        .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
        .execute()
        .getName();
  }

  private static void record(HttpExchange exchange, List<String> received) throws IOException {
    try (InputStream body = exchange.getRequestBody()) {
      received.add(new String(body.readAllBytes(), StandardCharsets.UTF_8));
    }
    exchange.sendResponseHeaders(200, -1);
    exchange.close();
  }
}
