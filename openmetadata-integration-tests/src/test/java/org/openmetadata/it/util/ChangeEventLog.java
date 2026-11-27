package org.openmetadata.it.util;

import static java.nio.charset.StandardCharsets.UTF_8;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.net.URLEncoder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.Predicate;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * The change events the server recorded, and the audit rows written from them, read as an admin:
 * only admins and bots may list events.
 */
public final class ChangeEventLog {
  private static final String EVENTS_WINDOW = "/v1/events?%s=%s&limit=1000&timestamp=%d&endTs=%d";
  private static final String UPDATED = "entityUpdated";
  private static final String DELETED = "entityDeleted";
  private static final String HARD_DELETED_EVENT = "entityDeleted";
  // No entityType: with one, the audit API authorizes against that entity, and an edge is not one.
  private static final String AUDIT_WINDOW = "/v1/audit/logs?entityFQN=%s&eventType=%s&limit=1";

  private ChangeEventLog() {}

  /** Who a change event names: the user it records and, when a bot wrote for them, the bot. */
  public record EventAuthor(String userName, String impersonatedBy) {}

  /**
   * The author of the newest {@code entityUpdated} event recorded for {@code entityId} since {@code
   * since} that changed {@code field}, waiting until there is one.
   */
  public static EventAuthor awaitUpdateAuthor(
      String entityType, UUID entityId, String field, long since) {
    return awaitUpdateAuthors(entityType, entityId, field, since, 1).getLast();
  }

  /**
   * The authors of the {@code entityUpdated} events recorded for {@code entityId} since {@code
   * since} that changed {@code field}, in the order they were recorded, waiting until there are
   * {@code count}. Events are recorded off the request thread, so two requests made one after the
   * other can be recorded in either order.
   */
  public static List<EventAuthor> awaitUpdateAuthors(
      String entityType, UUID entityId, String field, long since, int count) {
    return Awaitility.await(count + " update events of " + entityId + " changing " + field)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofMillis(500))
        .until(
            () -> authors(events(UPDATED, entityType, since), entityId, e -> changes(e, field)),
            authors -> authors.size() >= count);
  }

  /** The author of the hard delete of {@code entityId} since {@code since}, once it is recorded. */
  public static EventAuthor awaitHardDeleteAuthor(String entityType, UUID entityId, long since) {
    return Awaitility.await("the hard delete event of " + entityId)
        .atMost(Duration.ofSeconds(60))
        .pollInterval(Duration.ofMillis(500))
        .until(
            () -> authors(events(DELETED, entityType, since), entityId, ChangeEventLog::isHard),
            authors -> !authors.isEmpty())
        .getLast();
  }

  private static List<EventAuthor> authors(
      List<JsonNode> events, UUID entityId, Predicate<JsonNode> matches) {
    return events.stream()
        .filter(event -> entityId.toString().equals(event.path("entityId").asText()))
        .filter(matches)
        .map(
            event ->
                new EventAuthor(textOrNull(event, "userName"), textOrNull(event, "impersonatedBy")))
        .toList();
  }

  /**
   * The author of the newest audit row for {@code eventType} on what {@code entityFqn} names,
   * waiting until the audit log consumer has written it. Audit rows are written from the change
   * events, so they name whom the event names; the events API does not list lineage events, the
   * audit log does.
   */
  public static EventAuthor awaitAuditAuthor(String entityFqn, String eventType) {
    String path =
        AUDIT_WINDOW.formatted(
            URLEncoder.encode(entityFqn, UTF_8), URLEncoder.encode(eventType, UTF_8));
    JsonNode row =
        Awaitility.await("the " + eventType + " audit row of " + entityFqn)
            .atMost(Duration.ofSeconds(60))
            .pollInterval(Duration.ofMillis(500))
            .until(
                () ->
                    SdkClients.adminClient()
                        .getHttpClient()
                        .execute(HttpMethod.GET, path, null, ObjectNode.class)
                        .path("data")
                        .path(0),
                found -> !found.isMissingNode());
    return new EventAuthor(textOrNull(row, "userName"), textOrNull(row, "impersonatedBy"));
  }

  // The entityDeleted filter returns soft deletes too.
  private static boolean isHard(JsonNode event) {
    return HARD_DELETED_EVENT.equals(event.path("eventType").asText());
  }

  // Every event of the window, following the cursor: other tests record events of the same type,
  // so the one a test looks for can be on any page.
  private static List<JsonNode> events(String kind, String entityType, long since) {
    String window = EVENTS_WINDOW.formatted(kind, entityType, since, System.currentTimeMillis());
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
