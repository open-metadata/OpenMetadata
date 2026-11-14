package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

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

    String rowAfterOneRun;
    try {
      runProfileStep(stepVersion(ns));
      rowAfterOneRun = dao.findById(dao.getTableName(), team.getId(), "");
      runProfileStep(stepVersion(ns));
    } finally {
      deleteMarkersOf(stepVersion(ns));
    }

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

    try {
      runAlertStep(stepVersion(ns));
    } finally {
      deleteMarkersOf(stepVersion(ns));
    }

    SubscriptionDestination stored =
        AlertFixtures.stored(alert.getId()).getDestinations().getFirst();
    assertEquals(secret, openedDestinationValue(stored, "/authType/secretKey"));
    assertEquals("https://hooks.example.com/legacy", openedDestinationValue(stored, "/endpoint"));
  }

  /**
   * The bearer and OAuth2 credentials releases before 2.1 encrypted stay as stored and still
   * decrypt, wherever else the same value is stored. Every other value, which those releases sent as
   * stored, is encrypted as it is and sent as it was. The step runs once: a second run for the same
   * version changes nothing. The destinations stay enabled.
   */
  @Test
  void credentialsStayAsStoredAndEveryOtherValueIsEncryptedAsItIs(TestNamespace ns) {
    String signingKey = Fernet.getInstance().encrypt(ns.prefix("signing-key"));
    String clientSecret = Fernet.getInstance().encrypt(ns.prefix("client-secret"));
    String storedTwice = Fernet.getInstance().encrypt(ns.prefix("a value stored twice"));
    String header = ns.prefix("a header value");
    String headerReadingAsCiphertext = Fernet.getInstance().encrypt(ns.prefix("a header"));
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            "legacy_ciphertext",
            null,
            List.of(
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/signed"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/oauth"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/twice"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/header"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/as-stored")));
    List<SubscriptionDestination> destinations = alert.getDestinations();
    destinations
        .get(0)
        .withConfig(legacyConfig("signed", Map.of("type", "bearer", "secretKey", signingKey)));
    destinations.get(1).withConfig(legacyConfig("oauth", oauth2(clientSecret)));
    destinations.get(2).withConfig(legacyConfig("twice", oauth2(storedTwice)));
    destinations
        .get(3)
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/header",
                "headers",
                Map.of("Authorization", header)));
    destinations
        .get(4)
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/as-stored",
                "headers",
                Map.of("Authorization", headerReadingAsCiphertext)));
    AlertFixtures.writeBehindTheServer(alert);
    EventSubscription another =
        AlertFixtures.tableAlert(
            ns,
            "holds_the_same_value",
            null,
            List.of(AlertFixtures.external(WEBHOOK, "https://hooks.example.com/another")));
    another.getDestinations().getFirst().withConfig(legacyConfig("another", oauth2(storedTwice)));
    AlertFixtures.writeBehindTheServer(another);

    String rowAfterOneRun;
    try {
      runAlertStep(stepVersion(ns));
      rowAfterOneRun = JsonUtils.pojoToJson(AlertFixtures.stored(alert.getId()));
      runAlertStep(stepVersion(ns));
    } finally {
      deleteMarkersOf(stepVersion(ns));
    }

    EventSubscription stored = AlertFixtures.stored(alert.getId());
    assertEquals(rowAfterOneRun, JsonUtils.pojoToJson(stored));
    List<SubscriptionDestination> upgraded = stored.getDestinations();
    assertEquals(signingKey, storedValue(upgraded.get(0), "/authType/secretKey"));
    assertEquals(clientSecret, storedValue(upgraded.get(1), "/authType/clientSecret"));
    assertEquals(storedTwice, storedValue(upgraded.get(2), "/authType/clientSecret"));
    assertEquals(
        ns.prefix("signing-key"), openedDestinationValue(upgraded.get(0), "/authType/secretKey"));
    assertEquals(
        ns.prefix("client-secret"),
        openedDestinationValue(upgraded.get(1), "/authType/clientSecret"));
    SubscriptionDestination anotherCopy =
        AlertFixtures.stored(another.getId()).getDestinations().getFirst();
    assertEquals(
        ns.prefix("a value stored twice"),
        openedDestinationValue(anotherCopy, "/authType/clientSecret"));
    assertEquals(header, openedDestinationValue(upgraded.get(3), "/headers/Authorization"));
    assertEquals(
        headerReadingAsCiphertext,
        openedDestinationValue(upgraded.get(4), "/headers/Authorization"));
    assertTrue(upgraded.stream().allMatch(SubscriptionDestination::getEnabled));
  }

  /**
   * A step that stops part way leaves every row as it was and records nothing, so the next run
   * starts from what releases before 2.1 stored. Here it stops on a stored change event it cannot
   * read, after it has rewritten the team rows.
   */
  @Test
  void aStepThatStopsPartWayLeavesNothingBehind(TestNamespace ns) {
    String endpoint = "https://hooks.example.com/" + ns.shortPrefix();
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("stopped_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    TeamDAO dao = Entity.getCollectionDAO().teamDAO();
    Team stored =
        JsonUtils.readValue(dao.findById(dao.getTableName(), team.getId(), ""), Team.class);
    dao.update(stored.withProfile(legacyProfile(endpoint, ns.prefix("secret"))));
    EntityRepository.invalidateCacheForEntity(
        Entity.TEAM, team.getId(), team.getFullyQualifiedName());
    String rowBefore = dao.findById(dao.getTableName(), team.getId(), "");
    UUID unreadable = insertChangeEvent(Entity.TEAM, "{\"endpoint\": \"" + endpoint);

    try {
      assertThrows(RuntimeException.class, () -> runProfileStep(stepVersion(ns)));
      assertEquals(rowBefore, dao.findById(dao.getTableName(), team.getId(), ""));
      deleteChangeEvent(unreadable);
      runProfileStep(stepVersion(ns));
    } finally {
      deleteChangeEvent(unreadable);
      deleteMarkersOf(stepVersion(ns));
    }

    JsonNode row = JsonUtils.readTree(dao.findById(dao.getTableName(), team.getId(), ""));
    assertEquals(endpoint, openedProfileValue(row, "/endpoint"));
  }

  // A profile webhook value releases before 2.1 sent as stored is still sent as it was.
  @Test
  void aProfileWebhookValueIsEncryptedAsItIsStored(TestNamespace ns) {
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

    try {
      runProfileStep(stepVersion(ns));
    } finally {
      deleteMarkersOf(stepVersion(ns));
    }

    JsonNode row = JsonUtils.readTree(dao.findById(dao.getTableName(), team.getId(), ""));
    assertEquals(secret, openedProfileValue(row, "/authType/clientSecret"));
    Profile sendable =
        ProfileWebhookSecrets.decrypted(
            "a team", JsonUtils.treeToValue(row.path("profile"), Profile.class));
    assertEquals(header, sendable.getSubscription().getSlack().getHeaders().get("Authorization"));
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

  // Each test runs the steps under a version of its own, so its markers are its own.
  private static String stepVersion(TestNamespace ns) {
    return "2.1.0-webhookit" + ns.shortPrefix();
  }

  private static void runAlertStep(String version) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                WebhookSecretsMigration.encryptAlertDestinationSecrets(handle, version, dialect()));
  }

  private static void runProfileStep(String version) {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                WebhookSecretsMigration.encryptProfileWebhookSecrets(handle, version, dialect()));
  }

  // A change event as releases before 2.1 stored it, carrying {@code entity} as written: inserted
  // directly, since the event DAO of 2.1 masks every event it stores.
  private static UUID insertChangeEvent(String entityType, String entity) {
    UUID id = UUID.randomUUID();
    String json =
        JsonUtils.pojoToJson(
            new ChangeEvent()
                .withId(id)
                .withEventType(EventType.ENTITY_UPDATED)
                .withEntityType(entityType)
                .withEntityId(UUID.randomUUID())
                .withUserName("admin")
                .withTimestamp(System.currentTimeMillis())
                .withEntity(entity));
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "INSERT INTO change_event (json) VALUES (:json)"
            : "INSERT INTO change_event (json) VALUES (:json::jsonb)";
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.createUpdate(sql).bind("json", json).execute());
    return id;
  }

  private static void deleteChangeEvent(UUID eventId) {
    String sql =
        dialect() == ConnectionType.MYSQL
            ? "DELETE FROM change_event WHERE json ->> '$.id' = :id"
            : "DELETE FROM change_event WHERE json ->> 'id' = :id";
    TestSuiteBootstrap.getJdbi()
        .useHandle(handle -> handle.createUpdate(sql).bind("id", eventId.toString()).execute());
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
    assertTrue(Fernet.isTokenized(value), "not encrypted: " + value);
    return JsonUtils.valueToTree(DestinationSecrets.decrypted(stored).getConfig())
        .at(field)
        .asText();
  }

  private static String openedProfileValue(JsonNode teamRow, String field) {
    String value = teamRow.at("/profile/subscription/generic" + field).asText();
    assertTrue(Fernet.isTokenized(value), "not encrypted: " + value);
    Profile profile = JsonUtils.treeToValue(teamRow.path("profile"), Profile.class);
    return JsonUtils.valueToTree(ProfileWebhookSecrets.decrypted("a team", profile))
        .at("/subscription/generic" + field)
        .asText();
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
