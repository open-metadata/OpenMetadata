package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import java.net.URI;
import java.net.URLDecoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.events.AlertFilteringInput;
import org.openmetadata.schema.api.events.CreateEventSubscription;
import org.openmetadata.schema.entity.events.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.Effect;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

/**
 * A webhook is sent only the secrets written for its own destination. A row stored by an older
 * release may hold ciphertext the server wrote for something else; a real send and a test send
 * send nothing with it, the 2.1.0 data step keeps only what is shown to be the destination's own,
 * and secrets entered for a destination keep delivering.
 *
 * <p>Isolated: the data step rewrites every alert row, and a tick counts every change event.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class WebhookSecretOwnershipIT {
  private static final String TABLE_FQN = "golden_service.golden_db.golden_schema.orders";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final String SIGNATURE = "X-OM-Signature";
  private static final String OLD_SIGNING_KEY = "a signing key entered long ago";

  @Test
  void aStoredValueNotWrittenForItsDestinationIsNeverSent(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String heldElsewhere = "held-elsewhere-" + UUID.randomUUID();
      EventSubscription alert = legacyAlert(ns, "stored_elsewhere", receiver, heldElsewhere);

      HttpResponse<String> testSend = postTestDestination(readAsAdmin(alert.getId()));
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertEquals(400, testSend.statusCode(), testSend.body());
      assertTrue(testSend.body().contains("not written for"), testSend.body());
      assertTrue(receiver.received().isEmpty(), "sent: " + receiver.received());
    }
  }

  @Test
  void secretsEnteredForADestinationStillDeliver(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/token", "{\"access_token\":\"the-token\",\"expires_in\":3600}");
      String clientSecret = ns.prefix("client-secret");
      String signingKey = ns.prefix("signing-key");
      String header = ns.prefix("header-value");
      EventSubscription alert =
          createAlert(
              ns,
              "entered",
              List.of(
                  destination(
                      receiver,
                      "/hook-oauth",
                      Map.of("authType", oauth2(receiver, uniqueClientId(), clientSecret))),
                  destination(
                      receiver,
                      "/hook-signed",
                      Map.of(
                          "headers", Map.of("X-Header", header), "authType", bearer(signingKey)))));
      QuietAlert.settle(alert);

      HttpResponse<String> testSend = postTestDestination(readAsAdmin(alert.getId()));
      assertEquals(200, testSend.statusCode(), testSend.body());
      assertDelivered(receiver, clientSecret, signingKey, header);

      int beforeTheTick = receiver.received().size();
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);
      assertTrue(receiver.received().size() > beforeTheTick, "the tick sends");
      assertDelivered(receiver, clientSecret, signingKey, header);
    }
  }

  @Test
  void afterTheUpgradeStepOnlyWhatIsShownToBeItsOwnIsSent(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String heldElsewhere = "held-elsewhere-" + UUID.randomUUID();
      EventSubscription alert = legacyAlert(ns, "upgraded", receiver, heldElsewhere);

      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(AlertFixtures.stored(alert.getId()));

      List<RecordingReceiver.Received> sends = receiver.received();
      assertFalse(sends.isEmpty(), "the signed destination still delivers");
      assertTrue(
          sends.stream().allMatch(send -> "/hook-signed".equals(send.path())), sends.toString());
      assertTrue(sends.stream().allMatch(send -> signedWith(send, OLD_SIGNING_KEY)));
      assertTrue(sends.stream().noneMatch(send -> carries(send, heldElsewhere)));
      assertEquals(
          List.of(true, false, false),
          AlertFixtures.stored(alert.getId()).getDestinations().stream()
              .map(SubscriptionDestination::getEnabled)
              .toList());
    }
  }

  /**
   * An alert stored as an older release could store it: a signing key the server encrypted for it,
   * and an OAuth2 client secret and a header value holding ciphertext written for something else.
   */
  private static EventSubscription legacyAlert(
      TestNamespace ns, String name, RecordingReceiver receiver, String heldElsewhere) {
    String ciphertext = Fernet.getInstance().encrypt(heldElsewhere);
    EventSubscription alert =
        createAlert(
            ns,
            name,
            List.of(
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-signed")),
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-oauth")),
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-header"))));
    QuietAlert.settle(alert);
    List<SubscriptionDestination> destinations = alert.getDestinations();
    destinations
        .get(0)
        .withConfig(
            legacyConfig(
                receiver,
                "/hook-signed",
                Map.of("authType", bearer(Fernet.getInstance().encrypt(OLD_SIGNING_KEY)))));
    destinations
        .get(1)
        .withConfig(
            legacyConfig(
                receiver,
                "/hook-oauth",
                Map.of("authType", oauth2(receiver, uniqueClientId(), ciphertext))));
    destinations
        .get(2)
        .withConfig(
            legacyConfig(
                receiver, "/hook-header", Map.of("headers", Map.of("X-Legacy", ciphertext))));
    return AlertFixtures.writeBehindTheServer(alert);
  }

  private static void assertDelivered(
      RecordingReceiver receiver, String clientSecret, String signingKey, String header) {
    List<RecordingReceiver.Received> sends = receiver.received();
    assertTrue(
        sendsTo(sends, "/token").stream().anyMatch(send -> carries(send, clientSecret)),
        "the token URL is sent the client secret entered for it");
    assertFalse(sendsTo(sends, "/hook-oauth").isEmpty());
    assertTrue(
        sendsTo(sends, "/hook-oauth").stream()
            .allMatch(send -> "Bearer the-token".equals(headerOf(send, "Authorization"))));
    assertFalse(sendsTo(sends, "/hook-signed").isEmpty());
    assertTrue(
        sendsTo(sends, "/hook-signed").stream()
            .allMatch(
                send -> signedWith(send, signingKey) && header.equals(headerOf(send, "X-Header"))));
  }

  private static List<RecordingReceiver.Received> sendsTo(
      List<RecordingReceiver.Received> sends, String path) {
    return sends.stream().filter(send -> path.equals(send.path())).toList();
  }

  private static boolean carries(RecordingReceiver.Received send, String value) {
    return URLDecoder.decode(send.body(), StandardCharsets.UTF_8).contains(value)
        || send.headers().values().stream().anyMatch(header -> header.contains(value));
  }

  private static boolean signedWith(RecordingReceiver.Received send, String key) {
    return ("sha256=" + CommonUtil.calculateHMAC(key, send.body()))
        .equals(headerOf(send, SIGNATURE));
  }

  private static String headerOf(RecordingReceiver.Received send, String name) {
    return send.headers().entrySet().stream()
        .filter(header -> header.getKey().equalsIgnoreCase(name))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  // The token cache is keyed by token URL and client id, so each test uses its own client id.
  private static String uniqueClientId() {
    return "client-" + UUID.randomUUID();
  }

  private static SubscriptionDestination destination(
      RecordingReceiver receiver, String path, Map<String, Object> config) {
    return AlertFixtures.external(WEBHOOK, receiver.url(path))
        .withConfig(legacyConfig(receiver, path, config));
  }

  private static Map<String, Object> legacyConfig(
      RecordingReceiver receiver, String path, Map<String, Object> config) {
    Map<String, Object> withEndpoint = new LinkedHashMap<>(config);
    withEndpoint.put("endpoint", receiver.url(path));
    return withEndpoint;
  }

  private static Map<String, Object> bearer(String signingKey) {
    return Map.of("type", "bearer", "secretKey", signingKey);
  }

  private static Map<String, Object> oauth2(
      RecordingReceiver receiver, String clientId, String clientSecret) {
    return Map.of(
        "type",
        "oauth2",
        "tokenUrl",
        receiver.url("/token"),
        "clientId",
        clientId,
        "clientSecret",
        clientSecret);
  }

  private static List<SubscriptionDestination> readAsAdmin(UUID id) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions/" + id))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    String body =
        HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).body();
    return JsonUtils.readValue(body, EventSubscription.class).getDestinations();
  }

  private static HttpResponse<String> postTestDestination(
      List<SubscriptionDestination> destinations) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions/testDestination"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .POST(
                HttpRequest.BodyPublishers.ofString(
                    JsonUtils.pojoToJson(Map.of("destinations", destinations))))
            .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static EventSubscription createAlert(
      TestNamespace ns, String name, List<SubscriptionDestination> destinations) {
    ArgumentsInput onlyTheFixtureTable =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("fqnList").withInput(List.of(TABLE_FQN))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix(name))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withInput(new AlertFilteringInput().withFilters(List.of(onlyTheFixtureTable)))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(destinations);
    UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
    return AlertFixtures.stored(id);
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
