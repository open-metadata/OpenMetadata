package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import com.macasaet.fernet.Key;
import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.channel.DestinationSecrets;
import org.openmetadata.service.alerting.channel.ProfileWebhookSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.AccessControlDAOs.TeamDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.DataMigrationStep;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;
import org.openmetadata.service.secrets.BoundCiphertext;

/**
 * The 2.1.0 migration brings stored webhook configurations to the form new writes store, and a
 * second run changes nothing.
 *
 * <p>Isolated: the migration rewrites every user, team and alert row, which another test may be
 * writing behind the server on purpose.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class WebhookSecretsMigrationIT {

  @Test
  void legacyProfileWebhookSecretsAreEncryptedWhereStoredAndMaskedInEvents(TestNamespace ns) {
    String secret = ns.prefix("legacy-team-secret");
    String endpoint = "https://hooks.example.com/" + ns.shortPrefix();
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("legacy_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    Profile legacy = legacyProfile(endpoint, secret);
    TeamDAO dao = Entity.getCollectionDAO().teamDAO();
    Team stored =
        JsonUtils.readValue(dao.findById(dao.getTableName(), team.getId(), ""), Team.class);
    dao.update(stored.withProfile(legacy).withChangeDescription(profileChange(legacy)));
    EntityRepository.invalidateCacheForEntity(
        Entity.TEAM, team.getId(), team.getFullyQualifiedName());
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .insert(
            team.getId(),
            "team.version.0.05",
            Entity.TEAM,
            JsonUtils.pojoToJson(stored.withVersion(0.05)));
    UUID eventId = UUID.randomUUID();
    Entity.getCollectionDAO()
        .changeEventDAO()
        .insert(
            JsonUtils.pojoToJson(
                new ChangeEvent()
                    .withId(eventId)
                    .withEventType(EventType.ENTITY_UPDATED)
                    .withEntityType(Entity.TEAM)
                    .withEntityId(team.getId())
                    .withUserName("admin")
                    .withTimestamp(System.currentTimeMillis())
                    .withChangeDescription(profileChange(legacy))
                    .withEntity(JsonUtils.pojoToJson(stored))));

    runProfileStep();
    String rowAfterOneRun = dao.findById(dao.getTableName(), team.getId(), "");
    runProfileStep();

    assertEquals(rowAfterOneRun, dao.findById(dao.getTableName(), team.getId(), ""));
    JsonNode row = JsonUtils.readTree(rowAfterOneRun);
    assertEquals(secret, openedProfileValue(row, "/authType/clientSecret"));
    assertEquals(endpoint, openedProfileValue(row, "/endpoint"));
    String recorded = row.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertFalse(recorded.contains(secret), recorded);
    assertTrue(recorded.contains(PASSWORD_MASK), recorded);
    String version =
        Entity.getCollectionDAO()
            .entityExtensionDAO()
            .getExtension(team.getId(), "team.version.0.05");
    assertFalse(version.contains(secret), version);
    assertFalse(version.contains(endpoint), version);
    String event = changeEventJson(eventId);
    assertFalse(event.contains(secret), event);
    assertFalse(event.contains(endpoint), event);
    assertTrue(event.contains(PASSWORD_MASK), event);
  }

  @Test
  void legacyAlertDestinationSecretsAreEncrypted(TestNamespace ns) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            "legacy_alert",
            null,
            List.of(AlertFixtures.external(WEBHOOK, "https://hooks.example.com/legacy")));
    String secret = ns.prefix("legacy-alert-key");
    alert
        .getDestinations()
        .getFirst()
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/legacy",
                "authType",
                Map.of("type", "bearer", "secretKey", secret)));
    AlertFixtures.writeBehindTheServer(alert);

    Jdbi jdbi = TestSuiteBootstrap.getJdbi();
    jdbi.useHandle(
        handle -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));

    SubscriptionDestination stored =
        AlertFixtures.stored(alert.getId()).getDestinations().getFirst();
    assertEquals(secret, openedDestinationValue(stored, "/authType/secretKey"));
    assertEquals("https://hooks.example.com/legacy", openedDestinationValue(stored, "/endpoint"));
  }

  /**
   * Ciphertext is carried over where releases before 2.1 stored it encrypted, the bearer and OAuth2
   * credentials, wherever else the same value is stored: each copy for the destination that holds
   * it. Anywhere else it stays as stored, is refused when the destination sends, and the
   * destination stays enabled.
   */
  @Test
  void earlierCredentialsAreCarriedOverAndAnyOtherCiphertextIsEnteredAgain(TestNamespace ns) {
    String signingKey = ns.prefix("signing-key");
    String clientSecret = ns.prefix("client-secret");
    String twice = ns.prefix("a value stored twice");
    String storedTwice = Fernet.getInstance().encrypt(twice);
    String header = Fernet.getInstance().encrypt(ns.prefix("a header value"));
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            "legacy_ciphertext",
            null,
            List.of(
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/signed"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/oauth"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/twice"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/header")));
    List<SubscriptionDestination> destinations = alert.getDestinations();
    destinations
        .get(0)
        .withConfig(
            legacyConfig(
                "signed",
                Map.of("type", "bearer", "secretKey", Fernet.getInstance().encrypt(signingKey))));
    destinations
        .get(1)
        .withConfig(legacyConfig("oauth", oauth2(Fernet.getInstance().encrypt(clientSecret))));
    destinations.get(2).withConfig(legacyConfig("twice", oauth2(storedTwice)));
    destinations
        .get(3)
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/header",
                "headers",
                Map.of("Authorization", header)));
    AlertFixtures.writeBehindTheServer(alert);
    insertChangeEvent(Entity.EVENT_SUBSCRIPTION, alert.getId(), JsonUtils.pojoToJson(alert));
    EventSubscription another =
        AlertFixtures.tableAlert(
            ns,
            "holds_the_same_value",
            null,
            List.of(AlertFixtures.external(WEBHOOK, "https://hooks.example.com/another")));
    another.getDestinations().getFirst().withConfig(legacyConfig("another", oauth2(storedTwice)));
    AlertFixtures.writeBehindTheServer(another);

    runAlertStep();
    String rowAfterOneRun = JsonUtils.pojoToJson(AlertFixtures.stored(alert.getId()));
    runAlertStep();

    EventSubscription stored = AlertFixtures.stored(alert.getId());
    assertEquals(rowAfterOneRun, JsonUtils.pojoToJson(stored));
    List<SubscriptionDestination> bound = stored.getDestinations();
    assertEquals(signingKey, openedDestinationValue(bound.get(0), "/authType/secretKey"));
    assertEquals(clientSecret, openedDestinationValue(bound.get(1), "/authType/clientSecret"));
    assertEquals(twice, openedDestinationValue(bound.get(2), "/authType/clientSecret"));
    SubscriptionDestination anotherCopy =
        AlertFixtures.stored(another.getId()).getDestinations().getFirst();
    assertEquals(twice, openedDestinationValue(anotherCopy, "/authType/clientSecret"));
    assertEquals(header, storedValue(bound.get(3), "/headers/Authorization"));
    BadRequestException refused =
        assertThrows(BadRequestException.class, () -> DestinationSecrets.decrypted(bound.get(3)));
    assertTrue(refused.getMessage().contains("must be entered again"), refused.getMessage());
    assertTrue(bound.stream().allMatch(SubscriptionDestination::getEnabled));
  }

  /**
   * Run with Fernet keys that open none of the credentials earlier releases stored, the alert step
   * stops the upgrade before it writes anything, the profile step after it does not run, and
   * neither records its marker; with the right keys the same run goes through.
   */
  @Test
  void anUpgradeWithKeysThatOpenNoEarlierCredentialStopsAndRunsAgainOnceTheKeyIsRight(
      TestNamespace ns) {
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            "wrong_key",
            null,
            List.of(AlertFixtures.external(WEBHOOK, "https://hooks.example.com/wrong_key")));
    alert
        .getDestinations()
        .getFirst()
        .withConfig(
            legacyConfig(
                "wrong_key", oauth2(Fernet.getInstance().encrypt(ns.prefix("client-secret")))));
    AlertFixtures.writeBehindTheServer(alert);
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("wrong_key_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    TeamDAO teamDAO = Entity.getCollectionDAO().teamDAO();
    Team storedTeam =
        JsonUtils.readValue(teamDAO.findById(teamDAO.getTableName(), team.getId(), ""), Team.class);
    teamDAO.update(
        storedTeam.withProfile(
            legacyProfile("https://hooks.example.com/" + ns.shortPrefix(), "s")));
    EntityRepository.invalidateCacheForEntity(
        Entity.TEAM, team.getId(), team.getFullyQualifiedName());
    String alertRow = alertRow(alert.getId());
    String teamRow = teamDAO.findById(teamDAO.getTableName(), team.getId(), "");
    String version = "2.1.0-webhook-it-" + ns.shortPrefix();
    String configuredKeys =
        Fernet.getInstance().getCachedKeys().stream()
            .map(Key::serialise)
            .collect(Collectors.joining(","));

    try {
      Fernet.getInstance().setFernetKey(Key.generateKey().serialise());
      assertThrows(IllegalStateException.class, () -> runWebhookSteps(version));
      Fernet.getInstance().setFernetKey(configuredKeys);

      assertEquals(alertRow, alertRow(alert.getId()), "the alert row is left as it was");
      assertEquals(teamRow, teamDAO.findById(teamDAO.getTableName(), team.getId(), ""));
      assertEquals(0, markersOf(version), "neither step is recorded as applied");

      runWebhookSteps(version);

      assertEquals(2, markersOf(version));
      assertTrue(BoundCiphertext.isBound(storedValue(stored(alert), "/authType/clientSecret")));
    } finally {
      Fernet.getInstance().setFernetKey(configuredKeys);
      deleteMarkersOf(version);
    }
  }

  @Test
  void aProfileWebhookHoldingCiphertextIsLeftOutUntilEnteredAgain(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("legacy_cipher_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    String secret = ns.prefix("entered-secret");
    String header = Fernet.getInstance().encrypt(ns.prefix("a header value"));
    Profile legacy = legacyProfile("https://hooks.example.com/" + ns.shortPrefix(), secret);
    legacy
        .getSubscription()
        .withSlack(
            new Webhook()
                .withEndpoint(URI.create("https://hooks.example.com/slack"))
                .withHeaders(Map.of("Authorization", header)));
    TeamDAO dao = Entity.getCollectionDAO().teamDAO();
    Team stored =
        JsonUtils.readValue(dao.findById(dao.getTableName(), team.getId(), ""), Team.class);
    dao.update(stored.withProfile(legacy));
    EntityRepository.invalidateCacheForEntity(
        Entity.TEAM, team.getId(), team.getFullyQualifiedName());

    runProfileStep();

    JsonNode row = JsonUtils.readTree(dao.findById(dao.getTableName(), team.getId(), ""));
    assertEquals(header, row.at("/profile/subscription/slack/headers/Authorization").asText());
    assertEquals(secret, openedProfileValue(row, "/authType/clientSecret"));
    ProfileWebhookSecrets.Holder holder =
        new ProfileWebhookSecrets.Holder(Entity.TEAM, team.getId());
    Profile sendable =
        ProfileWebhookSecrets.decrypted(
            holder, JsonUtils.treeToValue(row.path("profile"), Profile.class));
    assertNull(sendable.getSubscription().getSlack(), "left out until it is entered again");
    assertNotNull(sendable.getSubscription().getGeneric());
  }

  // A change event as releases before 2.1 stored it: written directly, since the event DAO of 2.1
  // masks every event it stores.
  private static void insertChangeEvent(String entityType, UUID entityId, String entity) {
    String json =
        JsonUtils.pojoToJson(
            new ChangeEvent()
                .withId(UUID.randomUUID())
                .withEventType(EventType.ENTITY_UPDATED)
                .withEntityType(entityType)
                .withEntityId(entityId)
                .withUserName("admin")
                .withTimestamp(System.currentTimeMillis())
                .withEntity(entity));
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "INSERT INTO change_event (json) VALUES (:json)"
            : "INSERT INTO change_event (json) VALUES (:json::jsonb)";
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.createUpdate(sql).bind("json", json).execute());
  }

  private static Map<String, Object> oauth2(String clientSecret) {
    return Map.of(
        "type",
        "oauth2",
        "tokenUrl",
        "https://login.example.com/token",
        "clientId",
        "client",
        "clientSecret",
        clientSecret);
  }

  private static String storedValue(SubscriptionDestination stored, String field) {
    return JsonUtils.valueToTree(stored.getConfig()).at(field).asText();
  }

  private static Map<String, Object> legacyConfig(String path, Map<String, Object> authType) {
    return Map.of("endpoint", "https://hooks.example.com/" + path, "authType", authType);
  }

  // The webhook steps as the 2.1.0 migration runs them, under a version of their own.
  private static void runWebhookSteps(String version) {
    MigrationDAO migrationDAO = TestSuiteBootstrap.getJdbi().onDemand(MigrationDAO.class);
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> {
              DataMigrationStep.runOnce(
                  migrationDAO,
                  version,
                  WebhookSecretsMigration.ALERT_STEP_NAME,
                  () -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));
              DataMigrationStep.runOnce(
                  migrationDAO,
                  version,
                  WebhookSecretsMigration.PROFILE_STEP_NAME,
                  () -> WebhookSecretsMigration.bindProfileWebhookSecrets(handle, dialect()));
            });
  }

  private static int markersOf(String version) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
                    .bind("version", version)
                    .mapTo(Integer.class)
                    .one());
  }

  private static void deleteMarkersOf(String version) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("DELETE FROM SERVER_MIGRATION_SQL_LOGS WHERE version = :version")
                    .bind("version", version)
                    .execute());
  }

  private static String alertRow(UUID id) {
    String json = dialect() == ConnectionType.MYSQL ? "CAST(json AS CHAR)" : "json::text";
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT " + json + " FROM event_subscription_entity WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .one());
  }

  private static SubscriptionDestination stored(EventSubscription alert) {
    return AlertFixtures.stored(alert.getId()).getDestinations().getFirst();
  }

  private static void runAlertStep() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> WebhookSecretsMigration.bindAlertDestinationSecrets(handle, dialect()));
  }

  private static void runProfileStep() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> WebhookSecretsMigration.bindProfileWebhookSecrets(handle, dialect()));
  }

  private static String changeEventJson(UUID eventId) {
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "SELECT CAST(json AS CHAR) FROM change_event WHERE json ->> '$.id' = :id"
            : "SELECT json::text FROM change_event WHERE json ->> 'id' = :id";
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle.createQuery(sql).bind("id", eventId.toString()).mapTo(String.class).one());
  }

  private static Profile legacyProfile(String endpoint, String secret) {
    return new Profile()
        .withSubscription(
            new SubscriptionConfig()
                .withGeneric(
                    new Webhook()
                        .withEndpoint(URI.create(endpoint))
                        .withAuthType(
                            Map.of(
                                "type",
                                "oauth2",
                                "tokenUrl",
                                "https://login.example.com/token",
                                "clientId",
                                "client",
                                "clientSecret",
                                secret))));
  }

  private static ChangeDescription profileChange(Profile profile) {
    return new ChangeDescription()
        .withPreviousVersion(0.1)
        .withFieldsUpdated(
            List.of(
                new FieldChange()
                    .withName("profile")
                    .withOldValue(JsonUtils.pojoToJson(new Profile()))
                    .withNewValue(JsonUtils.pojoToJson(profile))));
  }

  private static String openedDestinationValue(SubscriptionDestination stored, String field) {
    String value = JsonUtils.valueToTree(stored.getConfig()).at(field).asText();
    assertTrue(BoundCiphertext.isBound(value), "not bound to its destination: " + value);
    return JsonUtils.valueToTree(DestinationSecrets.decrypted(stored).getConfig())
        .at(field)
        .asText();
  }

  private static String openedProfileValue(JsonNode teamRow, String field) {
    String value = teamRow.at("/profile/subscription/generic" + field).asText();
    assertTrue(BoundCiphertext.isBound(value), "not bound to its webhook: " + value);
    ProfileWebhookSecrets.Holder holder =
        new ProfileWebhookSecrets.Holder(Entity.TEAM, UUID.fromString(teamRow.path("id").asText()));
    Profile profile = JsonUtils.treeToValue(teamRow.path("profile"), Profile.class);
    return JsonUtils.valueToTree(ProfileWebhookSecrets.decrypted(holder, profile))
        .at("/subscription/generic" + field)
        .asText();
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
