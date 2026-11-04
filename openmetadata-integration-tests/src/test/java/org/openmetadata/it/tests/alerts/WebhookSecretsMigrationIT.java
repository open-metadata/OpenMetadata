package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;
import static org.openmetadata.service.secrets.masker.PasswordEntityMasker.PASSWORD_MASK;

import com.fasterxml.jackson.databind.JsonNode;
import java.net.URI;
import java.util.List;
import java.util.Map;
import java.util.UUID;
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
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;
import org.openmetadata.service.secrets.OwnedCiphertext;

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
   * Ciphertext in a row stored before secrets were bound to their webhook may have been written for
   * anything, so it is kept only where it never leaves the server, the signing key; anywhere else it
   * is removed, and the destination disabled, or the profile webhook removed, until entered again.
   */
  @Test
  void legacyCiphertextIsKeptOnlyWhereItNeverLeavesTheServer(TestNamespace ns) {
    String foreign = Fernet.getInstance().encrypt(ns.prefix("a value held elsewhere"));
    String signingKey = ns.prefix("signing-key");
    EventSubscription alert =
        AlertFixtures.tableAlert(
            ns,
            "legacy_ciphertext",
            null,
            List.of(
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/signed"),
                AlertFixtures.external(WEBHOOK, "https://hooks.example.com/oauth"),
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
        .withConfig(
            legacyConfig(
                "oauth",
                Map.of(
                    "type",
                    "oauth2",
                    "tokenUrl",
                    "https://login.example.com/token",
                    "clientId",
                    "client",
                    "clientSecret",
                    foreign)));
    destinations
        .get(2)
        .withConfig(
            Map.of(
                "endpoint",
                "https://hooks.example.com/header",
                "headers",
                Map.of("Authorization", foreign)));
    AlertFixtures.writeBehindTheServer(alert);

    runAlertStep();
    String rowAfterOneRun = JsonUtils.pojoToJson(AlertFixtures.stored(alert.getId()));
    runAlertStep();

    EventSubscription stored = AlertFixtures.stored(alert.getId());
    assertEquals(rowAfterOneRun, JsonUtils.pojoToJson(stored));
    assertFalse(rowAfterOneRun.contains(foreign), rowAfterOneRun);
    List<SubscriptionDestination> bound = stored.getDestinations();
    assertEquals(signingKey, openedDestinationValue(bound.get(0), "/authType/secretKey"));
    assertTrue(
        JsonUtils.valueToTree(bound.get(1)).at("/config/authType/clientSecret").isMissingNode());
    assertTrue(
        JsonUtils.valueToTree(bound.get(2)).at("/config/headers/Authorization").isMissingNode());
    assertEquals(
        List.of(true, false, false),
        bound.stream().map(SubscriptionDestination::getEnabled).toList());
  }

  @Test
  void aProfileWebhookHoldingLegacyCiphertextIsRemoved(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("legacy_cipher_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    String secret = ns.prefix("entered-secret");
    Profile legacy = legacyProfile("https://hooks.example.com/" + ns.shortPrefix(), secret);
    legacy
        .getSubscription()
        .withSlack(
            new Webhook()
                .withEndpoint(URI.create("https://hooks.example.com/slack"))
                .withHeaders(
                    Map.of(
                        "Authorization",
                        Fernet.getInstance().encrypt(ns.prefix("a value held elsewhere")))));
    TeamDAO dao = Entity.getCollectionDAO().teamDAO();
    Team stored =
        JsonUtils.readValue(dao.findById(dao.getTableName(), team.getId(), ""), Team.class);
    dao.update(stored.withProfile(legacy));
    EntityRepository.invalidateCacheForEntity(
        Entity.TEAM, team.getId(), team.getFullyQualifiedName());

    runProfileStep();

    JsonNode row = JsonUtils.readTree(dao.findById(dao.getTableName(), team.getId(), ""));
    assertTrue(row.at("/profile/subscription/slack").isMissingNode(), row.toString());
    assertEquals(secret, openedProfileValue(row, "/authType/clientSecret"));
  }

  private static Map<String, Object> legacyConfig(String path, Map<String, Object> authType) {
    return Map.of("endpoint", "https://hooks.example.com/" + path, "authType", authType);
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
    assertTrue(OwnedCiphertext.isOwned(value), "not bound to its destination: " + value);
    return JsonUtils.valueToTree(DestinationSecrets.decrypted(stored).getConfig())
        .at(field)
        .asText();
  }

  private static String openedProfileValue(JsonNode teamRow, String field) {
    String value = teamRow.at("/profile/subscription/generic" + field).asText();
    assertTrue(OwnedCiphertext.isOwned(value), "not bound to its webhook: " + value);
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
