package org.openmetadata.service.migration.utils.v1133;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.triggers.Config;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;

@Slf4j
public class MigrationUtil {
  private static final String ADMIN_USER_NAME = "admin";
  private static final TypeReference<Map<String, String>> FILTER_MAP_TYPE =
      new TypeReference<>() {};

  private MigrationUtil() {}

  private static final int BATCH_SIZE = 500;

  private static final String SELECT_BATCH =
      "SELECT id, json FROM data_contract_entity ORDER BY id LIMIT :limit OFFSET :offset";

  private static final String MYSQL_INSERT =
      "INSERT IGNORE INTO entity_relationship "
          + "(fromId, toId, fromEntity, toEntity, relation, relationType, deleted) "
          + "VALUES (:fromId, :toId, 'testSuite', 'dataContract', 0, '', 0)";

  private static final String POSTGRES_INSERT =
      "INSERT INTO entity_relationship "
          + "(fromId, toId, fromEntity, toEntity, relation, relationType, deleted) "
          + "VALUES (:fromId, :toId, 'testSuite', 'dataContract', 0, '', false) "
          + "ON CONFLICT DO NOTHING";

  public static void backfillDataContractTestSuiteRelationships(
      Handle handle, ConnectionType type) {
    LOG.info(
        "v1133: backfilling testSuite -> dataContract relationships (batchSize={})", BATCH_SIZE);
    String insertSql = type == ConnectionType.MYSQL ? MYSQL_INSERT : POSTGRES_INSERT;
    int offset = 0;
    int totalScanned = 0;
    int totalInserted = 0;
    while (true) {
      int scannedInBatch;
      int insertedInBatch = 0;
      try {
        List<Map<String, Object>> rows =
            handle
                .createQuery(SELECT_BATCH)
                .bind("limit", BATCH_SIZE)
                .bind("offset", offset)
                .mapToMap()
                .list();
        scannedInBatch = rows.size();
        for (Map<String, Object> row : rows) {
          Object contractId = firstNonNull(row, "id", "ID");
          Object jsonBlob = firstNonNull(row, "json", "JSON");
          if (contractId == null || jsonBlob == null) {
            continue;
          }
          String testSuiteId = extractTestSuiteId(jsonBlob.toString());
          if (testSuiteId == null) {
            continue;
          }
          try {
            int rc =
                handle
                    .createUpdate(insertSql)
                    .bind("fromId", testSuiteId)
                    .bind("toId", contractId.toString())
                    .execute();
            insertedInBatch += rc;
          } catch (RuntimeException e) {
            // Any failure on a single row (JDBI UnableToExecuteStatementException, constraint,
            // driver quirk) is logged and skipped so the rest of the backfill still runs.
            LOG.warn(
                "v1133: failed to insert relationship testSuite={} -> dataContract={}: {}",
                testSuiteId,
                contractId,
                e.getMessage());
          }
        }
      } catch (RuntimeException e) {
        // Batch-level failure (e.g. SELECT throws): log and stop iterating so the same failing
        // offset does not loop forever. Migration.java's outer try/catch prevents the whole
        // migration from halting, so subsequent versions still run.
        LOG.error("v1133: batch at offset={} failed, aborting backfill loop", offset, e);
        break;
      }
      totalScanned += scannedInBatch;
      totalInserted += insertedInBatch;
      LOG.info(
          "v1133: batch offset={} scanned={} inserted={} (running totals scanned={} inserted={})",
          offset,
          scannedInBatch,
          insertedInBatch,
          totalScanned,
          totalInserted);
      if (scannedInBatch < BATCH_SIZE) {
        break;
      }
      offset += BATCH_SIZE;
    }
    LOG.info(
        "v1133: backfill complete, totalScanned={} totalInserted={}", totalScanned, totalInserted);
  }

  private static Object firstNonNull(Map<String, Object> row, String... keys) {
    Object hit = null;
    for (String k : keys) {
      Object v = row.get(k);
      if (v != null) {
        hit = v;
        break;
      }
    }
    return hit;
  }

  /**
   * Sanitize poisoned trigger filter values on every eventBasedEntity WorkflowDefinition.
   *
   * <p>Prior UI versions serialized incomplete filter trees (user picked a field but no
   * operator) as the JSON-encoded empty string {@code "\"\""}. The v1.10.5 migration then
   * copied that value into per-entity keys and an unused {@code default} key. Task Redesign
   * (2.0) dropped the {@code !} inversion in FilterEntityImpl, flipping the trigger filter
   * from exclusion to inclusion, so every poisoned row now silently skips its workflow.
   *
   * <p>This migration walks every workflowDefinition and drops any filter map entry
   * whose value is empty / whitespace / {@code "\"\""} / {@code "{}"} — including a
   * poisoned {@code default} key left behind by the v1.10.5 migration. A non-poisoned
   * {@code default} entry is preserved because {@code FilterEntityImpl.extractFromFilterMap}
   * still falls back to it. Complements the runtime sanitizer in
   * {@code FilterEntityImpl.sanitizeFilterValue}.
   */
  public static void sanitizePoisonedTriggerFilters() {
    LOG.info("v1133: scanning workflowDefinitions to sanitize poisoned trigger filters");
    int scanned = 0;
    int fixed = 0;
    try {
      WorkflowDefinitionRepository repository =
          (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
      List<WorkflowDefinition> workflowDefinitions =
          repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());
      for (WorkflowDefinition workflowDefinition : listOrEmpty(workflowDefinitions)) {
        scanned++;
        if (dropPoisonedFilterEntries(workflowDefinition)) {
          try {
            repository.createOrUpdate(null, workflowDefinition, ADMIN_USER_NAME);
            fixed++;
            LOG.info(
                "v1133: sanitized poisoned trigger filter on '{}'", workflowDefinition.getName());
          } catch (Exception e) {
            LOG.warn(
                "v1133: failed to persist sanitized filter for '{}': {}",
                workflowDefinition.getName(),
                e.getMessage());
          }
        }
      }
    } catch (Exception e) {
      LOG.error("v1133: failed to sanitize poisoned trigger filters", e);
    }
    LOG.info("v1133: trigger filter sanitizer scanned={} fixed={}", scanned, fixed);
  }

  private static boolean dropPoisonedFilterEntries(WorkflowDefinition workflowDefinition) {
    boolean modified = false;
    // WorkflowDefinition#getTrigger() returns the schema-generated TriggerDefinition base
    // (schema-first oneOf across eventBasedEntity / periodicBatchEntity / noOp); this migration
    // only touches eventBasedEntity, hence the pattern-match on the concrete subtype.
    if (workflowDefinition.getTrigger() instanceof EventBasedEntityTriggerDefinition eventTrigger) {
      Config config = eventTrigger.getConfig();
      if (config != null && config.getFilter() != null) {
        Map<String, String> filterMap = coerceToStringMap(config.getFilter());
        if (filterMap != null) {
          Map<String, String> cleaned = retainNonPoisonedEntries(filterMap);
          if (cleaned.size() != filterMap.size()) {
            config.setFilter(cleaned);
            modified = true;
          }
        }
      }
    }
    return modified;
  }

  private static Map<String, String> retainNonPoisonedEntries(Map<String, String> filterMap) {
    Map<String, String> cleaned = new HashMap<>();
    for (Map.Entry<String, String> entry : filterMap.entrySet()) {
      if (!isPoisonedFilterValue(entry.getValue())) {
        cleaned.put(entry.getKey(), entry.getValue());
      }
    }
    return cleaned;
  }

  // Config#getFilter() is generated as Object because the JSON Schema declares filter as a
  // "oneOf" of string (legacy top-level JsonLogic) and object (per-entity map). Rows written
  // before v1.10.5 still carry the string variant, so both shapes have to be handled here.
  private static Map<String, String> coerceToStringMap(Object filter) {
    Map<String, String> result = null;
    if (filter instanceof Map<?, ?> raw) {
      result = coerceMapEntries(raw);
    } else if (filter instanceof String filterStr && !filterStr.isBlank()) {
      result = parseFilterJson(filterStr);
    }
    return result;
  }

  private static Map<String, String> coerceMapEntries(Map<?, ?> raw) {
    Map<String, String> result = new HashMap<>();
    for (Map.Entry<?, ?> entry : raw.entrySet()) {
      if (entry.getKey() != null && entry.getValue() != null) {
        result.put(entry.getKey().toString(), entry.getValue().toString());
      }
    }
    return result;
  }

  private static Map<String, String> parseFilterJson(String filterStr) {
    Map<String, String> result = null;
    try {
      result = JsonUtils.readValue(filterStr, FILTER_MAP_TYPE);
    } catch (Exception ignored) {
      // Legacy string filter that isn't a JSON object → left for FilterEntityImpl to reject.
    }
    return result;
  }

  private static boolean isPoisonedFilterValue(String value) {
    boolean poisoned = true;
    if (value != null) {
      String trimmed = value.trim();
      poisoned = trimmed.isEmpty() || "\"\"".equals(trimmed) || "{}".equals(trimmed);
    }
    return poisoned;
  }

  private static String extractTestSuiteId(String contractJson) {
    String id = null;
    try {
      JsonNode node = JsonUtils.readTree(contractJson);
      if (node != null) {
        JsonNode testSuite = node.get("testSuite");
        if (testSuite != null) {
          JsonNode idNode = testSuite.get("id");
          if (idNode != null && !idNode.isNull()) {
            id = idNode.asText();
          }
        }
      }
    } catch (JsonParsingException e) {
      LOG.warn("v1133: failed to parse data_contract JSON: {}", e.getMessage());
    }
    return id;
  }
}
