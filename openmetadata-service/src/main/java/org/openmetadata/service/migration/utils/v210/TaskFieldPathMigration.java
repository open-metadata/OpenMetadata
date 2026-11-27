/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.migration.utils.v210;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.MissingNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import java.util.stream.StreamSupport;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.migration.utils.v210.FieldPathFormat.FieldPath;
import org.openmetadata.service.migration.utils.v210.LegacyFieldPath.Candidate;

/**
 * Rewrites the field path of every stored description, tag and suggestion task into the one
 * {@link FieldPathFormat} the server accepts from 2.1 on.
 *
 * <p>A legacy path can mean more than one field. When the task's entity still exists, it decides:
 * the first reading that names one of its fields wins, the nearest field when two do, then a field
 * the path names by its own name alone when exactly one has that name. When the entity or field is
 * gone, nothing can be applied to it any more, and the path is written in its most likely reading.
 * A path that names no field at all is left as it is and logged; approving its task is refused.
 *
 * <p>The step reads and writes stored JSON with plain SQL and depends on no server class, entity
 * class or repository: a migration runs on the code of whatever release an upgrade lands on, and
 * this one must keep doing what it does in 2.1.0.
 */
@Slf4j
public final class TaskFieldPathMigration {
  public static final String STEP_NAME = "task-field-path-format";

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String TABLE = "task_entity";
  private static final String FIELD_PATH_KEY = "fieldPath";
  private static final String LEGACY_FIELD_KEY = "field";
  private static final String DESCRIPTION_UPDATE = "DescriptionUpdate";
  private static final String TAG_UPDATE = "TagUpdate";
  private static final String SUGGESTION = "Suggestion";
  private static final List<String> TASK_TYPES =
      List.of(DESCRIPTION_UPDATE, TAG_UPDATE, SUGGESTION);
  private static final Map<String, String> SUGGESTION_PROPERTIES =
      Map.of("Description", FieldPathFormat.DESCRIPTION, "Tag", FieldPathFormat.TAGS);
  // A task is the target of a MENTIONED_IN relationship from the entity it is about.
  private static final String TASK_ENTITY_TYPE = "task";
  private static final int MENTIONED_IN = 5;

  /** The table each entity type with fields is stored in, as of 2.1.0. */
  private static final Map<String, String> ENTITY_TABLES =
      Map.of(
          "table", "table_entity",
          "dashboardDataModel", "dashboard_data_model_entity",
          "worksheet", "worksheet_entity",
          "topic", "topic_entity",
          "container", "storage_container_entity",
          "mlmodel", "ml_model_entity",
          "pipeline", "pipeline_entity",
          "searchIndex", "search_index_entity",
          "apiEndpoint", "api_endpoint_entity");

  /** Rows one batch read, rewrote, and could not read. */
  record Summary(int scanned, int rewritten, List<String> unreadable) {
    static final Summary NONE = new Summary(0, 0, List.of());

    Summary plus(Summary other) {
      List<String> ids = new ArrayList<>(unreadable);
      ids.addAll(other.unreadable);
      return new Summary(scanned + other.scanned, rewritten + other.rewritten, ids);
    }
  }

  /** The entity a task is about. */
  record About(String id, String type) {}

  /** Where a task keeps its field path, and the property that path ends in. */
  record Target(String payloadKey, String property) {}

  /** What rewriting one task did: whether it changed the row, or found no field to name. */
  record Rewrite(boolean changed, boolean unreadable) {}

  private TaskFieldPathMigration() {}

  public static void migrate(Handle handle, ConnectionType connectionType) {
    Map<String, List<String>> fieldPathKeys = fieldPathKeys(handle);
    Summary summary =
        IdBatches.fold(
            handle,
            TABLE,
            Summary.NONE,
            (sum, ids) -> sum.plus(migrateBatch(handle, connectionType, ids, fieldPathKeys)));
    LOG.info(
        "Task field paths: {} tasks read, {} rewritten, {} name no field and were left as they are {}",
        summary.scanned(),
        summary.rewritten(),
        summary.unreadable().size(),
        summary.unreadable());
  }

  /**
   * The field path in the one format, for a legacy path on an entity of {@code entityType};
   * {@code entity} is its stored JSON, null when it no longer exists. Empty when the path names no
   * field at all.
   */
  static Optional<FieldPath> convert(
      String legacy, String entityType, String property, JsonNode entity) {
    if (LegacyFieldPath.isEntityLevel(legacy)) {
      return Optional.of(FieldPath.entityLevel(property));
    }
    // An unquoted legacy path can read as the format and still mean a field named with dots.
    Optional<FieldPath> canonical =
        FieldPathFormat.parse(legacy, entityType)
            .filter(path -> path.property().equals(property))
            .filter(path -> entity == null || exists(entity, path));
    if (canonical.isPresent()) {
      return canonical;
    }
    List<Candidate> candidates =
        LegacyFieldPath.candidates(legacy, entityType).stream()
            .filter(candidate -> !candidate.names().isEmpty())
            .toList();
    return candidates.isEmpty()
        ? Optional.empty()
        : Optional.of(resolve(candidates, entityType, property, entity));
  }

  /**
   * Rewrites the field path in {@code task}, a stored task about an entity of {@code entityType}
   * stored as {@code entity} (null when it is gone), in place. Empty for a task with none. {@code
   * fieldPathKeys} holds, per task type, the payload keys its form schemas keep the path under.
   */
  static Optional<Rewrite> rewrite(
      ObjectNode task,
      String entityType,
      JsonNode entity,
      Map<String, List<String>> fieldPathKeys) {
    JsonNode payload = task.path("payload");
    Optional<Target> target =
        payload instanceof ObjectNode payloadObject
            ? targetOf(task.path("type").asText(""), payloadObject, fieldPathKeys)
            : Optional.empty();
    return target.map(found -> rewritePayload((ObjectNode) payload, entityType, entity, found));
  }

  /**
   * The payload keys each task type's form schemas keep the field path under, with {@code
   * fieldPath}, the key 2.0 seeds, last. An admin can rename it; when a task type's schemas
   * disagree, every name they use is kept.
   */
  private static Map<String, List<String>> fieldPathKeys(Handle handle) {
    Map<String, Set<String>> configured = new HashMap<>();
    handle
        .createQuery("SELECT json FROM task_form_schema_entity WHERE taskType IN (<types>)")
        .bindList("types", List.of(DESCRIPTION_UPDATE, TAG_UPDATE))
        .mapTo(String.class)
        .forEach(json -> addConfiguredKey(readTree(json), configured));
    Map<String, List<String>> keys = new HashMap<>();
    configured.forEach((type, names) -> keys.put(type, withDefaultKeyLast(names)));
    return keys;
  }

  private static void addConfiguredKey(JsonNode schema, Map<String, Set<String>> configured) {
    JsonNode uiSchema = schema.path("uiSchema");
    JsonNode handler =
        (uiSchema.isTextual() ? readTree(uiSchema.asText()) : uiSchema).path("ui:handler");
    String key = handler.path("fieldPathField").asText("");
    if (!schema.path("deleted").asBoolean(false) && !key.isEmpty()) {
      configured
          .computeIfAbsent(schema.path("taskType").asText(), type -> new TreeSet<>())
          .add(key);
    }
  }

  private static List<String> withDefaultKeyLast(Collection<String> names) {
    List<String> keys = new ArrayList<>(names);
    keys.remove(FIELD_PATH_KEY);
    keys.add(FIELD_PATH_KEY);
    return keys;
  }

  private static Summary migrateBatch(
      Handle handle,
      ConnectionType connectionType,
      List<String> ids,
      Map<String, List<String>> fieldPathKeys) {
    List<Map<String, Object>> rows =
        handle
            .createQuery(
                "SELECT id, json FROM task_entity WHERE id IN (<ids>) AND type IN (<types>)")
            .bindList("ids", ids)
            .bindList("types", TASK_TYPES)
            .mapToMap()
            .list();
    Map<String, About> abouts = aboutsOf(handle, ids);
    Map<String, JsonNode> entities = entitiesOf(handle, abouts.values());
    Summary summary = Summary.NONE;
    for (Map<String, Object> row : rows) {
      String id = row.get("id").toString();
      About about = abouts.get(id);
      String entityType = about == null ? null : about.type();
      JsonNode entity = about == null ? null : entities.get(about.id());
      summary =
          summary.plus(
              migrateRow(handle, connectionType, id, row, entityType, entity, fieldPathKeys));
    }
    return summary;
  }

  // A task's entity is a relationship, not part of its stored JSON.
  private static Map<String, About> aboutsOf(Handle handle, List<String> ids) {
    Map<String, About> abouts = new HashMap<>();
    handle
        .createQuery(
            "SELECT toId, fromId, fromEntity FROM entity_relationship "
                + "WHERE toId IN (<ids>) AND toEntity = :task AND relation = :relation")
        .bindList("ids", ids)
        .bind("task", TASK_ENTITY_TYPE)
        .bind("relation", MENTIONED_IN)
        .mapToMap()
        .forEach(
            row ->
                abouts.put(
                    row.get("toid").toString(),
                    new About(row.get("fromid").toString(), row.get("fromentity").toString())));
    return abouts;
  }

  /** The stored JSON of every entity with fields the tasks are about, by id; deleted ones too. */
  private static Map<String, JsonNode> entitiesOf(Handle handle, Collection<About> abouts) {
    Map<String, JsonNode> entities = new HashMap<>();
    abouts.stream()
        .filter(about -> ENTITY_TABLES.containsKey(about.type()))
        .collect(
            Collectors.groupingBy(
                About::type, Collectors.mapping(About::id, Collectors.toCollection(TreeSet::new))))
        .forEach(
            (type, ids) ->
                handle
                    .createQuery(
                        "SELECT id, json FROM " + ENTITY_TABLES.get(type) + " WHERE id IN (<ids>)")
                    .bindList("ids", List.copyOf(ids))
                    .mapToMap()
                    .forEach(
                        row ->
                            entities.put(
                                row.get("id").toString(), readTree(row.get("json").toString()))));
    return entities;
  }

  private static Summary migrateRow(
      Handle handle,
      ConnectionType connectionType,
      String id,
      Map<String, Object> row,
      String entityType,
      JsonNode entity,
      Map<String, List<String>> fieldPathKeys) {
    ObjectNode json = (ObjectNode) readTree(row.get("json").toString());
    Optional<Rewrite> rewrite = rewrite(json, entityType, entity, fieldPathKeys);
    rewrite
        .filter(Rewrite::changed)
        .ifPresent(applied -> updateJson(handle, connectionType, id, json.toString()));
    boolean rewritten = rewrite.map(Rewrite::changed).orElse(false);
    boolean unreadable = rewrite.map(Rewrite::unreadable).orElse(false);
    return new Summary(1, rewritten ? 1 : 0, unreadable ? List.of(id) : List.of());
  }

  /** Where a task keeps its field path, or empty for a task that changes no entity field. */
  private static Optional<Target> targetOf(
      String type, ObjectNode payload, Map<String, List<String>> fieldPathKeys) {
    Optional<Target> target = Optional.empty();
    if (DESCRIPTION_UPDATE.equals(type) || TAG_UPDATE.equals(type)) {
      String property =
          DESCRIPTION_UPDATE.equals(type) ? FieldPathFormat.DESCRIPTION : FieldPathFormat.TAGS;
      List<String> keys = fieldPathKeys.getOrDefault(type, List.of(FIELD_PATH_KEY));
      target = Optional.of(new Target(keyHoldingPath(payload, keys), property));
    } else if (SUGGESTION.equals(type)) {
      target =
          Optional.ofNullable(SUGGESTION_PROPERTIES.get(payload.path("suggestionType").asText("")))
              .map(property -> new Target(FIELD_PATH_KEY, property));
    }
    return target;
  }

  // The first key that holds a path, or the one the form schema names when none does.
  private static String keyHoldingPath(ObjectNode payload, List<String> keys) {
    return keys.stream()
        .filter(key -> !payload.path(key).asText("").isEmpty())
        .findFirst()
        .orElse(keys.getFirst());
  }

  private static Rewrite rewritePayload(
      ObjectNode payload, String entityType, JsonNode entity, Target target) {
    String legacy = legacyText(payload, target.payloadKey());
    Optional<FieldPath> converted = convert(legacy, entityType, target.property(), entity);
    if (converted.isEmpty()) {
      return new Rewrite(false, true);
    }
    String canonical = converted.get().format();
    boolean changed = !canonical.equals(legacy) || payload.has(LEGACY_FIELD_KEY);
    payload.put(target.payloadKey(), canonical);
    payload.remove(LEGACY_FIELD_KEY);
    return new Rewrite(changed, false);
  }

  // Before 2.1 a description task could carry its path under "field" instead.
  private static String legacyText(ObjectNode payload, String key) {
    String text = payload.path(key).asText("");
    return text.isEmpty() ? payload.path(LEGACY_FIELD_KEY).asText(null) : text;
  }

  private static FieldPath resolve(
      List<Candidate> candidates, String entityType, String property, JsonNode entity) {
    Optional<FieldPath> found =
        entity == null ? Optional.empty() : onEntity(candidates, entityType, property, entity);
    Candidate likeliest = candidates.getFirst();
    return found.orElseGet(() -> new FieldPath(likeliest.container(), likeliest.names(), property));
  }

  private static Optional<FieldPath> onEntity(
      List<Candidate> candidates, String entityType, String property, JsonNode entity) {
    for (Candidate candidate : candidates) {
      Optional<List<String>> named =
          nearest(fieldsOf(entity, entityType, candidate), candidate.text());
      if (named.isPresent()) {
        return Optional.of(new FieldPath(candidate.container(), named.get(), property));
      }
    }
    return byOwnName(candidates.getFirst(), entityType, property, entity);
  }

  // Before 2.1 a bare field name also reached a nested field, when exactly one had that name.
  private static Optional<FieldPath> byOwnName(
      Candidate candidate, String entityType, String property, JsonNode entity) {
    String name = candidate.names().getLast();
    List<List<String>> named =
        fieldsOf(entity, entityType, candidate).stream()
            .filter(chain -> chain.getLast().equals(name))
            .toList();
    return named.size() == 1
        ? Optional.of(new FieldPath(candidate.container(), named.getFirst(), property))
        : Optional.empty();
  }

  // The nearest field wins, as the old walker matched a whole name before splitting it.
  private static Optional<List<String>> nearest(List<List<String>> chains, String text) {
    return chains.stream()
        .filter(chain -> String.join(".", chain).equals(text))
        .min(Comparator.comparingInt(List::size));
  }

  /** The name chain of every field, at every depth, in the candidate's container. */
  private static List<List<String>> fieldsOf(
      JsonNode entity, String entityType, Candidate candidate) {
    List<List<String>> chains = new ArrayList<>();
    if (FieldPathFormat.containers(entityType).contains(candidate.container())) {
      collect(containerList(entity, candidate.container()), List.of(), chains);
    }
    return chains;
  }

  private static void collect(JsonNode fields, List<String> parent, List<List<String>> chains) {
    for (JsonNode field : fields) {
      List<String> chain = new ArrayList<>(parent);
      chain.add(field.path("name").asText());
      chains.add(chain);
      collect(field.path("children"), chain, chains);
    }
  }

  // Each name must match exactly one sibling: two fields with the same name cannot be told apart.
  private static boolean exists(JsonNode entity, FieldPath path) {
    JsonNode fields = containerList(entity, path.container());
    JsonNode field = null;
    for (String name : path.names()) {
      List<JsonNode> matches =
          StreamSupport.stream(fields.spliterator(), false)
              .filter(sibling -> name.equals(sibling.path("name").asText(null)))
              .toList();
      field = matches.size() == 1 ? matches.getFirst() : null;
      fields = field == null ? MissingNode.getInstance() : field.path("children");
    }
    return field != null;
  }

  private static JsonNode containerList(JsonNode entity, String container) {
    JsonNode node = entity;
    for (String key : container.split("\\.")) {
      node = node.path(key);
    }
    return node;
  }

  private static JsonNode readTree(String json) {
    try {
      return MAPPER.readTree(json);
    } catch (JsonProcessingException e) {
      throw new IllegalStateException("Stored JSON does not parse: " + e.getMessage(), e);
    }
  }

  private static void updateJson(
      Handle handle, ConnectionType connectionType, String id, String json) {
    String jsonValue = connectionType == ConnectionType.POSTGRES ? ":json::jsonb" : ":json";
    handle
        .createUpdate("UPDATE task_entity SET json = " + jsonValue + " WHERE id = :id")
        .bind("json", json)
        .bind("id", id)
        .execute();
  }
}
