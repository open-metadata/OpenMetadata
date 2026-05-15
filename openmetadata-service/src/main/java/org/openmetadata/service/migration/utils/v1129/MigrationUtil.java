package org.openmetadata.service.migration.utils.v1129;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.sql.ResultSet;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Migration utility for 1.12.8 — backfills domains on tasks so that domain-scoped users can see
 * tasks in the activity feed.
 *
 * <p>Two storage layouts are handled:
 *
 * <ul>
 *   <li>1.12.x: tasks live in {@code thread_entity} (type='Task'); the {@code about} field is an
 *       entity link string (e.g. {@code <#E::glossaryTerm::Glossary.Term>}). Domains are a UUID
 *       array in {@code $.domains}. Entity link is parsed per row, but domain lookups are cached by
 *       {@code (entityType, entityFQN)} so each unique target entity is resolved only once.
 *   <li>2.x: tasks live in {@code task_entity}; the about entity is stored as a {@code
 *       MENTIONED_IN} row in {@code entity_relationship}. Domains are HAS rows in the same table.
 *       A single INSERT...SELECT walking MENTIONED_IN → HAS handles all missing rows in bulk.
 * </ul>
 */
@Slf4j
public class MigrationUtil {

  private static final int BATCH_SIZE = 500;
  private static final int RELATION_MENTIONED_IN = Relationship.MENTIONED_IN.ordinal();
  private static final int RELATION_HAS = Relationship.HAS.ordinal();

  private final Handle handle;
  private final ConnectionType connectionType;

  public MigrationUtil(Handle handle, ConnectionType connectionType) {
    this.handle = handle;
    this.connectionType = connectionType;
  }

  public void migrateTaskDomains() {
    int threadUpdated = migrateThreadEntityTaskDomains();
    int taskEntityUpdated = migrateTaskEntityDomains();
    LOG.info(
        "Task domain migration complete. threadEntityUpdated={}, taskEntityUpdated={}",
        threadUpdated,
        taskEntityUpdated);
  }

  // ---------------------------------------------------------------------------
  // thread_entity migration (1.12.x)
  //
  // The `about` field is an entity link string — not a UUID or FQN — so it
  // cannot be joined in SQL. We parse it in Java with MessageParser, but cache
  // domain lookups by (entityType, entityFQN) so each unique target entity is
  // hit only once, even when thousands of tasks point to the same glossary term.
  //
  // IMPORTANT: we always query with OFFSET 0. As rows are updated ($.domains set),
  // they drop out of the WHERE clause (JSON_EXTRACT/-> IS NULL), so the batch
  // naturally advances without any offset tracking. Using a growing OFFSET would skip rows.
  // ---------------------------------------------------------------------------

  private int migrateThreadEntityTaskDomains() {
    if (!tableExists("thread_entity")) {
      LOG.info("No thread_entity table found, skipping thread task domain migration");
      return 0;
    }

    Map<String, List<UUID>> domainCache = new HashMap<>();
    int withDomains = 0;
    int markedDone = 0;

    while (true) {
      List<String[]> batch = readThreadTaskBatch(BATCH_SIZE);
      if (batch.isEmpty()) break;
      for (String[] row : batch) {
        int result = processThreadTaskRow(row[0], row[1], domainCache);
        if (result == 1) withDomains++;
        else if (result == 2) markedDone++;
      }
      LOG.debug(
          "Thread task migration progress: withDomains={}, markedDone={}", withDomains, markedDone);
    }

    LOG.info(
        "Migrated {} thread tasks in thread_entity (withDomains={}, markedDone={})",
        withDomains + markedDone,
        withDomains,
        markedDone);
    return withDomains + markedDone;
  }

  // Returns: 0 = skipped (lookup failed), 1 = updated with domains, 2 = marked done (no domains)
  private int processThreadTaskRow(String id, String json, Map<String, List<UUID>> domainCache) {
    try {
      List<UUID> domainIds = resolveThreadTaskDomains(json, domainCache);
      if (domainIds == null) {
        // Lookup failed — skip without marking so it can be retried.
        return 0;
      }
      if (domainIds.isEmpty()) {
        // Setting $.domains=[] makes JSON_EXTRACT(json,'$.domains') return []
        // (not SQL NULL), so it drops out of the WHERE clause.
        markThreadDomainsMigrated(id);
        return 2;
      }
      updateThreadDomains(id, domainIds);
      return 1;
    } catch (Exception e) {
      LOG.warn("Failed to migrate thread task domains for id={}: {}", id, e.getMessage());
      return 0;
    }
  }

  private List<String[]> readThreadTaskBatch(int limit) {
    String whereClause =
        connectionType == ConnectionType.MYSQL
            ? "WHERE type = 'Task' AND JSON_EXTRACT(json, '$.domains') IS NULL"
            : "WHERE type = 'Task' AND json->'domains' IS NULL";
    return handle
        .createQuery(
            "SELECT id, json FROM thread_entity "
                + whereClause
                + " ORDER BY createdAt LIMIT :limit")
        .bind("limit", limit)
        .map((rs, ctx) -> new String[] {rs.getString("id"), rs.getString("json")})
        .list();
  }

  // null = lookup failed (skip row); emptyList = no domains (mark done); non-empty = has domains
  private List<UUID> resolveThreadTaskDomains(String json, Map<String, List<UUID>> cache) {
    try {
      JsonNode node = JsonUtils.readTree(json);
      JsonNode aboutNode = node.get("about");
      if (aboutNode == null || aboutNode.isNull()) return Collections.emptyList();

      String about = aboutNode.asText(null);
      if (nullOrEmpty(about)) return Collections.emptyList();

      MessageParser.EntityLink entityLink = MessageParser.EntityLink.parse(about);
      String cacheKey = entityLink.getEntityType() + "::" + entityLink.getEntityFQN();

      if (cache.containsKey(cacheKey)) return cache.get(cacheKey);
      List<UUID> ids = fetchDomainIds(entityLink);
      cache.put(cacheKey, ids);
      return ids;
    } catch (Exception e) {
      LOG.debug("Could not resolve domains from thread JSON: {}", e.getMessage());
      return null;
    }
  }

  private List<UUID> fetchDomainIds(MessageParser.EntityLink entityLink) {
    try {
      EntityRepository<?> repo = Entity.getEntityRepository(entityLink.getEntityType());
      if (!repo.isSupportsDomains()) return Collections.emptyList();

      EntityReference ref =
          Entity.getEntityReferenceByName(
              entityLink.getEntityType(), entityLink.getEntityFQN(), Include.ALL);
      if (ref == null || ref.getId() == null) return Collections.emptyList();

      Object entity = repo.get(null, ref.getId(), repo.getFields(Entity.FIELD_DOMAINS));
      if (!(entity instanceof EntityInterface ei)) {
        return Collections.emptyList();
      }

      List<EntityReference> domains = ei.getDomains();
      if (nullOrEmpty(domains)) return Collections.emptyList();

      List<UUID> ids = new ArrayList<>(domains.size());
      for (EntityReference d : domains) {
        if (d.getId() != null) ids.add(d.getId());
      }
      return ids;
    } catch (EntityNotFoundException e) {
      LOG.debug(
          "Entity not found for {}::{}, treating as no domains",
          entityLink.getEntityType(),
          entityLink.getEntityFQN());
      return Collections.emptyList();
    }
  }

  /**
   * Sets $.domains to an empty array so JSON_EXTRACT(json,'$.domains') returns [] (not SQL NULL),
   * causing the row to drop out of the WHERE clause and not be re-fetched.
   */
  private void markThreadDomainsMigrated(String threadId) {
    if (connectionType == ConnectionType.MYSQL) {
      handle
          .createUpdate(
              "UPDATE thread_entity "
                  + "SET json = JSON_SET(json, '$.domains', CAST('[]' AS JSON)) "
                  + "WHERE id = :id")
          .bind("id", threadId)
          .execute();
    } else {
      handle
          .createUpdate(
              "UPDATE thread_entity "
                  + "SET json = jsonb_set(json, '{domains}', '[]'::jsonb) "
                  + "WHERE id = :id")
          .bind("id", threadId)
          .execute();
    }
  }

  private void updateThreadDomains(String threadId, List<UUID> domainIds) {
    String domainsJson = buildUuidJsonArray(domainIds);
    if (connectionType == ConnectionType.MYSQL) {
      handle
          .createUpdate(
              "UPDATE thread_entity "
                  + "SET json = JSON_SET(json, '$.domains', CAST(:domains AS JSON)) "
                  + "WHERE id = :id")
          .bind("domains", domainsJson)
          .bind("id", threadId)
          .execute();
    } else {
      handle
          .createUpdate(
              "UPDATE thread_entity "
                  + "SET json = jsonb_set(json, '{domains}', :domains::jsonb) "
                  + "WHERE id = :id")
          .bind("domains", domainsJson)
          .bind("id", threadId)
          .execute();
    }
  }

  // ---------------------------------------------------------------------------
  // task_entity migration (2.x)
  //
  // The about entity is a real entity_relationship row (MENTIONED_IN), so a
  // bulk INSERT...SELECT joining MENTIONED_IN → HAS correctly resolves all
  // missing domain relationships without any Java-side entity parsing.
  //
  // Column names are unquoted in both MySQL and PostgreSQL — unquoted DDL
  // names are stored lowercase in PostgreSQL, and unquoted query identifiers
  // are also folded to lowercase, so they match. Quoted names would break
  // PostgreSQL since the columns are actually stored as lowercase.
  //
  // After each batch the NOT EXISTS eliminates already-inserted rows, so
  // the loop naturally terminates when no new rows can be inserted.
  // ---------------------------------------------------------------------------

  private int migrateTaskEntityDomains() {
    if (!tableExists("task_entity")) {
      LOG.info("No task_entity table found, skipping task entity domain migration");
      return 0;
    }

    int totalInserted = 0;
    while (true) {
      int inserted = insertTaskDomainsBatch();
      totalInserted += inserted;
      LOG.debug("Task domain migration progress: {} relationships inserted so far", totalInserted);
      if (inserted < BATCH_SIZE) break;
    }

    LOG.info("Inserted {} domain relationships for task entities in task_entity", totalInserted);
    return totalInserted;
  }

  private int insertTaskDomainsBatch() {
    String sql =
        connectionType == ConnectionType.MYSQL
            ? buildMysqlInsertTaskDomainSql()
            : buildPostgresInsertTaskDomainSql();
    return handle.createUpdate(sql).execute();
  }

  private String buildMysqlInsertTaskDomainSql() {
    return "INSERT IGNORE INTO entity_relationship "
        + "  (fromId, toId, fromEntity, toEntity, relation) "
        + "SELECT er_domain.fromId, er_about.toId, 'domain', 'task', "
        + RELATION_HAS
        + " "
        + "FROM entity_relationship er_about "
        + "JOIN entity_relationship er_domain "
        + "  ON er_domain.toId     = er_about.fromId "
        + "  AND er_domain.toEntity = er_about.fromEntity "
        + "  AND er_domain.fromEntity = 'domain' "
        + "  AND er_domain.relation = "
        + RELATION_HAS
        + " "
        + "WHERE er_about.toEntity = 'task' "
        + "  AND er_about.relation = "
        + RELATION_MENTIONED_IN
        + " "
        + "  AND NOT EXISTS ("
        + "    SELECT 1 FROM entity_relationship ex "
        + "    WHERE ex.fromId = er_domain.fromId "
        + "    AND ex.toId = er_about.toId AND ex.toEntity = 'task' "
        + "    AND ex.fromEntity = 'domain' AND ex.relation = "
        + RELATION_HAS
        + "  ) "
        + "LIMIT "
        + BATCH_SIZE;
  }

  private String buildPostgresInsertTaskDomainSql() {
    return "INSERT INTO entity_relationship "
        + "  (fromId, toId, fromEntity, toEntity, relation) "
        + "SELECT er_domain.fromId, er_about.toId, 'domain', 'task', "
        + RELATION_HAS
        + " "
        + "FROM entity_relationship er_about "
        + "JOIN entity_relationship er_domain "
        + "  ON er_domain.toId     = er_about.fromId "
        + "  AND er_domain.toEntity = er_about.fromEntity "
        + "  AND er_domain.fromEntity = 'domain' "
        + "  AND er_domain.relation = "
        + RELATION_HAS
        + " "
        + "WHERE er_about.toEntity = 'task' "
        + "  AND er_about.relation = "
        + RELATION_MENTIONED_IN
        + " "
        + "  AND NOT EXISTS ("
        + "    SELECT 1 FROM entity_relationship ex "
        + "    WHERE ex.fromId = er_domain.fromId "
        + "    AND ex.toId = er_about.toId AND ex.toEntity = 'task' "
        + "    AND ex.fromEntity = 'domain' AND ex.relation = "
        + RELATION_HAS
        + "  ) "
        + "LIMIT "
        + BATCH_SIZE
        + " ON CONFLICT (fromId, toId, relation) DO NOTHING";
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private String buildUuidJsonArray(List<UUID> ids) {
    StringBuilder sb = new StringBuilder("[");
    for (int i = 0; i < ids.size(); i++) {
      if (i > 0) sb.append(",");
      sb.append("\"").append(ids.get(i)).append("\"");
    }
    sb.append("]");
    return sb.toString();
  }

  private boolean tableExists(String tableName) {
    try (ResultSet tables =
        handle
            .getConnection()
            .getMetaData()
            .getTables(null, null, tableName, new String[] {"TABLE"})) {
      while (tables.next()) {
        if (tableName.equalsIgnoreCase(tables.getString("TABLE_NAME"))) {
          return true;
        }
      }
      return false;
    } catch (Exception e) {
      LOG.warn("Could not check for table '{}': {}", tableName, e.getMessage());
      return false;
    }
  }
}
