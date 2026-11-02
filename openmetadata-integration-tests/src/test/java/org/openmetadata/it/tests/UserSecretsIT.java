package org.openmetadata.it.tests;

import static java.nio.charset.StandardCharsets.UTF_8;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.auth.JWTAuthMechanism;
import org.openmetadata.schema.auth.JWTTokenExpiry;
import org.openmetadata.schema.entity.teams.AuthenticationMechanism;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;
import org.openmetadata.service.Entity;

/**
 * A bot's token never leaves the server in a change event or in the bot's history. Every alert and
 * {@code GET /v1/events} read the stored events, and anyone who may view a user may read its
 * versions and history. Each test works on its own bot, so tests running together never read each
 * other's edits.
 */
@ExtendWith(TestNamespaceExtension.class)
class UserSecretsIT {

  private static final String AUTHENTICATION = "authenticationMechanism";
  private static final String DESCRIPTION = "description";
  private static final RequestOptions JSON_PATCH =
      RequestOptions.builder().header("Content-Type", "application/json-patch+json").build();

  @Test
  void aBotsUpdateIsStoredWithoutItsToken(final TestNamespace ns) {
    final long since = System.currentTimeMillis();
    final User bot = updateBot(createBot(ns, "stored"), ns.prefix("updated"));

    final JsonNode event = storedEventOf(bot.getId(), since);

    assertFalse(asObject(event.path("entity")).has(AUTHENTICATION));
  }

  @Test
  void aBotsVersionsShowNoTokenToAUserWhoMayViewThem(final TestNamespace ns) {
    final User bot = updateBot(createBot(ns, "versions"), ns.prefix("updated"));
    final HttpClient asViewer = viewerOf(ns);
    final String botPath = "/v1/users/" + bot.getId();

    final ObjectNode versions =
        asViewer.execute(HttpMethod.GET, botPath + "/versions", null, ObjectNode.class);
    final ObjectNode latest =
        asViewer.execute(
            HttpMethod.GET, botPath + "/versions/" + bot.getVersion(), null, ObjectNode.class);

    assertTrue(versions.path("versions").size() > 1, "The update must add a version");
    versions.path("versions").forEach(v -> assertFalse(asObject(v).has(AUTHENTICATION)));
    assertFalse(latest.has(AUTHENTICATION));
  }

  @Test
  void theUsersHistoryShowsNoTokenToAUserWhoMayViewIt(final TestNamespace ns) {
    final long since = System.currentTimeMillis();
    final User bot = updateBot(createBot(ns, "history"), ns.prefix("updated"));

    final List<JsonNode> history =
        allRows(
            viewerOf(ns),
            "/v1/users/history?limit=500&startTs="
                + since
                + "&endTs="
                + System.currentTimeMillis());

    assertTrue(
        history.stream().anyMatch(user -> bot.getId().toString().equals(user.path("id").asText())),
        "The bot's update must be in the history of the window");
    history.forEach(user -> assertFalse(user.has(AUTHENTICATION)));
  }

  // Two edits by one user in one session are merged against the version before them, which is
  // stored without the token: the merged change must not report a credential change.
  @Test
  void editsMergedInOneSessionReportNoCredentialChange(final TestNamespace ns) {
    final User created = createBot(ns, "merged");
    updateBot(created, ns.prefix("first"));
    final User bot = updateBot(created, ns.prefix("second"));

    final List<String> changed = changedFields(bot.getChangeDescription());

    assertTrue(changed.contains(DESCRIPTION), "The merged change must hold the edits");
    assertFalse(changed.contains(AUTHENTICATION), "No credential changed: " + changed);
  }

  private static User createBot(final TestNamespace ns, final String suffix) {
    final String name = "secretsbot" + suffix + ns.shortPrefix();
    final AuthenticationMechanism jwt =
        new AuthenticationMechanism()
            .withAuthType(AuthenticationMechanism.AuthType.JWT)
            .withConfig(new JWTAuthMechanism().withJWTTokenExpiry(JWTTokenExpiry.Unlimited));
    final User bot =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(name)
                    .withEmail(name + "@test.com")
                    .withIsBot(true)
                    .withAuthenticationMechanism(jwt));
    ns.trackRoot(Entity.USER, bot.getId());
    return bot;
  }

  private static HttpClient viewerOf(final TestNamespace ns) {
    final User viewer = UserTestFactory.createUser(ns, "viewer");
    return SdkClients.createClient(viewer.getName(), viewer.getEmail(), new String[] {})
        .getHttpClient();
  }

  private static User updateBot(final User bot, final String description) {
    final HttpClient admin = SdkClients.adminClient().getHttpClient();
    final String patch =
        JsonUtils.pojoToJson(
            List.of(Map.of("op", "add", "path", "/" + DESCRIPTION, "value", description)));
    admin.executeForString(HttpMethod.PATCH, "/v1/users/" + bot.getId(), patch, JSON_PATCH);
    return admin.execute(HttpMethod.GET, "/v1/users/" + bot.getId(), null, User.class);
  }

  private static List<String> changedFields(final ChangeDescription change) {
    return Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
        .flatMap(List::stream)
        .map(FieldChange::getName)
        .toList();
  }

  // Stored events and versions hold the entity as a string of JSON or as an object.
  private static JsonNode asObject(final JsonNode node) {
    return node.isTextual() ? JsonUtils.readTree(node.asText()) : node;
  }

  private static JsonNode storedEventOf(final UUID userId, final long since) {
    final List<JsonNode> events =
        allRows(
            SdkClients.adminClient().getHttpClient(),
            "/v1/events?entityUpdated=user&limit=1000&timestamp="
                + since
                + "&endTs="
                + System.currentTimeMillis());
    final Optional<JsonNode> found =
        events.stream()
            .filter(event -> userId.toString().equals(event.path("entityId").asText()))
            .reduce((first, last) -> last);
    assertTrue(found.isPresent(), "The bot's update must be recorded as a change event");
    return found.get();
  }

  // Every row of a bounded window, following the cursor: other tests write to the same endpoints,
  // so the rows this test looks for can be on any page.
  private static List<JsonNode> allRows(final HttpClient client, final String windowPath) {
    final List<JsonNode> rows = new ArrayList<>();
    String after = null;
    do {
      final String page =
          after == null ? windowPath : windowPath + "&after=" + URLEncoder.encode(after, UTF_8);
      final ObjectNode result = client.execute(HttpMethod.GET, page, null, ObjectNode.class);
      result.path("data").forEach(rows::add);
      after = result.path("paging").path("after").textValue();
    } while (after != null);
    return rows;
  }
}
