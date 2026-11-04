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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.tasks.Task;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.IdBatches;
import org.openmetadata.service.migration.utils.v210.LegacyFieldPath.Candidate;
import org.openmetadata.service.tasks.TaskFieldTarget;
import org.openmetadata.service.tasks.TaskFieldTarget.Target;
import org.openmetadata.service.util.ChildFieldResolver;
import org.openmetadata.service.util.EntityFieldPath;
import org.openmetadata.service.util.FieldPathUtils;
import org.openmetadata.service.util.FieldProperty;

/**
 * Rewrites the field path of every stored description, tag and suggestion task into the one
 * {@link EntityFieldPath} format the server accepts from 2.1 on.
 *
 * <p>A legacy path can mean more than one field. When the task's entity still exists, it decides:
 * the first reading that names one of its fields wins, the nearest field when two do, then a field
 * the path names by its own name alone when exactly one has that name. When the entity or field is
 * gone, nothing can be applied to it any more, and the path is written in its most likely reading.
 * A path that names no field at all is left as it is and logged; approving its task is refused.
 */
@Slf4j
public final class TaskFieldPathMigration {
  public static final String STEP_NAME = "task-field-path-format";

  private static final String TABLE = "task_entity";
  private static final String LEGACY_FIELD_KEY = "field";
  private static final List<String> TASK_TYPES =
      List.of("DescriptionUpdate", "TagUpdate", "Suggestion");

  /** Rows one batch read, rewrote, and could not read. */
  record Summary(int scanned, int rewritten, List<String> unreadable) {
    static final Summary NONE = new Summary(0, 0, List.of());

    Summary plus(Summary other) {
      List<String> ids = new ArrayList<>(unreadable);
      ids.addAll(other.unreadable);
      return new Summary(scanned + other.scanned, rewritten + other.rewritten, ids);
    }
  }

  private TaskFieldPathMigration() {}

  public static void migrate(Handle handle, ConnectionType connectionType) {
    Summary summary =
        IdBatches.fold(
            handle,
            TABLE,
            Summary.NONE,
            (sum, ids) -> sum.plus(migrateBatch(handle, connectionType, ids)));
    LOG.info(
        "Task field paths: {} tasks read, {} rewritten, {} name no field and were left as they are {}",
        summary.scanned(),
        summary.rewritten(),
        summary.unreadable().size(),
        summary.unreadable());
  }

  /**
   * The field path in the one format, for a legacy path on an entity of {@code entityType}; {@code
   * entity} is null when it no longer exists. Empty when the path names no field at all.
   */
  static Optional<EntityFieldPath> convert(
      String legacy, String entityType, FieldProperty property, EntityInterface<?> entity) {
    if (LegacyFieldPath.isEntityLevel(legacy)) {
      return Optional.of(EntityFieldPath.entityLevel(property));
    }
    // An unquoted legacy path can read as the format and still mean a field named with dots.
    Optional<EntityFieldPath> canonical =
        canonical(legacy, entityType, property)
            .filter(path -> entity == null || FieldPathUtils.locate(entity, path).isPresent());
    if (canonical.isPresent()) {
      return canonical;
    }
    List<Candidate> candidates =
        LegacyFieldPath.candidates(legacy, entityType).stream()
            .filter(candidate -> !candidate.names().isEmpty())
            .toList();
    return candidates.isEmpty()
        ? Optional.empty()
        : Optional.of(resolve(candidates, property, entity));
  }

  private static Summary migrateBatch(
      Handle handle, ConnectionType connectionType, List<String> ids) {
    List<Map<String, Object>> rows =
        handle
            .createQuery(
                "SELECT id, json FROM task_entity WHERE id IN (<ids>) AND type IN (<types>)")
            .bindList("ids", ids)
            .bindList("types", TASK_TYPES)
            .mapToMap()
            .list();
    Map<String, EntityReference> abouts = aboutsOf(handle, ids);
    Map<UUID, EntityInterface<?>> loaded = new HashMap<>();
    Function<EntityReference, EntityInterface<?>> entities =
        about -> loaded.computeIfAbsent(about.getId(), id -> load(about));
    Summary summary = Summary.NONE;
    for (Map<String, Object> row : rows) {
      EntityReference about = abouts.get(row.get("id").toString());
      summary = summary.plus(migrateRow(handle, connectionType, row, about, entities));
    }
    return summary;
  }

  // A task's entity is a relationship, not part of its stored JSON (TaskRepository.getAboutEntity).
  private static Map<String, EntityReference> aboutsOf(Handle handle, List<String> ids) {
    Map<String, EntityReference> abouts = new HashMap<>();
    handle
        .createQuery(
            "SELECT toId, fromId, fromEntity FROM entity_relationship "
                + "WHERE toId IN (<ids>) AND toEntity = :task AND relation = :relation")
        .bindList("ids", ids)
        .bind("task", Entity.TASK)
        .bind("relation", Relationship.MENTIONED_IN.ordinal())
        .mapToMap()
        .forEach(
            row ->
                abouts.put(
                    row.get("toid").toString(),
                    new EntityReference()
                        .withId(UUID.fromString(row.get("fromid").toString()))
                        .withType(row.get("fromentity").toString())));
    return abouts;
  }

  private static Summary migrateRow(
      Handle handle,
      ConnectionType connectionType,
      Map<String, Object> row,
      EntityReference about,
      Function<EntityReference, EntityInterface<?>> entities) {
    String id = row.get("id").toString();
    ObjectNode json = (ObjectNode) JsonUtils.readTree(row.get("json").toString());
    Optional<Rewrite> rewrite = rewrite(json, about, entities);
    rewrite
        .filter(Rewrite::changed)
        .ifPresent(applied -> updateJson(handle, connectionType, id, json.toString()));
    boolean rewritten = rewrite.map(Rewrite::changed).orElse(false);
    boolean unreadable = rewrite.map(Rewrite::unreadable).orElse(false);
    return new Summary(1, rewritten ? 1 : 0, unreadable ? List.of(id) : List.of());
  }

  /** What rewriting one task did: whether it changed the row, or found no field to name. */
  record Rewrite(boolean changed, boolean unreadable) {}

  /**
   * Rewrites the field path in {@code json}, a stored task about {@code about}, in place. Empty
   * for a task with none.
   */
  static Optional<Rewrite> rewrite(
      ObjectNode json,
      EntityReference about,
      Function<EntityReference, EntityInterface<?>> entities) {
    Task task = JsonUtils.readValue(json.toString(), Task.class).withAbout(about);
    JsonNode payload = json.path("payload");
    Optional<Target> target =
        payload instanceof ObjectNode ? TaskFieldTarget.targetOf(task, payload) : Optional.empty();
    return target.map(found -> rewritePayload((ObjectNode) payload, task, found, entities));
  }

  private static Rewrite rewritePayload(
      ObjectNode payload,
      Task task,
      Target target,
      Function<EntityReference, EntityInterface<?>> entities) {
    String legacy = legacyText(payload, target.payloadKey());
    String entityType = task.getAbout() == null ? null : task.getAbout().getType();
    EntityInterface<?> entity =
        ChildFieldResolver.supports(entityType) ? entities.apply(task.getAbout()) : null;
    Optional<EntityFieldPath> converted = convert(legacy, entityType, target.property(), entity);
    if (converted.isEmpty()) {
      return new Rewrite(false, true);
    }
    String canonical = converted.get().toString();
    boolean changed = !canonical.equals(legacy) || payload.has(LEGACY_FIELD_KEY);
    payload.put(target.payloadKey(), canonical);
    payload.remove(LEGACY_FIELD_KEY);
    return new Rewrite(changed, false);
  }

  // Before 2.1 a description task could carry its path under "field" instead.
  private static String legacyText(ObjectNode payload, String key) {
    String text = payload.path(key).asText(null);
    return nullOrEmpty(text) ? payload.path(LEGACY_FIELD_KEY).asText(null) : text;
  }

  private static EntityInterface<?> load(EntityReference about) {
    return Entity.getEntityOrNull(
        about, ChildFieldResolver.containerFields(about.getType()), Include.ALL);
  }

  private static Optional<EntityFieldPath> canonical(
      String legacy, String entityType, FieldProperty property) {
    try {
      EntityFieldPath path = EntityFieldPath.parse(legacy, entityType);
      return path.property() == property ? Optional.of(path) : Optional.empty();
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  private static EntityFieldPath resolve(
      List<Candidate> candidates, FieldProperty property, EntityInterface<?> entity) {
    Optional<EntityFieldPath> found =
        entity == null ? Optional.empty() : onEntity(candidates, property, entity);
    Candidate likeliest = candidates.getFirst();
    return found.orElseGet(
        () -> new EntityFieldPath(likeliest.container(), likeliest.names(), property));
  }

  private static Optional<EntityFieldPath> onEntity(
      List<Candidate> candidates, FieldProperty property, EntityInterface<?> entity) {
    for (Candidate candidate : candidates) {
      Optional<List<String>> named = nearest(fieldsOf(entity, candidate), candidate.text());
      if (named.isPresent()) {
        return Optional.of(new EntityFieldPath(candidate.container(), named.get(), property));
      }
    }
    return byOwnName(candidates.getFirst(), property, entity);
  }

  // Before 2.1 a bare field name also reached a nested field, when exactly one had that name.
  private static Optional<EntityFieldPath> byOwnName(
      Candidate candidate, FieldProperty property, EntityInterface<?> entity) {
    String name = candidate.names().getLast();
    List<List<String>> named =
        fieldsOf(entity, candidate).stream().filter(chain -> chain.getLast().equals(name)).toList();
    return named.size() == 1
        ? Optional.of(new EntityFieldPath(candidate.container(), named.getFirst(), property))
        : Optional.empty();
  }

  // The nearest field wins, as the old walker matched a whole name before splitting it.
  private static Optional<List<String>> nearest(List<List<String>> chains, String text) {
    return chains.stream()
        .filter(chain -> String.join(".", chain).equals(text))
        .min(Comparator.comparingInt(List::size));
  }

  /** The name chain of every field, at every depth, in the candidate's container. */
  private static List<List<String>> fieldsOf(EntityInterface<?> entity, Candidate candidate) {
    List<?> fields = ChildFieldResolver.containerListFor(entity, candidate.container());
    List<List<String>> chains = new ArrayList<>();
    collect(listOrEmpty(fields), List.of(), chains);
    return chains;
  }

  private static void collect(List<?> fields, List<String> parent, List<List<String>> chains) {
    for (Object item : fields) {
      FieldInterface field = (FieldInterface) item;
      List<String> chain = new ArrayList<>(parent);
      chain.add(field.getName());
      chains.add(chain);
      collect(listOrEmpty(field.getChildren()), chain, chains);
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
