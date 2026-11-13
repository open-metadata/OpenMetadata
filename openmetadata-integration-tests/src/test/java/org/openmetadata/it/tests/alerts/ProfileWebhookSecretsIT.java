package org.openmetadata.it.tests.alerts;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.entity.events.SubscriptionDestination.SubscriptionType.WEBHOOK;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URI;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.awaitility.Awaitility;
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
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.events.AlertType;
import org.openmetadata.schema.entity.events.Argument;
import org.openmetadata.schema.entity.events.ArgumentsInput;
import org.openmetadata.schema.entity.events.Effect;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Profile;
import org.openmetadata.schema.type.Webhook;
import org.openmetadata.schema.type.profile.SubscriptionConfig;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.InvalidRequestException;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;
import org.openmetadata.service.alerting.channel.ProfileWebhookSecrets;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.AccessControlDAOs.TeamDAO;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UserDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.secrets.BoundCiphertext;

/**
 * The webhooks a user or a team keeps on its profile carry the secrets of an alert destination's
 * webhook, and keep them the same way: stored encrypted, never read back, restored when the mask is
 * sent back, and decrypted only to send.
 */
@Isolated
@ExtendWith(TestNamespaceExtension.class)
class ProfileWebhookSecretsIT {
  private static final String TABLE_FQN = "golden_service.golden_db.golden_schema.orders";
  private static final int ONE_DAY_SECONDS = 86400;
  private static final String TOKEN_URL = "https://login.example.com/token";

  @Test
  void aTeamsProfileWebhookSecretsAreStoredEncryptedAndNeverReadBack(TestNamespace ns) {
    String clientSecret = ns.prefix("team-client-secret");
    String slackHook = "https://hooks.slack.com/services/T0/B0/" + ns.shortPrefix();
    Profile profile =
        new Profile()
            .withSubscription(
                new SubscriptionConfig()
                    .withGeneric(oauth2Webhook("https://hooks.example.com/team", clientSecret))
                    .withSlack(new Webhook().withEndpoint(URI.create(slackHook))));
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("profile_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withProfile(profile));
    List<String> secrets = List.of(clientSecret, slackHook);

    JsonNode stored = storedTeam(team.getId());
    assertEquals(clientSecret, opened(Entity.TEAM, stored, "generic", "/authType/clientSecret"));
    assertEquals(slackHook, opened(Entity.TEAM, stored, "slack", "/endpoint"));
    assertEquals(TOKEN_URL, stored.at("/profile/subscription/generic/authType/tokenUrl").asText());

    OpenMetadataClient viewer = plainUserClient();
    String byName = "/v1/teams/name/" + team.getName();
    List.of(
            byName + "?fields=profile",
            "/v1/teams/" + team.getId() + "?fields=profile",
            "/v1/teams?fields=profile&limit=1000000",
            "/v1/teams/" + team.getId() + "/versions",
            "/v1/teams/" + team.getId() + "/versions/0.1")
        .forEach(path -> assertNoSecretOrCiphertext(rawGet(viewer, path), secrets));

    // Sent back as read, by PATCH or by PUT, the profile keeps what is stored.
    Team read = SdkClients.adminClient().teams().get(team.getId().toString(), "profile");
    Team edited =
        SdkClients.adminClient()
            .teams()
            .update(team.getId().toString(), read.withDescription("edited with the masks"));
    assertEquals("edited with the masks", edited.getDescription());
    assertNoSecretOrCiphertext(JsonUtils.pojoToJson(edited), secrets);
    CreateTeam resent =
        new CreateTeam()
            .withName(team.getName())
            .withTeamType(CreateTeam.TeamType.GROUP)
            .withDescription("put with the masks")
            .withProfile(read.getProfile());
    Team put =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(HttpMethod.PUT, "/v1/teams", resent, Team.class);
    assertEquals("put with the masks", put.getDescription());
    assertNoSecretOrCiphertext(JsonUtils.pojoToJson(put), secrets);
    assertEquals(stored.at("/profile"), storedTeam(team.getId()).at("/profile"));
  }

  @Test
  void aUsersOwnProfileWebhookIsMaskedInEveryRead(TestNamespace ns) {
    String signingKey = ns.prefix("user-signing-key");
    String name = "profileowner" + ns.shortPrefix();
    String email = name + "@open-metadata.org";
    User user =
        SdkClients.adminClient().users().create(new CreateUser().withName(name).withEmail(email));
    OpenMetadataClient owner = SdkClients.createClient(name, email, new String[] {});
    Map<String, Object> webhook =
        Map.of(
            "endpoint",
            "https://hooks.example.com/" + name,
            "authType",
            Map.of("type", "bearer", "secretKey", signingKey));
    JsonNode setProfile =
        JsonUtils.valueToTree(
            List.of(
                Map.of(
                    "op",
                    "add",
                    "path",
                    "/profile",
                    "value",
                    Map.of("subscription", Map.of("generic", webhook)))));

    User patched = owner.users().patch(user.getId(), setProfile);

    List<String> secrets = List.of(signingKey, "https://hooks.example.com/" + name);
    assertNoSecretOrCiphertext(JsonUtils.pojoToJson(patched), secrets);
    assertEquals(
        signingKey,
        opened(Entity.USER, storedUser(user.getId()), "generic", "/authType/secretKey"));
    OpenMetadataClient viewer = plainUserClient();
    List.of(
            "/v1/users/name/" + name + "?fields=profile",
            "/v1/users/name/" + name,
            "/v1/users/" + user.getId() + "?fields=profile",
            "/v1/users?fields=profile&limit=1000000",
            "/v1/users/" + user.getId() + "/versions",
            "/v1/users/" + user.getId() + "/versions/0.2")
        .forEach(path -> assertNoSecretOrCiphertext(rawGet(viewer, path), secrets));
    assertNoSecretOrCiphertext(rawGet(owner, "/v1/users/loggedInUser?fields=profile"), secrets);
  }

  /**
   * A team whose saved webhook cannot be used is reported on the alert that targets it, as one of
   * its recipients, and nothing is sent to it; a team without a webhook is not a recipient at all.
   */
  @Test
  void aTeamWhoseWebhookCannotBeUsedIsReportedOnTheAlert(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      Team working =
          teamWith(ns, "working_team", new Webhook().withEndpoint(URI.create(receiver.url("/ok"))));
      Team unusable =
          teamWith(
              ns, "unusable_team", new Webhook().withEndpoint(URI.create(receiver.url("/held"))));
      holdAValueThatDoesNotOpen(Entity.TEAM, unusable.getId());
      Team withoutWebhook = teamWith(ns, "no_webhook_team", null);
      EventSubscription alert =
          createAlert(
              ns,
              new SubscriptionDestination()
                  .withType(WEBHOOK)
                  .withCategory(SubscriptionDestination.SubscriptionCategory.TEAMS)
                  .withConfig(
                      Map.of(
                          "receivers",
                          List.of(
                              working.getName(), unusable.getName(), withoutWebhook.getName()))));
      QuietAlert.settle(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      assertTrue(receiver.received().stream().anyMatch(it -> "/ok".equals(it.path())));
      assertTrue(receiver.received().stream().noneMatch(it -> "/held".equals(it.path())));
      String reason = lastFailedReasonOf(alert.getId());
      assertEquals(
          "1 of 2 recipients failed. "
              + unusable.getName()
              + ": the saved webhook value cannot be used; enter it again on the team",
          reason);
    }
  }

  @Test
  void aProfileRefusesWhatOnlyTheServerMayWrite(TestNamespace ns) {
    Team team =
        SdkClients.adminClient()
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("guarded_team"))
                    .withTeamType(CreateTeam.TeamType.GROUP)
                    .withProfile(
                        profileWith(
                            oauth2Webhook("https://hooks.example.com/guarded", "the secret"))));
    String id = team.getId().toString();
    String copiedCiphertext = Fernet.getInstance().encrypt("a secret stored somewhere else");

    assertRefused(
        () ->
            SdkClients.adminClient()
                .teams()
                .create(
                    new CreateTeam()
                        .withName(ns.prefix("masked_team"))
                        .withTeamType(CreateTeam.TeamType.GROUP)
                        .withProfile(
                            profileWith(
                                oauth2Webhook("https://hooks.example.com/x", "*********")))));
    assertRefused(
        () ->
            SdkClients.adminClient()
                .teams()
                .patch(
                    id,
                    patch(
                        "replace",
                        "/profile/subscription/generic/authType/clientSecret",
                        copiedCiphertext)));
    assertRefused(
        () ->
            SdkClients.adminClient()
                .teams()
                .patch(
                    id,
                    patch(
                        "replace",
                        "/profile/subscription/generic/authType/tokenUrl",
                        "https://elsewhere.example.com/token")));
    assertRefused(
        () ->
            SdkClients.adminClient()
                .teams()
                .patch(
                    id,
                    JsonUtils.valueToTree(
                        List.of(
                            Map.of(
                                "op",
                                "copy",
                                "from",
                                "/profile/subscription/generic/authType/clientSecret",
                                "path",
                                "/description")))));
  }

  @Test
  void aTeamWebhookStillReceivesItsMessagesSignedWithItsKey(TestNamespace ns) throws Exception {
    try (RecordingReceiver receiver = new RecordingReceiver()) {
      String signingKey = ns.prefix("delivery-key");
      Team team =
          SdkClients.adminClient()
              .teams()
              .create(
                  new CreateTeam()
                      .withName(ns.prefix("delivery_team"))
                      .withTeamType(CreateTeam.TeamType.GROUP)
                      .withProfile(
                          profileWith(
                              new Webhook()
                                  .withEndpoint(URI.create(receiver.url("/team")))
                                  .withAuthType(
                                      Map.of("type", "bearer", "secretKey", signingKey)))));
      EventSubscription alert =
          createAlert(
              ns,
              new SubscriptionDestination()
                  .withType(WEBHOOK)
                  .withCategory(SubscriptionDestination.SubscriptionCategory.TEAMS)
                  .withConfig(Map.of("receivers", List.of(team.getName()))));
      QuietAlert.settle(alert);

      FixtureEvents.insert(FixtureEvents.tableEvents());
      DirectTick.run(alert);

      Awaitility.await("the team webhook receives the alert")
          .atMost(Duration.ofSeconds(60))
          .until(() -> receiver.received().stream().anyMatch(it -> "/team".equals(it.path())));
      receiver.received().stream()
          .filter(it -> "/team".equals(it.path()))
          .forEach(
              received ->
                  assertEquals(
                      "sha256=" + CommonUtil.calculateHMAC(signingKey, received.body()),
                      headerOf(received, "X-OM-Signature")));
    }
  }

  private static String headerOf(RecordingReceiver.Received received, String name) {
    return received.headers().entrySet().stream()
        .filter(header -> header.getKey().equalsIgnoreCase(name))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  private static EventSubscription createAlert(
      TestNamespace ns, SubscriptionDestination destination) {
    ArgumentsInput onlyTheFixtureTable =
        new ArgumentsInput()
            .withName("filterByFqn")
            .withEffect(Effect.INCLUDE)
            .withArguments(
                List.of(new Argument().withName("fqnList").withInput(List.of(TABLE_FQN))));
    CreateEventSubscription request =
        new CreateEventSubscription()
            .withName(ns.prefix("profile_webhook_alert"))
            .withAlertType(AlertType.NOTIFICATION)
            .withResources(List.of(Entity.TABLE))
            .withInput(new AlertFilteringInput().withFilters(List.of(onlyTheFixtureTable)))
            .withEnabled(true)
            .withBatchSize(100)
            .withPollInterval(ONE_DAY_SECONDS)
            .withDestinations(List.of(destination));
    UUID id = SdkClients.adminClient().eventSubscriptions().create(request).getId();
    return AlertFixtures.stored(id);
  }

  // A header value in the plain Fernet format: no profile webhook opens one.
  private static void holdAValueThatDoesNotOpen(String entityType, UUID id) {
    String table = Entity.TEAM.equals(entityType) ? "team_entity" : "user_entity";
    String header = Fernet.getInstance().encrypt("a header value");
    JsonNode row = Entity.TEAM.equals(entityType) ? storedTeam(id) : storedUser(id);
    ((ObjectNode) row.at("/profile/subscription/generic"))
        .set("headers", JsonUtils.valueToTree(Map.of("X-Api-Key", header)));
    String json = isMySql() ? ":json" : ":json::jsonb";
    TestSuiteBootstrap.getJdbi()
        .useHandle(
            handle ->
                handle
                    .createUpdate("UPDATE " + table + " SET json = " + json + " WHERE id = :id")
                    .bind("id", id.toString())
                    .bind("json", JsonUtils.pojoToJson(row))
                    .execute());
    EntityRepository.invalidateCacheForEntity(
        entityType, id, row.path("fullyQualifiedName").asText());
  }

  private static Team teamWith(TestNamespace ns, String name, Webhook webhook) {
    CreateTeam team =
        new CreateTeam().withName(ns.prefix(name)).withTeamType(CreateTeam.TeamType.GROUP);
    return SdkClients.adminClient()
        .teams()
        .create(webhook == null ? team : team.withProfile(profileWith(webhook)));
  }

  private static String lastFailedReasonOf(UUID alertId) {
    EventSubscription read =
        SdkClients.adminClient().eventSubscriptions().get(alertId.toString(), "statusDetails");
    return JsonUtils.convertValue(
            read.getDestinations().getFirst().getStatusDetails(), SubscriptionStatus.class)
        .getLastFailedReason();
  }

  private static boolean isMySql() {
    return "mysql".equalsIgnoreCase(System.getProperty("databaseType", "postgres"));
  }

  private static JsonNode storedTeam(UUID id) {
    TeamDAO dao = Entity.getCollectionDAO().teamDAO();
    return JsonUtils.readTree(dao.findById(dao.getTableName(), id, ""));
  }

  private static JsonNode storedUser(UUID id) {
    UserDAO dao = Entity.getCollectionDAO().userDAO();
    return JsonUtils.readTree(dao.findById(dao.getTableName(), id, ""));
  }

  /** The value a stored user or team keeps at {@code field} of one profile webhook, opened for it. */
  private static String opened(String entityType, JsonNode row, String slot, String field) {
    String value = row.at("/profile/subscription/" + slot + field).asText();
    assertTrue(BoundCiphertext.isBound(value), "not bound to its webhook: " + value);
    UUID id = UUID.fromString(row.path("id").asText());
    Profile profile = JsonUtils.treeToValue(row.path("profile"), Profile.class);
    Profile sendable =
        ProfileWebhookSecrets.decrypted(new ProfileWebhookSecrets.Holder(entityType, id), profile);
    return JsonUtils.valueToTree(sendable).at("/subscription/" + slot + field).asText();
  }

  private static void assertNoSecretOrCiphertext(String response, List<String> secrets) {
    secrets.forEach(secret -> assertFalse(response.contains(secret), "response carries " + secret));
    assertFalse(response.contains(Fernet.FERNET_PREFIX), "response carries ciphertext");
  }

  private static void assertRefused(Runnable request) {
    OpenMetadataException rejected = assertThrows(OpenMetadataException.class, request::run);
    int status =
        rejected.getCause() instanceof InvalidRequestException cause
            ? cause.getStatusCode()
            : rejected.getStatusCode();
    assertEquals(400, status, rejected.getMessage());
  }

  private static JsonNode patch(String op, String path, String value) {
    return JsonUtils.valueToTree(List.of(Map.of("op", op, "path", path, "value", value)));
  }

  private static Profile profileWith(Webhook webhook) {
    return new Profile().withSubscription(new SubscriptionConfig().withGeneric(webhook));
  }

  private static Webhook oauth2Webhook(String endpoint, String clientSecret) {
    return new Webhook()
        .withEndpoint(URI.create(endpoint))
        .withAuthType(
            Map.of(
                "type",
                "oauth2",
                "tokenUrl",
                TOKEN_URL,
                "clientId",
                "client",
                "clientSecret",
                clientSecret));
  }

  private static OpenMetadataClient plainUserClient() {
    String name = "viewer" + UUID.randomUUID().toString().substring(0, 8);
    String email = name + "@open-metadata.org";
    SdkClients.adminClient().users().create(new CreateUser().withName(name).withEmail(email));
    return SdkClients.createClient(name, email, new String[] {});
  }

  private static String rawGet(OpenMetadataClient client, String path) {
    return client.getHttpClient().executeForString(HttpMethod.GET, path, null);
  }
}
