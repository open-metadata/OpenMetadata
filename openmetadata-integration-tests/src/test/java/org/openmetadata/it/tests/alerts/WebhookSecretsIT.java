package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.Key;
import com.macasaet.fernet.Token;
import java.net.URI;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
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
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

/**
 * A webhook is sent the secrets it stores, decrypted with the server's Fernet keys, by a real send
 * and by a test send. Credentials stored before the 2.1.0 data step keep sending after it. A value
 * no configured key decrypts is refused with a reason until it is entered again, and the alert
 * stays editable. A destination's status is the server's: one sent with the alert is never stored,
 * and a list of alerts reads it as a single alert does.
 *
 * <p>Isolated: the data step rewrites every alert row, and a tick counts every change event.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class WebhookSecretsIT {
  private static final String TABLE_FQN = "golden_service.golden_db.golden_schema.orders";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final String SIGNATURE = "X-OM-Signature";
  private static final String OLD_SIGNING_KEY = "a signing key entered long ago";
  private static final String OLD_CLIENT_SECRET = "a client secret entered long ago";

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
  void credentialsStoredBeforeTheUpgradeKeepSending(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/token", "{\"access_token\":\"the-token\",\"expires_in\":3600}");
      String header = ns.prefix("a header stored in the clear");
      EventSubscription alert =
          createAlert(
              ns,
              "upgraded",
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/hook-signed")),
                  AlertFixtures.external(WEBHOOK, receiver.url("/hook-oauth"))));
      QuietAlert.settle(alert);
      List<SubscriptionDestination> destinations = alert.getDestinations();
      destinations
          .get(0)
          .withConfig(
              legacyConfig(
                  receiver,
                  "/hook-signed",
                  Map.of(
                      "headers",
                      Map.of("X-Header", header),
                      "authType",
                      bearer(Fernet.getInstance().encrypt(OLD_SIGNING_KEY)))));
      destinations
          .get(1)
          .withConfig(
              legacyConfig(
                  receiver,
                  "/hook-oauth",
                  Map.of(
                      "authType",
                      oauth2(
                          receiver,
                          Fernet.getInstance().encrypt(uniqueClientId()),
                          Fernet.getInstance().encrypt(OLD_CLIENT_SECRET)))));
      AlertFixtures.writeBehindTheServer(alert);

      runTheUpgradeStep(ns);
      EventSubscription upgraded = AlertFixtures.stored(alert.getId());
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(upgraded);

      List<RecordingReceiver.Received> sends = receiver.received();
      assertFalse(sendsTo(sends, "/hook-signed").isEmpty(), "the signing key still signs");
      assertTrue(
          sendsTo(sends, "/hook-signed").stream()
              .allMatch(
                  send ->
                      signedWith(send, OLD_SIGNING_KEY)
                          && header.equals(headerOf(send, "X-Header"))));
      assertTrue(
          sendsTo(sends, "/token").stream().anyMatch(send -> carries(send, OLD_CLIENT_SECRET)),
          "the OAuth2 client secret is still sent to its token URL");
      assertFalse(sendsTo(sends, "/hook-oauth").isEmpty());
      assertTrue(upgraded.getDestinations().stream().allMatch(SubscriptionDestination::getEnabled));
    }
  }

  /** Only an edit can repair a value no key decrypts, so the alert stays editable until it is. */
  @Test
  void aValueNoKeyDecryptsIsRefusedStopsNoEditAndDeliversOnceEntered(TestNamespace ns)
      throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/token", "{\"access_token\":\"the-token\",\"expires_in\":3600}");
      String clientSecret = ns.prefix("client-secret-entered-again");
      String header = ns.prefix("header-entered-again");
      EventSubscription alert =
          createAlert(
              ns,
              "entered_again",
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/hook-oauth")),
                  AlertFixtures.external(WEBHOOK, receiver.url("/hook-header"))));
      QuietAlert.settle(alert);
      List<SubscriptionDestination> destinations = alert.getDestinations();
      destinations
          .get(0)
          .withConfig(
              storedConfig(
                  receiver,
                  "/hook-oauth",
                  Map.of(
                      "authType",
                      oauth2(
                          receiver,
                          Fernet.getInstance().encrypt(uniqueClientId()),
                          encryptedWithAnotherKey("old")))));
      destinations
          .get(1)
          .withConfig(
              storedConfig(
                  receiver,
                  "/hook-header",
                  Map.of("headers", Map.of("X-Legacy", encryptedWithAnotherKey("old")))));
      AlertFixtures.writeBehindTheServer(alert);

      List<SubscriptionDestination> read = readAsAdmin(alert.getId());
      HttpResponse<String> oauthTestSend = postTestDestination(List.of(read.get(0)));
      HttpResponse<String> headerTestSend = postTestDestination(List.of(read.get(1)));
      HttpResponse<String> renamed =
          patchAlert(alert.getId(), replace("/description", "edited while it cannot send"));
      HttpResponse<String> entered =
          patchAlert(
              alert.getId(),
              replace("/destinations/0/config/authType/clientSecret", clientSecret),
              replace("/destinations/1/config/headers/X-Legacy", header));
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(AlertFixtures.stored(alert.getId()));

      for (HttpResponse<String> testSend : List.of(oauthTestSend, headerTestSend)) {
        assertEquals(400, testSend.statusCode(), testSend.body());
        assertTrue(testSend.body().contains("must be entered again"), testSend.body());
      }
      assertEquals(200, renamed.statusCode(), renamed.body());
      assertEquals(200, entered.statusCode(), entered.body());
      List<RecordingReceiver.Received> sends = receiver.received();
      assertTrue(sendsTo(sends, "/token").stream().anyMatch(send -> carries(send, clientSecret)));
      assertTrue(
          sendsTo(sends, "/hook-header").stream()
              .anyMatch(send -> header.equals(headerOf(send, "X-Legacy"))),
          sends.toString());
    }
  }

  @Test
  void aStatusSentWithTheAlertIsNeverStored(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      SubscriptionStatus sent =
          new SubscriptionStatus()
              .withStatus(SubscriptionStatus.Status.FAILED)
              .withLastFailedReason("sent with the alert");
      CreateEventSubscription request =
          alertRequest(
              ns,
              "status_sent",
              List.of(
                  AlertFixtures.external(WEBHOOK, receiver.url("/hook")).withStatusDetails(sent)));
      UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
      SubscriptionDestination created = AlertFixtures.stored(id).getDestinations().getFirst();

      HttpResponse<String> put = putAlert(request.withDescription("sent again"));
      SubscriptionDestination afterThePut = AlertFixtures.stored(id).getDestinations().getFirst();
      HttpResponse<String> patch =
          patchAlert(
              id, Map.of("op", "add", "path", "/destinations/0/statusDetails", "value", sent));
      SubscriptionDestination afterThePatch = AlertFixtures.stored(id).getDestinations().getFirst();

      assertNull(created.getStatusDetails());
      assertEquals(200, put.statusCode(), put.body());
      assertNull(afterThePut.getStatusDetails());
      assertEquals(200, patch.statusCode(), patch.body());
      assertNull(afterThePatch.getStatusDetails());
    }
  }

  /** A list reads what each alert's ticks reported, and gives it to that alert alone. */
  @Test
  void aListOfAlertsReadsEachDestinationsStatus(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      EventSubscription neverSent =
          createAlert(
              ns, "listed", List.of(AlertFixtures.external(WEBHOOK, receiver.url("/hook"))));
      EventSubscription failing =
          createAlert(
              ns,
              "listed_failing",
              List.of(AlertFixtures.external(WEBHOOK, receiver.url("/hook-failing"))));
      QuietAlert.settle(failing);
      failing
          .getDestinations()
          .getFirst()
          .withConfig(
              storedConfig(
                  receiver,
                  "/hook-failing",
                  Map.of("headers", Map.of("X-Legacy", encryptedWithAnotherKey("old")))));
      AlertFixtures.writeBehindTheServer(failing);
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(AlertFixtures.stored(failing.getId()));

      Map<?, ?> neverSentStatus = listedStatusOf(neverSent.getId());
      Map<?, ?> failingStatus = listedStatusOf(failing.getId());

      assertEquals(SubscriptionStatus.Status.ACTIVE.value(), neverSentStatus.get("status"));
      assertNull(neverSentStatus.get("lastFailedReason"));
      assertEquals(SubscriptionStatus.Status.FAILED.value(), failingStatus.get("status"));
      assertTrue(
          String.valueOf(failingStatus.get("lastFailedReason")).contains("must be entered again"),
          failingStatus.toString());
    }
  }

  private static Map<?, ?> listedStatusOf(UUID alertId) throws Exception {
    SubscriptionDestination listed = listedWithStatus(alertId).getFirst();
    assertNotNull(listed.getStatusDetails(), "the list reads no status");
    return JsonUtils.convertValue(listed.getStatusDetails(), Map.class);
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

  // Ciphertext written with a key the server does not have.
  private static String encryptedWithAnotherKey(String secret) {
    return Fernet.FERNET_PREFIX
        + Token.generate(new SecureRandom(), Key.generateKey(), secret).serialise();
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

  // As the server stores a configuration: its endpoint encrypted with the server's key, as every
  // other secret it holds must be, or a save that encrypts one would read as a change to judge.
  private static Map<String, Object> storedConfig(
      RecordingReceiver receiver, String path, Map<String, Object> config) {
    Map<String, Object> stored = legacyConfig(receiver, path, config);
    stored.put("endpoint", Fernet.getInstance().encrypt(receiver.url(path)));
    return stored;
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

  // The list reads its fields in bulk; every page is read until the alert is found.
  private static List<SubscriptionDestination> listedWithStatus(UUID id) throws Exception {
    String after = null;
    do {
      String query =
          "?fields=statusDetails&limit=100"
              + (after == null ? "" : "&after=" + URLEncoder.encode(after, StandardCharsets.UTF_8));
      HttpRequest request =
          HttpRequest.newBuilder()
              .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions" + query))
              .header("Authorization", "Bearer " + SdkClients.getAdminToken())
              .GET()
              .build();
      JsonNode page =
          JsonUtils.readTree(
              HttpClient.newHttpClient()
                  .send(request, HttpResponse.BodyHandlers.ofString())
                  .body());
      for (JsonNode alert : page.path("data")) {
        if (id.toString().equals(alert.path("id").asText())) {
          return JsonUtils.treeToValue(alert, EventSubscription.class).getDestinations();
        }
      }
      after = page.at("/paging/after").asText(null);
    } while (after != null);
    throw new AssertionError("The alert " + id + " is not listed");
  }

  private static Map<String, String> replace(String path, String value) {
    return Map.of("op", "replace", "path", path, "value", value);
  }

  @SafeVarargs
  private static HttpResponse<String> patchAlert(UUID id, Map<String, ?>... operations)
      throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions/" + id))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json-patch+json")
            .method(
                "PATCH",
                HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(List.of(operations))))
            .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString());
  }

  private static HttpResponse<String> putAlert(CreateEventSubscription request) throws Exception {
    HttpRequest put =
        HttpRequest.newBuilder()
            .uri(URI.create(SdkClients.getServerUrl() + "/v1/events/subscriptions"))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .header("Content-Type", "application/json")
            .PUT(HttpRequest.BodyPublishers.ofString(JsonUtils.pojoToJson(request)))
            .build();
    return HttpClient.newHttpClient().send(put, HttpResponse.BodyHandlers.ofString());
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
    UUID id =
        SdkClients.adminClient()
            .eventSubscriptions()
            .create(alertRequest(ns, name, destinations))
            .getId();
    return AlertFixtures.stored(id);
  }

  private static CreateEventSubscription alertRequest(
      TestNamespace ns, String name, List<SubscriptionDestination> destinations) {
    ArgumentsInput onlyTheFixtureTable =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("fqnList").withInput(List.of(TABLE_FQN))));
    return new CreateEventSubscription()
        .withName(ns.prefix(name))
        .withAlertType(AlertType.NOTIFICATION)
        .withResources(List.of(Entity.TABLE))
        .withInput(new AlertFilteringInput().withFilters(List.of(onlyTheFixtureTable)))
        .withEnabled(true)
        .withBatchSize(100)
        .withPollInterval(ONE_DAY_SECONDS)
        .withDestinations(destinations);
  }

  // The 2.1.0 alert step under a version of the test's own, whose marker it removes afterwards.
  private static void runTheUpgradeStep(TestNamespace ns) {
    String version = "2.1.0-webhooksecretsit" + ns.shortPrefix();
    try {
      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle ->
                  WebhookSecretsMigration.encryptAlertDestinationSecrets(
                      handle, version, dialect()));
    } finally {
      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle ->
                  handle
                      .createUpdate(
                          "DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
                      .bind("version", version)
                      .execute());
    }
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
