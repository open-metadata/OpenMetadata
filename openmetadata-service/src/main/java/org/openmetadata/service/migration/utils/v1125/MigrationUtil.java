package org.openmetadata.service.migration.utils.v1125;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.sql.Timestamp;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.Handle;
import org.jdbi.v3.core.statement.PreparedBatch;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.FullyQualifiedName;

@Slf4j
public class MigrationUtil {

  private MigrationUtil() {}

  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ADMIN_USER_NAME = "admin";

  public static void migrateWorkflowDefinitions() {
    LOG.info(
        "Starting v1125 migration: converting include fields from map to array format in workflow trigger configurations");

    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);

    List<WorkflowDefinition> allWorkflows =
        repository.listAll(EntityUtil.Fields.EMPTY_FIELDS, new ListFilter());

    int needsMigration = 0;
    int totalUpdated = 0;
    for (WorkflowDefinition workflow : allWorkflows) {
      try {
        String originalJson = JsonUtils.pojoToJson(workflow);
        JsonNode originalNode = MAPPER.readTree(originalJson);

        JsonNode migrated = migrateIncludeFields(originalNode);

        if (migrated != originalNode) {
          needsMigration++;
          WorkflowDefinition updated =
              JsonUtils.readValue(MAPPER.writeValueAsString(migrated), WorkflowDefinition.class);
          repository.createOrUpdate(null, updated, ADMIN_USER_NAME);
          totalUpdated++;
          LOG.debug("Migrated workflow definition: {}", workflow.getFullyQualifiedName());
        }
      } catch (Exception e) {
        LOG.error(
            "Error migrating workflow definition '{}': {}",
            workflow.getFullyQualifiedName(),
            e.getMessage(),
            e);
      }
    }

    LOG.info(
        "Completed v1125 migration: {} of {} workflow definitions updated with array-based include fields",
        totalUpdated,
        allWorkflows.size());

    if (needsMigration > 0 && totalUpdated == 0) {
      throw new RuntimeException(
          "v1125 migration: failed to update any workflow definitions out of "
              + needsMigration
              + " that needed migration");
    }
  }

  /**
   * Recursively walks the workflow JSON and adds "include": [] to any trigger config
   * that is eventBasedEntity type and doesn't already have an include field.
   */
  private static JsonNode migrateIncludeFields(JsonNode node) {
    if (node == null || node.isNull()) {
      return node;
    }

    if (node.isObject()) {
      ObjectNode obj = (ObjectNode) node;

      if (needsIncludeFieldMigration(obj)) {
        return addIncludeField(obj);
      }

      boolean changed = false;
      ObjectNode result = MAPPER.createObjectNode();

      for (java.util.Iterator<java.util.Map.Entry<String, JsonNode>> it = obj.fields();
          it.hasNext(); ) {
        java.util.Map.Entry<String, JsonNode> entry = it.next();
        JsonNode migratedChild = migrateIncludeFields(entry.getValue());
        result.set(entry.getKey(), migratedChild);
        if (migratedChild != entry.getValue()) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    if (node.isArray()) {
      boolean changed = false;
      ArrayNode result = MAPPER.createArrayNode();
      for (JsonNode element : node) {
        JsonNode migratedElement = migrateIncludeFields(element);
        result.add(migratedElement);
        if (migratedElement != element) {
          changed = true;
        }
      }
      return changed ? result : node;
    }

    return node;
  }

  private static boolean needsIncludeFieldMigration(ObjectNode obj) {
    JsonNode typeNode = obj.get("type");
    JsonNode configNode = obj.get("config");

    if (typeNode != null && "eventBasedEntity".equals(typeNode.asText()) && configNode != null) {
      JsonNode includeNode = configNode.get("include");
      if (includeNode == null) {
        return true;
      }
      return includeNode.isObject();
    }

    return false;
  }

  private static ObjectNode addIncludeField(ObjectNode triggerObj) {
    ObjectNode result = triggerObj.deepCopy();
    JsonNode configNode = result.get("config");

    if (configNode != null && configNode.isObject()) {
      ObjectNode configObj = (ObjectNode) configNode;
      JsonNode includeNode = configObj.get("include");

      if (includeNode == null) {
        configObj.set("include", MAPPER.createArrayNode());
      } else if (includeNode.isObject()) {
        ArrayNode includeArray = MAPPER.createArrayNode();
        includeNode.fieldNames().forEachRemaining(includeArray::add);
        configObj.set("include", includeArray);
      }
    }

    return result;
  }

  private static final int CERT_BATCH_SIZE = 500;
  private static final int CERT_SOURCE = TagLabel.TagSource.CLASSIFICATION.ordinal();
  private static final int CERT_LABEL_TYPE = TagLabel.LabelType.AUTOMATED.ordinal();
  private static final int CERT_STATE = TagLabel.State.CONFIRMED.ordinal();

  public static void migrateCertificationToTagUsage(Handle handle, ConnectionType connType) {
    String[] entityTables = {
      "table_entity",
      "dashboard_entity",
      "topic_entity",
      "pipeline_entity",
      "storage_container_entity",
      "search_index_entity",
      "ml_model_entity",
      "stored_procedure_entity",
      "dashboard_data_model_entity",
      "api_endpoint_entity",
      "api_collection_entity",
      "database_entity",
      "database_schema_entity",
      "data_product_entity",
      "domain_entity",
      "chart_entity",
      "metric_entity",
      "file_entity",
      "directory_entity",
      "spreadsheet_entity",
      "worksheet_entity",
      "llm_model_entity",
      "ai_application_entity"
    };

    int totalMigrated = 0;
    for (String table : entityTables) {
      try {
        int migrated = migrateCertificationForTable(handle, connType, table);
        totalMigrated += migrated;
        if (migrated > 0) {
          LOG.info("Migrated {} certification records from {}", migrated, table);
        }
      } catch (Exception e) {
        LOG.warn("Could not migrate certification for table '{}': {}", table, e.getMessage(), e);
      }
    }
    LOG.info("Total certification records migrated to tag_usage: {}", totalMigrated);
  }

  private static int migrateCertificationForTable(
      Handle handle, ConnectionType connType, String table) {
    int totalMigrated = 0;
    while (true) {
      int batchMigrated = migrateCertificationBatch(handle, connType, table);
      totalMigrated += batchMigrated;
      if (batchMigrated < CERT_BATCH_SIZE) {
        break;
      }
    }
    return totalMigrated;
  }

  private static int migrateCertificationBatch(
      Handle handle, ConnectionType connType, String table) {
    boolean isPostgres = connType == ConnectionType.POSTGRES;

    String selectSql =
        isPostgres
            ? String.format(
                "SELECT id, fqnHash, "
                    + "json::json -> 'certification' -> 'tagLabel' ->> 'tagFQN' AS tagFQN, "
                    + "json::json -> 'certification' ->> 'expiryDate' AS expiryDate, "
                    + "json::json -> 'certification' ->> 'appliedDate' AS appliedDate "
                    + "FROM %s WHERE json::jsonb ?? 'certification' "
                    + "AND json::json -> 'certification' -> 'tagLabel' ->> 'tagFQN' IS NOT NULL "
                    + "LIMIT %d",
                table, CERT_BATCH_SIZE)
            : String.format(
                "SELECT id, fqnHash, "
                    + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.tagLabel.tagFQN')) AS tagFQN, "
                    + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.expiryDate')) AS expiryDate, "
                    + "JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.appliedDate')) AS appliedDate "
                    + "FROM %s "
                    + "WHERE JSON_CONTAINS_PATH(json, 'one', '$.certification') = 1 "
                    + "AND JSON_UNQUOTE(JSON_EXTRACT(json, '$.certification.tagLabel.tagFQN')) IS NOT NULL "
                    + "LIMIT %d",
                table, CERT_BATCH_SIZE);

    List<Map<String, Object>> rows = handle.createQuery(selectSql).mapToMap().list();
    if (rows.isEmpty()) {
      return 0;
    }

    String insertSql =
        isPostgres
            ? "INSERT INTO tag_usage "
                + "(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, appliedBy, appliedAt, metadata) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, 'admin', :appliedAt, :metadata) "
                + "ON CONFLICT (source, tagFQNHash, targetFQNHash) DO NOTHING"
            : "INSERT IGNORE INTO tag_usage "
                + "(source, tagFQN, tagFQNHash, targetFQNHash, labelType, state, appliedBy, appliedAt, metadata) "
                + "VALUES (:source, :tagFQN, :tagFQNHash, :targetFQNHash, :labelType, :state, 'admin', :appliedAt, :metadata)";

    String updateSql =
        "UPDATE "
            + table
            + (isPostgres
                ? " SET json = (json::jsonb - 'certification')::json WHERE id IN (<ids>)"
                : " SET json = JSON_REMOVE(json, '$.certification') WHERE id IN (<ids>)");

    // Build selectedIds and INSERT batch together — only include rows with a valid tagFQN.
    // Rows with null tagFQN are skipped so the UPDATE won't strip their certification from JSON
    // without a corresponding tag_usage entry (which would be silent data loss).
    List<String> selectedIds = new ArrayList<>();
    PreparedBatch batch = handle.prepareBatch(insertSql);
    for (Map<String, Object> row : rows) {
      String tagFQN = (String) row.get("tagfqn");
      if (tagFQN == null) continue;
      selectedIds.add(row.get("id").toString());
      batch
          .bind("source", CERT_SOURCE)
          .bind("tagFQN", tagFQN)
          .bind("tagFQNHash", FullyQualifiedName.buildHash(tagFQN))
          .bind("targetFQNHash", row.get("fqnhash").toString())
          .bind("labelType", CERT_LABEL_TYPE)
          .bind("state", CERT_STATE)
          .bind("appliedAt", toTimestamp(row.get("applieddate")))
          .bind("metadata", buildCertMetadata(row.get("expirydate")))
          .add();
    }
    if (selectedIds.isEmpty()) {
      return 0;
    }
    batch.execute();
    handle.createUpdate(updateSql).bindList("ids", selectedIds).execute();

    return selectedIds.size();
  }

  private static Timestamp toTimestamp(Object epochMillisVal) {
    if (epochMillisVal == null) return null;
    try {
      long epochMillis =
          epochMillisVal instanceof Number num
              ? num.longValue()
              : Long.parseLong(epochMillisVal.toString());
      return new Timestamp(epochMillis);
    } catch (NumberFormatException e) {
      LOG.warn("toTimestamp: unparseable appliedDate value '{}', using null", epochMillisVal);
      return null;
    }
  }

  private static String buildCertMetadata(Object expiryDateVal) {
    ObjectNode node = MAPPER.createObjectNode();
    if (expiryDateVal != null) {
      if (expiryDateVal instanceof Long longVal) {
        node.put("expiryDate", longVal);
      } else if (expiryDateVal instanceof Number numberVal) {
        node.put("expiryDate", numberVal.longValue());
      } else {
        try {
          node.put("expiryDate", Long.parseLong(expiryDateVal.toString()));
        } catch (NumberFormatException e) {
          LOG.warn(
              "buildCertMetadata: unparseable expiryDate value '{}', storing null", expiryDateVal);
          node.putNull("expiryDate");
        }
      }
    } else {
      node.putNull("expiryDate");
    }
    return node.toString();
  }
}
