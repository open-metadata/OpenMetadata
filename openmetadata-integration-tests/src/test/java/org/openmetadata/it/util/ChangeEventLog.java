package org.openmetadata.it.util;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

/** The change events the server recorded, read as an admin: only admins and bots may list them. */
public final class ChangeEventLog {
  private static final String UPDATES_WINDOW =
      "/v1/events?entityUpdated=%s&limit=1000&timestamp=%d&endTs=%d";

  private ChangeEventLog() {}

  /** Who a change event names: the user it records and, when a bot wrote for them, the bot. */
  public record EventAuthor(String userName, String impersonatedBy) {}

  /**
   * The author of the newest {@code entityUpdated} event recorded for {@code entityId} since {@code
   * since} that changed {@code field}, waiting until there is one.
   */
  public static EventAuthor awaitUpdateAuthor(
      String entityType, UUID entityId, String field, long since) {
    JsonNode event =
        Awaitility.await("an update event of " + entityId + " changing " + field)
            .atMost(Duration.ofSeconds(60))
            .pollInterval(Duration.ofMillis(500))
            .until(() -> newestUpdate(entityType, entityId, field, since), Optional::isPresent)
            .get();
    return new EventAuthor(textOrNull(event, "userName"), textOrNull(event, "impersonatedBy"));
  }

  private static Optional<JsonNode> newestUpdate(
      String entityType, UUID entityId, String field, long since) {
    return updates(entityType, since).stream()
        .filter(event -> entityId.toString().equals(event.path("entityId").asText()))
        .filter(event -> changes(event, field))
        .reduce((first, last) -> last);
  }

  // Every event of the window, following the cursor: other tests record events of the same type,
  // so the one a test looks for can be on any page.
  private static List<JsonNode> updates(String entityType, long since) {
    String window = UPDATES_WINDOW.formatted(entityType, since, System.currentTimeMillis());
    List<JsonNode> events = new ArrayList<>();
    String after = null;
    do {
      String page = after == null ? window : window + "&after=" + URLEncoder.encode(after, UTF_8);
      ObjectNode result =
          SdkClients.adminClient()
              .getHttpClient()
              .execute(HttpMethod.GET, page, null, ObjectNode.class);
      result.path("data").forEach(events::add);
      after = result.path("paging").path("after").textValue();
    } while (after != null);
    return events;
  }

  // A writer may record the change description on the event's entity and not on the event itself.
  private static boolean changes(JsonNode event, String field) {
    return Stream.of(event.path("changeDescription"), entityOf(event).path("changeDescription"))
        .anyMatch(changeDescription -> touches(changeDescription, field));
  }

  private static JsonNode entityOf(JsonNode event) {
    JsonNode entity = event.path("entity");
    return entity.isTextual() ? JsonUtils.readTree(entity.asText()) : entity;
  }

  private static boolean touches(JsonNode changeDescription, String field) {
    return Stream.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted")
        .flatMap(kind -> StreamSupport.stream(changeDescription.path(kind).spliterator(), false))
        .anyMatch(change -> field.equals(change.path("name").asText()));
  }

  private static String textOrNull(JsonNode node, String field) {
    return node.hasNonNull(field) ? node.get(field).asText() : null;
  }
}
