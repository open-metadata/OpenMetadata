package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.node.ObjectNode;
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
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
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
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.DataAssetServiceDAOs.DatabaseServiceDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

/**
 * A webhook is sent only the secrets encrypted for its own destination. Before the 2.1.0 data step,
 * a real send and a test send use no stored ciphertext. The step carries over the credentials
 * earlier releases encrypted, unless the same ciphertext is stored somewhere else; any other value
 * is refused with a reason until it is entered again, and the destination stays enabled.
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
  private static final String OLD_CLIENT_SECRET = "a client secret entered long ago";

  @Test
  void aStoredValueNotWrittenForItsDestinationIsNeverSent(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String heldElsewhere = "held-elsewhere-" + UUID.randomUUID();
      EventSubscription alert = legacyAlert(ns, "stored_elsewhere", receiver, heldElsewhere);

      HttpResponse<String> testSend = postTestDestination(readAsAdmin(alert.getId()));
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertEquals(400, testSend.statusCode(), testSend.body());
      assertTrue(testSend.body().contains("must be entered again"), testSend.body());
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
  void theUpgradeStepCarriesOverEarlierCredentialsAndLeavesTheRestToEnterAgain(TestNamespace ns)
      throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/token", "{\"access_token\":\"the-token\",\"expires_in\":3600}");
      String heldElsewhere = "held-elsewhere-" + UUID.randomUUID();
      EventSubscription alert = legacyAlert(ns, "upgraded", receiver, heldElsewhere);

      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));
      EventSubscription upgraded = AlertFixtures.stored(alert.getId());
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(upgraded);

      List<RecordingReceiver.Received> sends = receiver.received();
      assertFalse(sendsTo(sends, "/hook-signed").isEmpty(), "the signing key is carried over");
      assertTrue(
          sendsTo(sends, "/hook-signed").stream()
              .allMatch(send -> signedWith(send, OLD_SIGNING_KEY)));
      assertTrue(
          sendsTo(sends, "/token").stream().anyMatch(send -> carries(send, OLD_CLIENT_SECRET)),
          "the OAuth2 client secret is carried over");
      assertFalse(sendsTo(sends, "/hook-oauth").isEmpty());
      assertTrue(sendsTo(sends, "/hook-stored-twice").isEmpty(), sends.toString());
      assertTrue(sendsTo(sends, "/hook-header").isEmpty(), sends.toString());
      assertTrue(sends.stream().noneMatch(send -> carries(send, heldElsewhere)));
      List<SubscriptionDestination> destinations = upgraded.getDestinations();
      assertTrue(destinations.stream().allMatch(SubscriptionDestination::getEnabled));
      for (SubscriptionDestination toEnterAgain : destinations.subList(2, 4)) {
        String status = destinationStatus(alert.getId(), toEnterAgain.getId());
        assertTrue(status.contains("must be entered again"), status);
      }
      HttpResponse<String> testSend =
          postTestDestination(List.of(readAsAdmin(alert.getId()).get(2)));
      assertEquals(400, testSend.statusCode(), testSend.body());
      assertTrue(testSend.body().contains("must be entered again"), testSend.body());
    }
  }

  /** Only an edit can repair these values, so the alert has to stay editable until they are. */
  @Test
  void aValueLeftToEnterAgainStopsNoEditAndDeliversOnceEntered(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      receiver.answer("/token", "{\"access_token\":\"the-token\",\"expires_in\":3600}");
      String clientSecret = ns.prefix("client-secret-entered-again");
      String header = ns.prefix("header-entered-again");
      EventSubscription alert = legacyAlert(ns, "entered_again", receiver, "held-elsewhere");
      TestSuiteBootstrap.getJdbi()
          .useHandle(
              handle -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));

      HttpResponse<String> renamed =
          patchAlert(alert.getId(), replace("/description", "edited after the upgrade"));
      HttpResponse<String> entered =
          patchAlert(
              alert.getId(),
              replace("/destinations/2/config/authType/clientSecret", clientSecret),
              replace("/destinations/3/config/headers/X-Legacy", header));
      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(AlertFixtures.stored(alert.getId()));

      assertEquals(200, renamed.statusCode(), renamed.body());
      assertEquals(200, entered.statusCode(), entered.body());
      List<RecordingReceiver.Received> sends = receiver.received();
      assertTrue(sendsTo(sends, "/token").stream().anyMatch(send -> carries(send, clientSecret)));
      assertFalse(sendsTo(sends, "/hook-stored-twice").isEmpty(), sends.toString());
      assertTrue(
          sendsTo(sends, "/hook-header").stream()
              .anyMatch(send -> header.equals(headerOf(send, "X-Legacy"))),
          sends.toString());
    }
  }

  /**
   * An alert stored as a release before 2.1 could store it: a signing key and an OAuth2 client
   * secret the server encrypted for it, an OAuth2 client secret whose ciphertext a database service
   * stores too, and a header value holding ciphertext.
   */
  private static EventSubscription legacyAlert(
      TestNamespace ns, String name, RecordingReceiver receiver, String heldElsewhere) {
    String storedTwice = storedInADatabaseService(ns, heldElsewhere);
    EventSubscription alert =
        createAlert(
            ns,
            name,
            List.of(
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-signed")),
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-oauth")),
                AlertFixtures.external(WEBHOOK, receiver.url("/hook-stored-twice")),
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
                Map.of(
                    "authType",
                    oauth2(
                        receiver,
                        Fernet.getInstance().encrypt(uniqueClientId()),
                        Fernet.getInstance().encrypt(OLD_CLIENT_SECRET)))));
    destinations
        .get(2)
        .withConfig(
            legacyConfig(
                receiver,
                "/hook-stored-twice",
                Map.of("authType", oauth2(receiver, uniqueClientId(), storedTwice))));
    destinations
        .get(3)
        .withConfig(
            legacyConfig(
                receiver,
                "/hook-header",
                Map.of(
                    "headers", Map.of("X-Legacy", Fernet.getInstance().encrypt(heldElsewhere)))));
    return AlertFixtures.writeBehindTheServer(alert);
  }

  // A database service whose stored connection holds the password encrypted, as the server stores
  // it.
  private static String storedInADatabaseService(TestNamespace ns, String password) {
    String ciphertext = Fernet.getInstance().encrypt(password);
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseServiceDAO dao = Entity.getCollectionDAO().dbServiceDAO();
    ObjectNode row =
        (ObjectNode) JsonUtils.readTree(dao.findById(dao.getTableName(), service.getId(), ""));
    ((ObjectNode) row.at("/connection/config"))
        .set("authType", JsonUtils.valueToTree(Map.of("password", ciphertext)));
    dao.update(JsonUtils.readValue(row.toString(), DatabaseService.class));
    return ciphertext;
  }

  private static String destinationStatus(UUID alertId, UUID destinationId) throws Exception {
    HttpRequest request =
        HttpRequest.newBuilder()
            .uri(
                URI.create(
                    SdkClients.getServerUrl()
                        + "/v1/events/subscriptions/"
                        + alertId
                        + "/status/"
                        + destinationId))
            .header("Authorization", "Bearer " + SdkClients.getAdminToken())
            .GET()
            .build();
    return HttpClient.newHttpClient().send(request, HttpResponse.BodyHandlers.ofString()).body();
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

  private static Map<String, String> replace(String path, String value) {
    return Map.of("op", "replace", "path", path, "value", value);
  }

  @SafeVarargs
  private static HttpResponse<String> patchAlert(UUID id, Map<String, String>... operations)
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
