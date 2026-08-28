package org.openmetadata.service.migration.utils.v1129;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.migration.utils.v160.MigrationUtil.addOperationsToPolicyRule;

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
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.resources.feeds.MessageParser;

/**
 * Migration utility for 1.12.9 — backfills domains on tasks so that domain-scoped users can see
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
 *
 * <p>After this migration completes, the search index for tasks must be rebuilt for domain-scoped
 * feed queries that hit Elasticsearch/OpenSearch to reflect the new domain values. Operators
 * should trigger a tasks reindex post-upgrade.
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
    int markedDoneOnError = 0;

    while (true) {
      List<String[]> batch = readThreadTaskBatch(BATCH_SIZE);
      if (batch.isEmpty()) break;
      int processedInBatch = 0;
      for (String[] row : batch) {
        int result = processThreadTaskRow(row[0], row[1], domainCache);
        if (result == 1) withDomains++;
        else if (result == 2) markedDone++;
        else if (result == 3) markedDoneOnError++;
        if (result != 0) processedInBatch++;
      }
      LOG.debug(
          "Thread task migration progress: withDomains={}, markedDone={}, markedDoneOnError={}",
          withDomains,
          markedDone,
          markedDoneOnError);
      if (processedInBatch == 0) {
        LOG.error(
            "Stalled thread_entity domain migration: a full batch of {} rows produced no updates. "
                + "Aborting to avoid infinite loop. Inspect ERROR logs above for failing thread IDs.",
            batch.size());
        break;
      }
    }

    int total = withDomains + markedDone + markedDoneOnError;
    LOG.info(
        "Migrated {} thread tasks in thread_entity (withDomains={}, markedDone={}, markedDoneOnError={})",
        total,
        withDomains,
        markedDone,
        markedDoneOnError);
    if (markedDoneOnError > 0) {
      LOG.warn(
          "{} thread tasks were marked done with empty $.domains because their target entity "
              + "could not be resolved. Inspect WARN logs above for the specific rows.",
          markedDoneOnError);
    }
    return total;
  }

  /**
   * Process a single thread row.
   *
   * <p>Returns 1 if domains were written, 2 if marked done with empty domains because the target
   * entity has none, 3 if marked done with empty domains as a safe fallback because the target
   * entity could not be resolved.
   *
   * <p>Unresolvable rows are still marked done to prevent an infinite loop: the read query selects
   * on {@code $.domains IS NULL}, so any row left with NULL would be re-fetched in every subsequent
   * batch and the loop would never terminate. Emitting {@code []} matches the legitimate
   * "no domains" path and keeps the row out of the WHERE clause.
   */
  private int processThreadTaskRow(String id, String json, Map<String, List<UUID>> domainCache) {
    try {
      List<UUID> domainIds = resolveThreadTaskDomains(json, domainCache);
      if (domainIds == null) {
        LOG.warn(
            "Could not resolve domains for thread id={}; marking with empty $.domains to avoid migration loop",
            id);
        markThreadDomainsMigrated(id);
        return 3;
      }
      if (domainIds.isEmpty()) {
        markThreadDomainsMigrated(id);
        return 2;
      }
      updateThreadDomains(id, domainIds);
      return 1;
    } catch (Exception e) {
      LOG.warn(
          "Failed to migrate thread task domains for id={}, marking with empty $.domains: {}",
          id,
          e.getMessage());
      try {
        markThreadDomainsMigrated(id);
        return 3;
      } catch (Exception markEx) {
        LOG.error(
            "Failed to mark thread id={} as migrated after error; this row will be retried "
                + "and may stall the migration: {}",
            id,
            markEx.getMessage());
        return 0;
      }
    }
  }

  private List<String[]> readThreadTaskBatch(int limit) {
    // Catches three "no domains" states:
    //   1. key missing               → JSON_EXTRACT / -> returns SQL NULL
    //   2. "domains": null           → JSON_TYPE = 'NULL' / jsonb_typeof = 'null'
    //   3. (intentional no-op once $.domains = [] is written by the migration)
    // Without case 2 the migration silently skips tasks where Jackson serialized
    // a null domains field — which is the default for any task created before
    // CreateApprovalTaskImpl was patched to set .withDomains(...).
    String whereClause =
        connectionType == ConnectionType.MYSQL
            ? "WHERE type = 'Task' AND ("
                + "JSON_EXTRACT(json, '$.domains') IS NULL "
                + "OR JSON_TYPE(JSON_EXTRACT(json, '$.domains')) = 'NULL'"
                + ")"
            : "WHERE type = 'Task' AND ("
                + "json->'domains' IS NULL "
                + "OR jsonb_typeof(json->'domains') = 'null'"
                + ")";
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
    // NOT EXISTS deliberately does NOT filter on ex.deleted: tasks are hard-deleted only, so
    // any (domain, task, HAS) row that exists at all should be respected. Filtering on
    // ex.deleted = FALSE would let the SELECT yield rows that collide with soft-deleted PKs
    // (deleted is not part of the PK), making INSERT IGNORE's affected-row count drop below
    // BATCH_SIZE and break the loop prematurely.
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
        + "  AND er_domain.deleted = FALSE "
        + "WHERE er_about.toEntity = 'task' "
        + "  AND er_about.relation = "
        + RELATION_MENTIONED_IN
        + " "
        + "  AND er_about.deleted = FALSE "
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
    // See note on buildMysqlInsertTaskDomainSql: NOT EXISTS intentionally omits ex.deleted.
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
        + "  AND er_domain.deleted = FALSE "
        + "WHERE er_about.toEntity = 'task' "
        + "  AND er_about.relation = "
        + RELATION_MENTIONED_IN
        + " "
        + "  AND er_about.deleted = FALSE "
        + "  AND NOT EXISTS ("
        + "    SELECT 1 FROM entity_relationship ex "
        + "    WHERE ex.fromId = er_domain.fromId "
        + "    AND ex.toId = er_about.toId AND ex.toEntity = 'task' "
        + "    AND ex.fromEntity = 'domain' AND ex.relation = "
        + RELATION_HAS
        + "  ) "
        + "LIMIT "
        + BATCH_SIZE
        + " ON CONFLICT DO NOTHING";
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

  // ---------------------------------------------------------------------------
  // Policy migrations (static, callable without a Handle)
  // ---------------------------------------------------------------------------

  /**
   * Retrofits seeded bot policies that grant broad {@code EditAll} on {@code ["All"]} resources
   * with the {@code Trigger} operation. Pre-fix these identities could trigger pipelines because
   * {@code /trigger} skipped authz; the migration preserves that behavior under the new authz
   * enforcement (GH-27962).
   *
   * <p>Each entry is idempotent via {@link
   * org.openmetadata.service.migration.utils.v160.MigrationUtil#addOperationsToPolicyRule}.
   */
  public static void addTriggerOperationToDefaultBotPolicies(CollectionDAO collectionDAO) {
    record PolicyRule(String policy, String rule) {}
    List<PolicyRule> targets =
        List.of(
            new PolicyRule("IngestionBotPolicy", "IngestionBotRule-Allow"),
            new PolicyRule("LineageBotPolicy", "LineageBotRule-Allow"),
            new PolicyRule("ProfilerBotPolicy", "ProfilerBotBotRule-Allow"),
            new PolicyRule("QualityBotPolicy", "QualityBotBotRule-Allow"),
            new PolicyRule("UsageBotPolicy", "UsageBotRule-Allow-Usage"));
    for (PolicyRule t : targets) {
      addOperationsToPolicyRule(
          t.policy(), t.rule(), List.of(MetadataOperation.TRIGGER), collectionDAO);
    }
  }

  /**
   * Adds a dedicated {@code DataStewardPolicy-TriggerRule} to the existing {@code
   * DataStewardPolicy} if not already present. Data stewards already have {@code EditOwners} on
   * all resources, so they could already reach trigger via an ownership rewrite; this rule makes
   * the capability explicit for audit clarity rather than burying it inside the existing edit
   * rule.
   *
   * <p>Mirrors the new-rule shape used by {@code
   * v180.MigrationUtil.addDenyDisplayNameRuleToBotPolicies}. Idempotent — skips when the rule
   * already exists.
   */
  public static void addTriggerRuleToDataStewardPolicy(CollectionDAO collectionDAO) {
    PolicyRepository repository = (PolicyRepository) Entity.getEntityRepository(Entity.POLICY);
    try {
      Policy policy = repository.findByName("DataStewardPolicy", Include.NON_DELETED);
      boolean hasTriggerRule =
          policy.getRules().stream()
              .anyMatch(
                  r ->
                      "DataStewardPolicy-TriggerRule".equals(r.getName())
                          && r.getEffect() == Rule.Effect.ALLOW
                          && r.getOperations() != null
                          && r.getOperations().contains(MetadataOperation.TRIGGER));
      if (!hasTriggerRule) {
        Rule triggerRule =
            new Rule()
                .withName("DataStewardPolicy-TriggerRule")
                .withResources(List.of("all"))
                .withOperations(List.of(MetadataOperation.TRIGGER))
                .withEffect(Rule.Effect.ALLOW);
        policy.getRules().add(triggerRule);
        collectionDAO
            .policyDAO()
            .update(policy.getId(), policy.getFullyQualifiedName(), JsonUtils.pojoToJson(policy));
        LOG.info("Added DataStewardPolicy-TriggerRule to DataStewardPolicy");
      } else {
        LOG.debug("DataStewardPolicy already has TriggerRule, skipping");
      }
    } catch (EntityNotFoundException ex) {
      LOG.warn("DataStewardPolicy not found, skipping TriggerRule addition");
    }
  }
}
