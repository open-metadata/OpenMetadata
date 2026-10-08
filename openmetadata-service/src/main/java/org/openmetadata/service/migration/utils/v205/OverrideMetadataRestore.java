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
import java.sql.SQLException;
import java.sql.Timestamp;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.Iterator;
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
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.DataMigrationStep;
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
 * cannot block the description restore. A failure is logged and skipped, per entity and per
 * entity type: the upgrade must not fail over metadata it can leave as it was.
 */
@Slf4j
public final class OverrideMetadataRestore {

  public static final String STEP_NAME = "restoreOverrideMetadata";
  public static final String VERSION = "2.0.5";

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
          + "WHERE version LIKE '2.0.%' AND version <> '"
          + VERSION
          + "'";
  // "table does not exist" on MySQL and Postgres: a fresh install has no SERVER_CHANGE_LOG yet.
  private static final Set<String> MISSING_TABLE_SQL_STATES = Set.of("42S02", "42P01");

  private OverrideMetadataRestore() {}

  /**
   * When this instance first ran 2.0.x, as {@link #windowBeforeRun} read it. {@code since} is null
   * when it never did; {@code unreadable} is set when that could not be told, which must not pass
   * for "never did" - the restore would be marked done without having run.
   */
  public record Window(Long since, RuntimeException unreadable) {}

  /**
   * Runs the restore at most once per instance. Never throws: the upgrade must not fail over
   * metadata it can leave as it was. A failure writes no marker, so clearing this version's data
   * migration row from SERVER_MIGRATION_SQL_LOGS makes the next migrate run it again.
   */
  public static void restoreOnce(final MigrationDAO migrationDAO, final Window window) {
    try {
      if (window.unreadable() != null) {
        throw window.unreadable();
      }
      DataMigrationStep.runOnce(migrationDAO, VERSION, STEP_NAME, () -> restore(window.since()));
    } catch (RuntimeException e) {
      LOG.error(
          "v205: metadata removed by 2.0.x ingestion runs was not fully restored. To retry, delete "
              + "the '-- data migration' row of version {} from SERVER_MIGRATION_SQL_LOGS and run "
              + "migrate again",
          VERSION,
          e);
    }
  }

  public static void restore(final Long since) {
    if (since == null) {
      LOG.info("v205: this instance never ran 2.0.x before, nothing to restore");
    } else {
      restoreTypes(ENTITY_TYPES, since);
    }
  }

  /** Each type on its own, so one that fails does not skip the rest; throws if any failed. */
  static void restoreTypes(final List<String> entityTypes, final long since) {
    final List<String> failed = new ArrayList<>();
    for (final String entityType : entityTypes) {
      try {
        restoreType(entityType, since, new ListFilter(Include.NON_DELETED));
      } catch (RuntimeException e) {
        LOG.error("v205: could not restore {} entities", entityType, e);
        failed.add(entityType);
      }
    }
    if (!failed.isEmpty()) {
      throw new IllegalStateException("v205: restore failed for entity types " + failed);
    }
  }

  /**
   * {@link #windowStart} as the database stood before this migration run. Call it while the
   * workflow loads migrations: a 1.x upgrade records 2.0.0-2.0.4 in the same run, just before 2.0.5,
   * which read later would pass for a 2.0.x history. Never throws, since the workflow drops every
   * later version when loading one fails. A fresh install has no change log yet.
   */
  public static Window windowBeforeRun() {
    Window window;
    try {
      window = new Window(Entity.getJdbi().withHandle(OverrideMetadataRestore::windowStart), null);
    } catch (RuntimeException e) {
      window = new Window(null, isMissingTable(e) ? null : e);
    }
    return window;
  }

  static boolean isMissingTable(final Throwable error) {
    Throwable cause = error;
    while (cause != null && !(cause instanceof SQLException)) {
      cause = cause.getCause();
    }
    return cause instanceof SQLException sqlError
        && MISSING_TABLE_SQL_STATES.contains(sqlError.getSQLState());
  }

  /** When this instance first ran a 2.0.x server, or null when it never did. */
  public static Long windowStart(final Handle handle) {
    final Timestamp installed = handle.createQuery(WINDOW_START_SQL).mapTo(Timestamp.class).one();
    return installed == null ? null : installed.getTime() - CLOCK_SKEW_MS;
  }

  /** Restores the entities of one type that {@code filter} lists; returns the fields restored. */
  public static int restoreType(
      final String entityType, final long since, final ListFilter filter) {
    final EntityRepository<? extends EntityInterface> repository =
        Entity.getEntityRepository(entityType);
    int checked = 0;
    int restored = 0;
    List<String> batch = repository.getDao().listAfter(filter, BATCH_SIZE, "", "");
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
              : repository
                  .getDao()
                  .listAfter(
                      filter, BATCH_SIZE, last.get("name").asText(), last.get("id").asText());
    }
    LOG.info("v205: restored {} field(s) on {} {} entities", restored, checked, entityType);
    return restored;
  }

  /** Restores one entity and returns how many fields were restored. */
  public static int restoreEntity(final String entityType, final UUID id, final long since) {
    int restored = 0;
    try {
      final EntityRepository<? extends EntityInterface> repository =
          Entity.getEntityRepository(entityType);
      final JsonNode current = currentState(repository, id);
      final List<JsonNode> history = history(entityType, id, current, since);
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

  /**
   * The entity's versions, newest first, from the current one back to the first older than the
   * window - {@link RemovedMetadata} never looks past it. Read one at a time, since a wide table
   * with a long history would not fit in memory whole.
   */
  private static List<JsonNode> history(
      final String entityType, final UUID id, final JsonNode current, final long since) {
    final EntityExtensionDAO versions = Entity.getCollectionDAO().entityExtensionDAO();
    final Iterator<String> newestFirst =
        versions.getExtensionNames(id, EntityUtil.getVersionExtensionPrefix(entityType)).stream()
            .sorted(Comparator.comparing(EntityUtil::getVersion).reversed())
            .iterator();
    final List<JsonNode> history = new ArrayList<>();
    history.add(current);
    while (newestFirst.hasNext() && history.getLast().path("updatedAt").asLong() >= since) {
      history.add(JsonUtils.readTree(versions.getExtension(id, newestFirst.next())));
    }
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
