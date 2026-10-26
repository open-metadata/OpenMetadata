package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpClient;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.sdk.network.RequestOptions;

/**
 * A bot's token never leaves the server in a change event or in the bot's history. Every alert and
 * {@code GET /v1/events} read the stored events, and anyone who may view a user may read its
 * versions and history.
 */
@ExtendWith(TestNamespaceExtension.class)
class UserSecretsIT {

  private static final String BOT = "ingestion-bot";
  private static final String AUTHENTICATION = "authenticationMechanism";

  @Test
  void aBotsUpdateIsStoredWithoutItsToken(TestNamespace ns) {
    long since = System.currentTimeMillis();
    User bot = updateBot(ns.prefix("updated"));

    JsonNode event = storedEventOf(bot.getId(), since);

    assertFalse(asObject(event.path("entity")).has(AUTHENTICATION));
  }

  @Test
  void aBotsHistoryShowsNoTokenToAUserWhoMayViewIt(TestNamespace ns) {
    long since = System.currentTimeMillis();
    User bot = updateBot(ns.prefix("updated"));
    User viewer = UserTestFactory.createUser(ns, "viewer");
    HttpClient asViewer =
        SdkClients.createClient(viewer.getName(), viewer.getEmail(), new String[] {})
            .getHttpClient();
    String botPath = "/v1/users/" + bot.getId();

    ObjectNode versions =
        asViewer.execute(HttpMethod.GET, botPath + "/versions", null, ObjectNode.class);
    ObjectNode latest =
        asViewer.execute(
            HttpMethod.GET, botPath + "/versions/" + bot.getVersion(), null, ObjectNode.class);
    ObjectNode history =
        asViewer.execute(
            HttpMethod.GET,
            "/v1/users/history?startTs=" + since + "&endTs=" + System.currentTimeMillis(),
            null,
            ObjectNode.class);

    assertTrue(versions.path("versions").size() > 1, "The update must add a version");
    versions.path("versions").forEach(v -> assertFalse(asObject(v).has(AUTHENTICATION)));
    assertFalse(latest.has(AUTHENTICATION));
    assertTrue(
        history.path("data").findValuesAsText("id").contains(bot.getId().toString()),
        "The bot's update must be in the history of the window");
    history.path("data").forEach(user -> assertFalse(user.has(AUTHENTICATION)));
  }

  // Two edits by one user in one session are merged against the version before them, which is
  // stored without the token: the merged change must not report a credential change.
  @Test
  void editsMergedInOneSessionReportNoCredentialChange(TestNamespace ns) {
    updateBot(ns.prefix("first"));
    User bot = updateBot(ns.prefix("second"));

    ChangeDescription change = bot.getChangeDescription();
    List<String> changed =
        Stream.of(change.getFieldsAdded(), change.getFieldsUpdated(), change.getFieldsDeleted())
            .flatMap(List::stream)
            .map(FieldChange::getName)
            .toList();
    assertTrue(changed.contains("description"), "The merged change must hold the edits");
    assertFalse(changed.contains(AUTHENTICATION), "No credential changed: " + changed);
  }

  // Stored events and versions hold the entity as a string of JSON or as an object.
  private static JsonNode asObject(JsonNode node) {
    return node.isTextual() ? JsonUtils.readTree(node.asText()) : node;
  }

  private static User updateBot(String description) {
    HttpClient admin = SdkClients.adminClient().getHttpClient();
    User bot = admin.execute(HttpMethod.GET, "/v1/users/name/" + BOT, null, User.class);
    String patch =
        JsonUtils.pojoToJson(
            List.of(Map.of("op", "add", "path", "/description", "value", description)));
    admin.executeForString(
        HttpMethod.PATCH,
        "/v1/users/" + bot.getId(),
        patch,
        RequestOptions.builder().header("Content-Type", "application/json-patch+json").build());
    return admin.execute(HttpMethod.GET, "/v1/users/" + bot.getId(), null, User.class);
  }

  private static JsonNode storedEventOf(UUID userId, long since) {
    ObjectNode events =
        SdkClients.adminClient()
            .getHttpClient()
            .execute(
                HttpMethod.GET,
                "/v1/events?entityUpdated=user&timestamp=" + since,
                null,
                ObjectNode.class);
    JsonNode found = null;
    for (JsonNode event : events.path("data")) {
      found = userId.toString().equals(event.path("entityId").asText()) ? event : found;
    }
    assertTrue(found != null, "The bot's update must be recorded as a change event");
    return found;
  }
}
