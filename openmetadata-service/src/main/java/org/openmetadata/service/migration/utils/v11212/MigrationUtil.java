package org.openmetadata.service.migration.utils.v11212;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.Workflow.GLOBAL_NAMESPACE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_ID_VARIABLE;
import static org.openmetadata.service.governance.workflows.Workflow.RELATED_ENTITY_VARIABLE;
import static org.openmetadata.service.governance.workflows.WorkflowVariableHandler.getNamespacedVariableName;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.WorkflowHandler;
import org.openmetadata.service.migration.utils.PiiRecognizerMigrationUtil;
import org.openmetadata.service.resources.feeds.MessageParser.EntityLink;

/**
 * One-time repair for glossary-term {@code RequestApproval} tasks stranded by a move/rename on
 * 1.12.x / 1.13, where the move never updated the stale FQN references (that code only exists on
 * main, so it can't be backpatched).
 *
 * <p>Self-contained by design: it only touches tables/APIs that exist on those branches
 * ({@code thread_entity}, {@code workflow_instance_time_series}, the Flowable runtime), so it
 * backports cleanly. The stable anchor is {@code thread_entity.json.entityRef.id} (the term's
 * immutable id): resolve the term's current FQN by id, then rewrite every stale reference to it —
 *
 * <ul>
 *   <li>{@code thread_entity.json.about} — the task points at the term's new location.
 *   <li>{@code workflow_instance_time_series.variables.global_relatedEntity} — the
 *       workflow-history API (queried by the new FQN) finds the instance again.
 *   <li>the running Flowable instance's {@code global_relatedEntity} variable — approving the
 *       still-open task now resolves the term, so the workflow finishes instead of throwing
 *       {@code EntityNotFoundException}.
 *   <li>the running Flowable instance's {@code global_relatedEntityId} variable — old instances
 *       that are still current during migration keep resolving by immutable id after any future
 *       move.
 * </ul>
 */
@Slf4j
public final class MigrationUtil {
  private MigrationUtil() {}

  private static final String GLOSSARY_TERM_TYPE = "glossaryTerm";
  private static final String REQUEST_APPROVAL_TASK = "RequestApproval";
  private static final String RELATED_ENTITY_KEY =
      getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_VARIABLE);
  private static final String RELATED_ENTITY_ID_KEY =
      getNamespacedVariableName(GLOBAL_NAMESPACE, RELATED_ENTITY_ID_VARIABLE);

  public static void repairStaleGlossaryApprovalFqns(Handle handle, boolean isPostgres) {
    if (!tableExists(handle, isPostgres, "thread_entity")) {
      LOG.info(
          "[1.12.12] thread_entity not present (DB already migrated past 2.0.0 to the Task system); "
              + "skipping glossary approval FQN repair");
      return;
    }
    Map<String, String> staleToCurrentLink = collectStaleApprovalLinks(handle, isPostgres);
    int threadRows = 0;
    int repointed = 0;
    if (staleToCurrentLink.isEmpty()) {
      LOG.info("[1.12.12] No stale glossary RequestApproval tasks to repair");
    } else {
      String varPath = "variables." + RELATED_ENTITY_KEY;
      threadRows = batchRewrite(handle, isPostgres, "thread_entity", "about", staleToCurrentLink);
      batchRewrite(
          handle, isPostgres, "workflow_instance_time_series", varPath, staleToCurrentLink);
      repointed = repointRunningInstances(staleToCurrentLink);
    }
    int idBackfilled = backfillMissingRelatedEntityIds();
    if (staleToCurrentLink.isEmpty()) {
      LOG.info(
          "[1.12.12] Backfilled relatedEntityId on {} running workflow instance(s)", idBackfilled);
      return;
    }
    LOG.info(
        "[1.12.12] Repaired {} stale glossary RequestApproval task(s) ({} thread row(s)); repointed {} running instance(s); backfilled relatedEntityId on {} running instance(s)",
        staleToCurrentLink.size(),
        threadRows,
        repointed,
        idBackfilled);
  }

  /**
   * {@code staleAboutLink -> currentAboutLink} for every open glossary {@code RequestApproval} task
   * whose stored {@code about} FQN no longer matches the term's current FQN (resolved by the stable
   * {@code entityId}). Unresolvable/hard-deleted terms are skipped.
   */
  private static Map<String, String> collectStaleApprovalLinks(Handle handle, boolean isPostgres) {
    Map<String, String> result = new LinkedHashMap<>();
    for (Map<String, Object> row : queryApprovalThreads(handle, isPostgres)) {
      addStaleLinkIfMoved(result, asString(row.get("entityid")), asString(row.get("about")));
    }
    return result;
  }

  private static void addStaleLinkIfMoved(
      Map<String, String> result, String entityId, String oldLink) {
    if (nullOrEmpty(entityId) || nullOrEmpty(oldLink)) {
      return;
    }
    try {
      EntityInterface term =
          Entity.getEntity(GLOSSARY_TERM_TYPE, UUID.fromString(entityId), "", Include.NON_DELETED);
      String newLink =
          new EntityLink(GLOSSARY_TERM_TYPE, term.getFullyQualifiedName()).getLinkString();
      if (!oldLink.equals(newLink)) {
        result.put(oldLink, newLink);
      }
    } catch (Exception e) {
      LOG.warn(
          "[1.12.12] Could not resolve term {} for approval-task repair; skipping", entityId, e);
    }
  }

  /**
   * Every glossary {@code RequestApproval} task thread — open AND closed. Closed/successful runs
   * (terms approved then moved) have no running Flowable instance and no open task, but their closed
   * thread still carries the stable {@code entityRef.id} (the thread JSON has no top-level
   * {@code entityId}), so they are discovered and their stale time-series rows get repaired for the
   * workflow history card.
   */
  private static List<Map<String, Object>> queryApprovalThreads(Handle handle, boolean isPostgres) {
    String sql =
        isPostgres
            ? "SELECT json->'entityRef'->>'id' AS entityid, json->>'about' AS about "
                + "FROM thread_entity "
                + "WHERE json->>'type' = 'Task' AND json->'task'->>'type' = :taskType "
                + "AND json->>'about' LIKE :glossaryPrefix"
            : "SELECT JSON_UNQUOTE(JSON_EXTRACT(json,'$.entityRef.id')) AS entityid, "
                + "JSON_UNQUOTE(JSON_EXTRACT(json,'$.about')) AS about FROM thread_entity "
                + "WHERE JSON_UNQUOTE(JSON_EXTRACT(json,'$.type')) = 'Task' "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json,'$.task.type')) = :taskType "
                + "AND JSON_UNQUOTE(JSON_EXTRACT(json,'$.about')) LIKE :glossaryPrefix";
    return handle
        .createQuery(sql)
        .bind("taskType", REQUEST_APPROVAL_TASK)
        .bind("glossaryPrefix", "<#E::" + GLOSSARY_TERM_TYPE + "::%")
        .mapToMap()
        .list();
  }

  /**
   * Batch-rewrite the dot-pathed JSON string field {@code oldLink -> newLink} for every stale link
   * in a single prepared batch (one round-trip), instead of a statement per link. {@code dotPath} is
   * e.g. {@code about} or {@code variables.global_relatedEntity}. Connection-aware
   * ({@code jsonb_set} vs {@code JSON_SET}); the path is a fixed constant (no user input), so it is
   * safe to inline. Best-effort: a batch failure on one table is logged and does not abort the
   * others or the upgrade. Returns the total number of rows updated.
   */
  private static int batchRewrite(
      Handle handle, boolean isPostgres, String table, String dotPath, Map<String, String> links) {
    String sql = buildRewriteSql(isPostgres, table, dotPath);
    int updated = 0;
    try {
      PreparedBatch batch = handle.prepareBatch(sql);
      links.forEach(
          (oldLink, newLink) -> batch.bind("newLink", newLink).bind("oldLink", oldLink).add());
      for (int count : batch.execute()) {
        updated += count;
      }
    } catch (Exception e) {
      LOG.warn("[1.12.12] Batch repair failed for {}; continuing", table, e);
    }
    return updated;
  }

  private static String buildRewriteSql(boolean isPostgres, String table, String dotPath) {
    String pgPath = "{" + dotPath.replace('.', ',') + "}";
    return isPostgres
        ? "UPDATE "
            + table
            + " SET json = jsonb_set(json, '"
            + pgPath
            + "', to_jsonb(:newLink::text)) WHERE json #>> '"
            + pgPath
            + "' = :oldLink"
        : "UPDATE "
            + table
            + " SET json = JSON_SET(json, '$."
            + dotPath
            + "', :newLink) WHERE JSON_UNQUOTE(JSON_EXTRACT(json, '$."
            + dotPath
            + "')) = :oldLink";
  }

  /**
   * Repoint the {@code relatedEntity} variable on running Flowable instances whose value is one of
   * the stale links. One-time and race-free — no concurrent approvals run during the migration.
   */
  private static int repointRunningInstances(Map<String, String> staleToCurrentLink) {
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    int repointed = 0;
    for (Map.Entry<String, Map<String, Object>> instance :
        workflowHandler.getRunningInstanceVariables().entrySet()) {
      Object current = instance.getValue().get(RELATED_ENTITY_KEY);
      if (current instanceof String link && staleToCurrentLink.containsKey(link)) {
        if (setProcessInstanceVariable(
            workflowHandler, instance.getKey(), RELATED_ENTITY_KEY, staleToCurrentLink.get(link))) {
          repointed++;
        }
      }
    }
    return repointed;
  }

  /**
   * Backfill immutable ids for old running workflow instances that still have only
   * {@code global_relatedEntity}. This protects instances that were current at upgrade time but get
   * moved later: workflow nodes can then resolve by id instead of falling back to the mutable FQN.
   */
  private static int backfillMissingRelatedEntityIds() {
    WorkflowHandler workflowHandler = WorkflowHandler.getInstance();
    int backfilled = 0;
    for (Map.Entry<String, Map<String, Object>> instance :
        workflowHandler.getRunningInstanceVariables().entrySet()) {
      Map<String, Object> variables = instance.getValue();
      if (variables.get(RELATED_ENTITY_ID_KEY) != null) {
        continue;
      }
      Object current = variables.get(RELATED_ENTITY_KEY);
      if (current instanceof String link) {
        UUID entityId = resolveEntityId(link);
        if (entityId != null) {
          if (setProcessInstanceVariable(
              workflowHandler, instance.getKey(), RELATED_ENTITY_ID_KEY, entityId.toString())) {
            backfilled++;
          }
        }
      }
    }
    return backfilled;
  }

  private static boolean setProcessInstanceVariable(
      WorkflowHandler workflowHandler, String instanceId, String variableName, Object value) {
    try {
      workflowHandler.setProcessInstanceVariable(instanceId, variableName, value);
      return true;
    } catch (Exception e) {
      LOG.warn(
          "[1.12.12] Could not set {} on running workflow instance {}; skipping",
          variableName,
          instanceId,
          e);
      return false;
    }
  }

  private static UUID resolveEntityId(String entityLink) {
    try {
      EntityLink parsed = EntityLink.parse(entityLink);
      EntityReference reference =
          Entity.getEntityReferenceByName(
              parsed.getEntityType(), parsed.getEntityFQN(), Include.NON_DELETED);
      return reference.getId();
    } catch (Exception e) {
      LOG.warn(
          "[1.12.12] Could not resolve relatedEntity {} for id backfill; skipping", entityLink, e);
      return null;
    }
  }

  /**
   * Whether {@code tableName} exists in the current schema. Used to no-op this repair on databases
   * already migrated past 2.0.0 (where {@code thread_entity} has been moved to the Task system),
   * while still running it on the target 1.12.x upgrade where the table is present.
   */
  private static boolean tableExists(Handle handle, boolean isPostgres, String tableName) {
    String schemaFn = isPostgres ? "current_schema()" : "DATABASE()";
    String sql =
        "SELECT COUNT(*) FROM information_schema.tables "
            + "WHERE table_schema = "
            + schemaFn
            + " AND table_name = :tableName";
    Integer count = handle.createQuery(sql).bind("tableName", tableName).mapTo(Integer.class).one();
    return count != null && count > 0;
  }

  private static String asString(Object value) {
    return value == null ? null : value.toString();
  }

  public static void removeBroadPiiContextKeywords(Handle handle) {
    PiiRecognizerMigrationUtil.removeBroadPiiContextKeywords(handle, "v11212");
  }
}
