package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class GetEntityTool implements McpTool {

  // Fields to exclude from response to optimize LLM context usage
  // These fields are typically verbose and not useful for LLM understanding
  private static final List<String> EXCLUDE_FIELDS =
      List.of(
          "version",
          "updatedAt",
          "updatedBy",
          "changeDescription",
          "incrementalChangeDescription",
          "followers",
          "votes",
          "totalVotes",
          "usageSummary",
          "lifeCycle",
          "sourceHash",
          "fqnParts",
          "fqnHash",
          "entityRelationship",
          "processedLineage",
          "upstreamLineage",
          "changeSummary",
          "tierSources",
          "tagSources",
          "descriptionSources",
          "columnDescriptionStatus",
          "descriptionStatus");

  private static final String DESCRIPTION_KEY = "description";
  private static final String COLUMNS_KEY = "columns";
  private static final String CHILDREN_KEY = "children";
  private static final String SCHEMA_DEFINITION_KEY = "schemaDefinition";
  private static final String DATA_MODEL_KEY = "dataModel";
  private static final String SQL_KEY = "sql";
  private static final String RAW_SQL_KEY = "rawSql";
  private static final String COLUMN_DESCRIPTIONS_TRUNCATED_KEY = "columnDescriptionsTruncated";
  private static final String SCHEMA_DEFINITION_TRUNCATED_KEY = "schemaDefinitionTruncated";
  private static final String SQL_TRUNCATED_KEY = "sqlTruncated";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String entityType = (String) params.get("entityType");
    String fqn = (String) params.get("fqn");
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_ALL),
        new ResourceContext<>(entityType));
    LOG.info("Getting details for entity type: {}, FQN: {}", entityType, fqn);
    String fields = "*";
    Map<String, Object> entityData =
        JsonUtils.getMap(Entity.getEntityByName(entityType, fqn, fields, null));

    // Clean response to optimize LLM context usage
    return cleanEntityResponse(entityData);
  }

  /**
   * Removes verbose fields and trims the wide-table multipliers (per-column descriptions, raw
   * schema/model SQL) so the detail response stays usable on entities with hundreds of columns.
   * The entity-level description is deliberately left untouched — this is the one tool whose
   * callers need the full text after search results truncated it. The map tree comes from a fresh
   * Jackson conversion ({@code JsonUtils.getMap}), so in-place edits never touch the cached entity
   * POJO.
   */
  @VisibleForTesting
  static Map<String, Object> cleanEntityResponse(Map<String, Object> entityData) {
    Map<String, Object> cleaned = new HashMap<>();
    if (entityData != null) {
      cleaned = new HashMap<>(entityData);
      EXCLUDE_FIELDS.forEach(cleaned::remove);
      McpResponseTrim.VECTOR_NOISE_FIELDS.forEach(cleaned::remove);
      trimSchemaDefinition(cleaned);
      trimDataModelSql(cleaned);
      if (trimColumnDescriptions(cleaned.get(COLUMNS_KEY))) {
        cleaned.put(COLUMN_DESCRIPTIONS_TRUNCATED_KEY, Boolean.TRUE);
      }
    }
    return cleaned;
  }

  /**
   * Truncates over-length column descriptions, recursing through {@code children} for nested
   * struct/map columns. Returns whether any description was cut so the caller can surface a single
   * top-level marker instead of per-column flag noise.
   */
  private static boolean trimColumnDescriptions(Object columnsValue) {
    boolean truncated = false;
    if (columnsValue instanceof List<?> columns) {
      for (Object column : columns) {
        if (column instanceof Map) {
          truncated |= trimColumn(castMap(column));
        }
      }
    }
    return truncated;
  }

  private static boolean trimColumn(Map<String, Object> column) {
    boolean truncated = false;
    if (column.get(DESCRIPTION_KEY) instanceof String description
        && description.length() > McpResponseTrim.TEXT_MAX_LENGTH) {
      column.put(
          DESCRIPTION_KEY, McpResponseTrim.truncate(description, McpResponseTrim.TEXT_MAX_LENGTH));
      truncated = true;
    }
    // Non-short-circuit | : children must be trimmed even when this column's description was cut.
    return truncated | trimColumnDescriptions(column.get(CHILDREN_KEY));
  }

  private static void trimSchemaDefinition(Map<String, Object> entity) {
    if (entity.get(SCHEMA_DEFINITION_KEY) instanceof String ddl
        && ddl.length() > McpResponseTrim.SQL_MAX_LENGTH) {
      entity.put(
          SCHEMA_DEFINITION_KEY, McpResponseTrim.truncate(ddl, McpResponseTrim.SQL_MAX_LENGTH));
      entity.put(SCHEMA_DEFINITION_TRUNCATED_KEY, Boolean.TRUE);
    }
  }

  private static void trimDataModelSql(Map<String, Object> entity) {
    if (entity.get(DATA_MODEL_KEY) instanceof Map) {
      Map<String, Object> dataModel = castMap(entity.get(DATA_MODEL_KEY));
      // Non-short-circuit | : both sql and rawSql must be trimmed regardless of the other.
      boolean truncated = trimSqlField(dataModel, SQL_KEY) | trimSqlField(dataModel, RAW_SQL_KEY);
      if (truncated) {
        dataModel.put(SQL_TRUNCATED_KEY, Boolean.TRUE);
      }
    }
  }

  private static boolean trimSqlField(Map<String, Object> dataModel, String key) {
    boolean truncated = false;
    if (dataModel.get(key) instanceof String sql && sql.length() > McpResponseTrim.SQL_MAX_LENGTH) {
      dataModel.put(key, McpResponseTrim.truncate(sql, McpResponseTrim.SQL_MAX_LENGTH));
      truncated = true;
    }
    return truncated;
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Object> castMap(Object value) {
    return (Map<String, Object>) value;
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException("GetEntityTool does not requires limit validation.");
  }
}
