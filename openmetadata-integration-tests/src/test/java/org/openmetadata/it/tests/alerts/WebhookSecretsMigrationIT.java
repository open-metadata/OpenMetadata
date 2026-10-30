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
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.AccessControlDAOs.TeamDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.v210.WebhookSecretsMigration;

/**
 * Rows stored before webhook secrets were encrypted on profiles and on every alert channel hold
 * them as written. The 2.1.0 migration encrypts them where they are kept and masks them in the
 * change events that recorded them, and a second run changes nothing.
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
    assertEquals(secret, decrypted(row.at("/profile/subscription/generic/authType/clientSecret")));
    assertEquals(endpoint, decrypted(row.at("/profile/subscription/generic/endpoint")));
    String recorded = row.at("/changeDescription/fieldsUpdated/0/newValue").asText();
    assertFalse(recorded.contains(secret), recorded);
    assertTrue(recorded.contains(Fernet.FERNET_PREFIX), recorded);
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
        handle -> WebhookSecretsMigration.encryptAlertDestinationSecrets(handle, dialect()));

    JsonNode config =
        JsonUtils.valueToTree(AlertFixtures.stored(alert.getId()).getDestinations().getFirst())
            .path("config");
    assertEquals(secret, decrypted(config.at("/authType/secretKey")));
    assertEquals("https://hooks.example.com/legacy", decrypted(config.at("/endpoint")));
  }

  private static void runProfileStep() {
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle -> WebhookSecretsMigration.encryptProfileWebhookSecrets(handle, dialect()));
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

  private static String decrypted(JsonNode ciphertext) {
    assertTrue(Fernet.isTokenized(ciphertext.asText()), "stored in the clear: " + ciphertext);
    return Fernet.getInstance().decrypt(ciphertext.asText());
  }

  private static ConnectionType dialect() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"))
        ? ConnectionType.MYSQL
        : ConnectionType.POSTGRES;
  }
}
