package org.openmetadata.it.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import com.fasterxml.jackson.databind.node.TextNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Pattern;
import org.awaitility.Awaitility;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.resources.databases.DatasourceConfig;

/** Keeps relationship identities consistent while normalizing generated identifiers and clocks. */
public final class EntityGoldenSnapshot {
  private static final Pattern UUID_PATTERN =
      Pattern.compile(
          "[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
  private static final Set<String> CLOCK_FIELDS =
      Set.of("updatedAt", "createdAt", "changedAt", "timestamp", "eventTime");

  /**
   * ISO-8601 date fields, pinned for the same reason as {@link #CLOCK_FIELDS} but with a string
   * placeholder because they are not epoch millis. Table joins and usage carry today's date and a
   * rolling window start, so a fixture recorded on one day compares unequal on the next — the
   * failure looks like a behaviour change when nothing changed but the calendar. {@code endDate} is
   * listed although no scenario emits one yet: it is {@code startDate}'s pair in the same join and
   * usage windows, so a scenario that grows into it would reintroduce exactly this failure.
   */
  private static final Set<String> DATE_FIELDS = Set.of("date", "startDate", "endDate");

  private static final String DATE_PLACEHOLDER = "<date>";
  private static final int ID_LIMIT = 256;
  private final Map<String, String> ids = new LinkedHashMap<>();
  private final Map<String, String> aliases;

  public EntityGoldenSnapshot(UUID entityId, Map<String, String> aliases) {
    ids.put(entityId.toString(), "entity-id");
    this.aliases = Map.copyOf(aliases);
  }

  public void assertMatches(String scenario, String type, UUID id) throws IOException {
    final String name = type + "/" + scenario + ".json";
    final JsonNode expected = readFixture(name);
    final var repository = Entity.getEntityRepository(type);
    final ObjectNode state = JsonUtils.getObjectNode();
    final var jdbi = Entity.getJdbi();
    final List<String> stored =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT json FROM "
                            + repository.getDao().getTableName()
                            + " WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(String.class)
                    .list());
    final List<String> history =
        jdbi.withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT json FROM entity_extension WHERE id = :id AND extension LIKE :prefix ORDER BY extension")
                    .bind("id", id.toString())
                    .bind("prefix", type + ".version.%")
                    .mapTo(String.class)
                    .list());
    // EventFilter delivers asynchronously, independently of the synchronous entity write.
    final List<JsonNode> events = awaitEvents(type, id, expected);
    state.set("stored", JsonUtils.valueToTree(stored.stream().map(JsonUtils::readTree).toList()));
    state.set("history", JsonUtils.valueToTree(history.stream().map(JsonUtils::readTree).toList()));
    state.set("events", JsonUtils.valueToTree(events));
    assertFixture(name, expected, normalize(state));
  }

  /**
   * Waits for the asynchronously delivered events this step should produce.
   *
   * <p>Verification knows how many the fixture pins and waits for at least that many. Generation has
   * no such number, so it waits for the stream to go quiet instead — two consecutive polls returning
   * the same count. Short-circuiting generation on "no expectation" would snapshot whatever happened
   * to be committed at t=0 and bake an incomplete event history into the baseline, which every later
   * verification run would then fail against.
   */
  private List<JsonNode> awaitEvents(String type, UUID id, JsonNode expected) {
    if (expected != null) {
      return Awaitility.await()
          .pollDelay(Duration.ZERO)
          .atMost(Duration.ofSeconds(10))
          .until(() -> events(type, id), rows -> rows.size() >= expected.path("events").size());
    }
    final AtomicInteger previous = new AtomicInteger(-1);
    return Awaitility.await()
        .pollDelay(Duration.ZERO)
        .pollInterval(Duration.ofMillis(250))
        .atMost(Duration.ofSeconds(30))
        .until(
            () -> events(type, id),
            rows -> !rows.isEmpty() && rows.size() == previous.getAndSet(rows.size()));
  }

  /**
   * Events for one entity in commit order.
   *
   * <p>Ordered by {@code offset}, the table's monotonic sequence, rather than {@code eventTime}.
   * Consecutive updates land in the same millisecond often enough that a timestamp order is
   * database-dependent, and several scenarios pin runs of {@code entityUpdated} events whose only
   * difference is the payload — {@code table/hard-delete.json} pins five in a row. A fixture built
   * on an ambiguous order flips between runs.
   */
  private List<JsonNode> events(String type, UUID id) {
    return Entity.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT json FROM change_event WHERE entityType = :type ORDER BY "
                            + offsetColumn()
                            + " ASC")
                    .bind("type", type)
                    .mapTo(String.class)
                    .list())
        .stream()
        .map(JsonUtils::readTree)
        .filter(event -> id.toString().equals(event.path("entityId").asText()))
        .toList();
  }

  /** {@code offset} is reserved in both dialects and each quotes it differently. */
  private static String offsetColumn() {
    return Boolean.TRUE.equals(DatasourceConfig.getInstance().isMySQL())
        ? "`offset`"
        : "\"offset\"";
  }

  private JsonNode readFixture(String name) throws IOException {
    if (System.getProperty("entityGoldenOutput") != null) {
      return null;
    }
    final String resource = "/entity-repository-golden/" + name;
    try (var input = EntityGoldenSnapshot.class.getResourceAsStream(resource)) {
      assertNotNull(input, "Missing baseline fixture: " + resource);
      return JsonUtils.readTree(new String(input.readAllBytes(), StandardCharsets.UTF_8));
    }
  }

  private void assertFixture(String name, JsonNode expected, JsonNode actual) throws IOException {
    final String output = System.getProperty("entityGoldenOutput");
    if (output != null) {
      final Path file = Path.of(output).resolve(name);
      Files.createDirectories(file.getParent());
      Files.writeString(file, actual.toPrettyString() + "\n");
    } else {
      assertEquals(expected, actual, "Stored state differs from main: " + name);
    }
  }

  private JsonNode normalize(JsonNode node) {
    if (node.isObject()) {
      final ObjectNode result = JsonUtils.getObjectNode();
      node.properties().stream()
          .sorted(Map.Entry.comparingByKey())
          .forEach(
              entry -> {
                if (CLOCK_FIELDS.contains(entry.getKey())) {
                  result.put(entry.getKey(), 0);
                } else if (DATE_FIELDS.contains(entry.getKey()) && entry.getValue().isTextual()) {
                  result.put(entry.getKey(), DATE_PLACEHOLDER);
                } else {
                  result.set(entry.getKey(), normalize(entry.getValue()));
                }
              });
      return result;
    }
    if (node.isArray()) {
      final var result = JsonUtils.getObjectMapper().createArrayNode();
      node.forEach(item -> result.add(normalize(item)));
      return result;
    }
    return node.isTextual() ? TextNode.valueOf(normalizeText(node.asText())) : node;
  }

  private String normalizeText(String value) {
    if (value.startsWith("{") || value.startsWith("[")) {
      return normalize(JsonUtils.readTree(value)).toString();
    }
    String normalized = value;
    for (var alias :
        aliases.entrySet().stream()
            .sorted(
                (left, right) -> Integer.compare(right.getKey().length(), left.getKey().length()))
            .toList()) {
      normalized = normalized.replace(alias.getKey(), alias.getValue());
    }
    return UUID_PATTERN.matcher(normalized).replaceAll(match -> normalizedId(match.group()));
  }

  private String normalizedId(String id) {
    if (!ids.containsKey(id) && ids.size() >= ID_LIMIT) {
      throw new IllegalStateException("Golden scenario exceeded its identifier budget");
    }
    return ids.computeIfAbsent(id, ignored -> "generated-id-" + ids.size());
  }
}
