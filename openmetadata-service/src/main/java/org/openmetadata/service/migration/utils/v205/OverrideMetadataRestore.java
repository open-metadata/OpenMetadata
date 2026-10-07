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

package org.openmetadata.service.migration.utils.v205;

import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.json.JsonPatch;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.ToIntFunction;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.ExtensionRecord;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.EntityUtil;

/**
 * Restores what 2.0.x ingestion runs removed from user-curated metadata (#34662, #34774).
 *
 * <p>From 2.0.0 every connector writes through the bulk PUT path, and until 2.0.5 a bot run could
 * blank a description or displayName (overrideMetadata=true), drop table constraints and
 * retentionPeriod (any bot PUT), and replace a whole tag list with the tags the source sent
 * (overrideMetadata=true, from 2.0.2), deleting Tier, automator and hand-applied tags. The fixed
 * server does none of that, so undoing it brings the data to the state the fixed server keeps.
 *
 * <p>Version history is the record of what was lost: see {@link RemovedMetadata}. Writes go
 * through the repository as admin, so each restore is a new entity version and the search index
 * follows. Each group of fields is its own PATCH, so a tag or constraint the server now rejects
 * cannot block the description restore. A failure is logged and skipped: the upgrade must not
 * fail over metadata it can leave as it was.
 */
@Slf4j
public final class OverrideMetadataRestore {

  public static final String STEP_NAME = "restoreOverrideMetadata";

  // Every entity type ingestion writes with a bot PUT: the bulk path, plus Container, whose
  // retentionPeriod a single bot PUT blanked too.
  private static final List<String> ENTITY_TYPES =
      List.of(
          Entity.DATABASE,
          Entity.DATABASE_SCHEMA,
          Entity.TABLE,
          Entity.STORED_PROCEDURE,
          Entity.CONTAINER,
          Entity.DASHBOARD,
          Entity.CHART,
          Entity.DASHBOARD_DATA_MODEL,
          Entity.TOPIC,
          Entity.MLMODEL,
          Entity.SEARCH_INDEX,
          Entity.API_COLLECTION,
          Entity.API_ENDPOINT,
          Entity.DIRECTORY,
          Entity.FILE,
          Entity.SPREADSHEET,
          Entity.WORKSHEET);
  private static final List<String> FETCH_FIELDS = List.of("tags", "columns", "tableConstraints");
  private static final List<ToIntFunction<RemovedMetadata>> PATCH_GROUPS =
      List.of(
          RemovedMetadata::restoreFields,
          RemovedMetadata::restoreTags,
          RemovedMetadata::restoreConstraints);
  private static final int BATCH_SIZE = 200;
  // installed_on is written in the database server's time zone; widen the window so a zone offset
  // cannot hide the first ingestion run after the upgrade.
  private static final long CLOCK_SKEW_MS = Duration.ofDays(1).toMillis();
  private static final String WINDOW_START_SQL =
      "SELECT MIN(installed_on) FROM SERVER_CHANGE_LOG "
          + "WHERE version LIKE '2.0.%' AND version <> '2.0.5'";

  private OverrideMetadataRestore() {}

  public static void restore(final Long since) {
    if (since == null) {
      LOG.info("v205: this instance never ran 2.0.x before, nothing to restore");
    } else {
      ENTITY_TYPES.forEach(entityType -> restoreType(entityType, since));
    }
  }

  /**
   * {@link #windowStart} as the database stood before this migration run. Call it while the
   * workflow loads migrations: a 1.x upgrade records 2.0.0-2.0.4 in the same run, just before 2.0.5,
   * which read later would pass for a 2.0.x history. Never throws, since the workflow drops every
   * later version when loading one fails; null also covers a fresh install with no change log yet.
   */
  public static Long windowStartBeforeRun() {
    Long since = null;
    try {
      since = Entity.getJdbi().withHandle(OverrideMetadataRestore::windowStart);
    } catch (RuntimeException e) {
      LOG.info("v205: no 2.0.x migration history to read, nothing to restore", e);
    }
    return since;
  }

  /** When this instance first ran a 2.0.x server, or null when it never did. */
  public static Long windowStart(final Handle handle) {
    final Timestamp installed = handle.createQuery(WINDOW_START_SQL).mapTo(Timestamp.class).one();
    return installed == null ? null : installed.getTime() - CLOCK_SKEW_MS;
  }

  private static void restoreType(final String entityType, final long since) {
    final EntityRepository<? extends EntityInterface> repository =
        Entity.getEntityRepository(entityType);
    int checked = 0;
    int restored = 0;
    List<String> batch = nextBatch(repository, "", "");
    while (!batch.isEmpty()) {
      JsonNode last = null;
      for (final String json : batch) {
        last = JsonUtils.readTree(json);
        if (last.path("updatedAt").asLong() >= since) {
          checked++;
          restored += restoreEntity(entityType, UUID.fromString(last.get("id").asText()), since);
        }
      }
      batch =
          batch.size() < BATCH_SIZE
              ? List.of()
              : nextBatch(repository, last.get("name").asText(), last.get("id").asText());
    }
    LOG.info("v205: restored {} field(s) on {} {} entities", restored, checked, entityType);
  }

  private static List<String> nextBatch(
      final EntityRepository<? extends EntityInterface> repository,
      final String afterName,
      final String afterId) {
    return repository
        .getDao()
        .listAfter(new ListFilter(Include.NON_DELETED), BATCH_SIZE, afterName, afterId);
  }

  /** Restores one entity and returns how many fields were restored. */
  public static int restoreEntity(final String entityType, final UUID id, final long since) {
    int restored = 0;
    try {
      final EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(entityType);
      final JsonNode current = currentState(repository, id);
      final List<JsonNode> history = history(entityType, id, current);
      for (final ToIntFunction<RemovedMetadata> group : PATCH_GROUPS) {
        final ObjectNode target = current.deepCopy();
        final int fields = group.applyAsInt(new RemovedMetadata(history, target, since));
        restored += patch(repository, id, current, target, fields);
      }
    } catch (RuntimeException e) {
      LOG.warn("v205: could not restore {} {}", entityType, id, e);
    }
    return restored;
  }

  private static JsonNode currentState(
      final EntityRepository<? extends EntityInterface> repository, final UUID id) {
    final Set<String> allowed = repository.getAllowedFieldsCopy();
    final String fields =
        FETCH_FIELDS.stream().filter(allowed::contains).collect(Collectors.joining(","));
    return JsonUtils.valueToTree(repository.get(null, id, repository.getFields(fields)));
  }

  /** The entity's versions, newest first, starting with the current one. */
  private static List<JsonNode> history(
      final String entityType, final UUID id, final JsonNode current) {
    final List<JsonNode> history = new ArrayList<>();
    history.add(current);
    // ponytail: loads every stored version of the entity; page it newest-first if entities with
    // thousands of versions make the upgrade too slow.
    Entity.getCollectionDAO()
        .entityExtensionDAO()
        .getExtensions(id, EntityUtil.getVersionExtensionPrefix(entityType))
        .stream()
        .sorted(
            Comparator.comparing((ExtensionRecord r) -> EntityUtil.getVersion(r.extensionName()))
                .reversed())
        .forEach(r -> history.add(JsonUtils.readTree(r.extensionJson())));
    return history;
  }

  private static int patch(
      final EntityRepository<? extends EntityInterface> repository,
      final UUID id,
      final JsonNode current,
      final ObjectNode target,
      final int fields) {
    int restored = 0;
    final JsonPatch patch = JsonUtils.getJsonPatch(current, target);
    if (fields > 0 && !patch.toJsonArray().isEmpty()) {
      try {
        repository.patch(null, id, ADMIN_USER_NAME, patch);
        restored = fields;
      } catch (RuntimeException e) {
        LOG.warn("v205: could not apply {} to {}", patch.toJsonArray(), id, e);
      }
    }
    return restored;
  }
}
