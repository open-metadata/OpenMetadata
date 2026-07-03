package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
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

  private static final String COLUMNS_KEY = "columns";
  private static final String SCHEMA_DEFINITION_KEY = "schemaDefinition";
  private static final String DATA_MODEL_KEY = "dataModel";
  private static final String SQL_KEY = "sql";
  private static final String RAW_SQL_KEY = "rawSql";
  private static final String SCHEMA_DEFINITION_TRUNCATED_KEY = "schemaDefinitionTruncated";
  private static final String SQL_TRUNCATED_KEY = "sqlTruncated";

  private static final String COLUMN_OFFSET_PARAM = "columnOffset";
  private static final String COLUMN_LIMIT_PARAM = "columnLimit";
  private static final String TOTAL_COLUMNS_KEY = "totalColumns";
  private static final String RETURNED_COLUMNS_KEY = "returnedColumns";
  private static final String COLUMN_OFFSET_KEY = "columnOffset";
  private static final String COLUMNS_TRUNCATED_KEY = "columnsTruncated";
  private static final String HAS_MORE_COLUMNS_KEY = "hasMoreColumns";
  private static final String COLUMNS_MESSAGE_KEY = "columnsMessage";

  private static final int DEFAULT_COLUMN_OFFSET = 0;
  private static final int NO_COLUMN_LIMIT = -1;

  /**
   * Anti-OOM/anti-nuke safety valve for the entity-level DDL ({@code schemaDefinition}) and dbt model
   * {@code sql}/{@code rawSql}. These are single fields returned in full — this is the detail tool, so
   * their content is never truncated for context optimization. Unlike columns they cannot be
   * paginated, so a runaway value could push the response past the dispatch-level {@link
   * McpResponseTrim#MAX_RESPONSE_CHARS} cap and discard everything. The valve sits far above any
   * human-authored SQL or realistic DDL (~600-column tables) so real content is never cut; when it
   * does trip on machine-generated bloat the response flags it and stays retrievable.
   */
  private static final int SCHEMA_SQL_MAX_LENGTH = 30_000;

  /**
   * Fraction of {@link McpResponseTrim#MAX_RESPONSE_CHARS} the windowed columns may occupy. Leaves
   * headroom for the entity-level fields and the window markers so the assembled response lands
   * comfortably below the dispatch-level cap rather than right at it.
   */
  private static final double COLUMN_BUDGET_FACTOR = 0.8;

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
    int columnOffset =
        Math.max(0, McpParams.getInt(params, COLUMN_OFFSET_PARAM, DEFAULT_COLUMN_OFFSET));
    int columnLimit = McpParams.getInt(params, COLUMN_LIMIT_PARAM, NO_COLUMN_LIMIT);
    String fields = "*";
    Map<String, Object> entityData =
        JsonUtils.getMap(Entity.getEntityByName(entityType, fqn, fields, null));

    // Clean response to optimize LLM context usage, then bound the columns array so a wide entity
    // stays under the dispatch-level size cap instead of being replaced by an empty stub.
    Map<String, Object> cleaned = cleanEntityResponse(entityData);
    return applyColumnWindow(cleaned, columnOffset, columnLimit);
  }

  /**
   * Bounds the {@code columns} array so a wide entity (hundreds/thousands of columns) never blows the
   * {@link McpResponseTrim#MAX_RESPONSE_CHARS} cap that would otherwise discard the whole payload.
   * Entity-level fields are always left intact — only columns are windowed. A client-supplied {@code
   * columnLimit}/{@code columnOffset} pages deterministically (opt-in); with no limit, columns are
   * auto-capped to the size budget. Non-column entities (no {@code columns} array) pass through
   * unchanged, and a small response gains no markers so its shape is byte-identical to before.
   */
  @VisibleForTesting
  static Map<String, Object> applyColumnWindow(
      Map<String, Object> cleaned, int columnOffset, int columnLimit) {
    Map<String, Object> result = cleaned;
    if (cleaned.get(COLUMNS_KEY) instanceof List<?> columns && !columns.isEmpty()) {
      result = windowColumns(cleaned, columns, columnOffset, columnLimit);
    }
    return result;
  }

  private static Map<String, Object> windowColumns(
      Map<String, Object> cleaned, List<?> columns, int columnOffset, int columnLimit) {
    int total = columns.size();
    int start = Math.min(columnOffset, total);
    int requestedEnd = columnLimit >= 0 ? Math.min(start + columnLimit, total) : total;
    int end = fitToBudget(overheadChars(cleaned), columns, start, requestedEnd);
    cleaned.put(COLUMNS_KEY, new ArrayList<>(columns.subList(start, end)));
    annotateWindow(cleaned, total, start, end);
    return cleaned;
  }

  /** Serialized length of the response with the columns array excluded. */
  private static int overheadChars(Map<String, Object> cleaned) {
    Object savedColumns = cleaned.remove(COLUMNS_KEY);
    int length = McpResponseTrim.serializedLength(cleaned);
    cleaned.put(COLUMNS_KEY, savedColumns);
    return length;
  }

  /**
   * Returns the exclusive end index of the largest column window starting at {@code start} whose
   * serialized size stays within the column budget. When the entity-level overhead alone already
   * exceeds the budget nothing is added and the caller still gets full metadata (better than the
   * empty oversized stub). When the overhead leaves room but a single column at {@code start} is
   * itself larger than the budget, that one column is emitted anyway so a paging client always
   * advances by at least one column instead of re-requesting the same offset forever.
   */
  private static int fitToBudget(int overhead, List<?> columns, int start, int end) {
    long available = (long) (McpResponseTrim.MAX_RESPONSE_CHARS * COLUMN_BUDGET_FACTOR) - overhead;
    long used = 0;
    int fitEnd = start;
    for (int i = start; i < end && used <= available; i++) {
      used += McpResponseTrim.serializedLength(columns.get(i)) + 1;
      if (used <= available) {
        fitEnd = i + 1;
      }
    }
    boolean singleColumnOverflowsBudget = fitEnd == start && start < end && available > 0;
    if (singleColumnOverflowsBudget) {
      fitEnd = start + 1;
    }
    return fitEnd;
  }

  private static void annotateWindow(Map<String, Object> cleaned, int total, int start, int end) {
    boolean windowed = start > 0 || end < total;
    if (windowed) {
      int returned = end - start;
      boolean hasMore = end < total && returned > 0;
      cleaned.put(TOTAL_COLUMNS_KEY, total);
      cleaned.put(RETURNED_COLUMNS_KEY, returned);
      cleaned.put(COLUMN_OFFSET_KEY, start);
      cleaned.put(COLUMNS_TRUNCATED_KEY, Boolean.TRUE);
      cleaned.put(HAS_MORE_COLUMNS_KEY, hasMore);
      cleaned.put(COLUMNS_MESSAGE_KEY, columnsMessage(total, start, returned, end, hasMore));
    }
  }

  /**
   * Human/LLM-readable window summary. Uses the {@code returnedColumns}/{@code columnOffset} counts
   * rather than an inclusive-vs-exclusive index range so it cannot be misread, and only advertises a
   * next page when one is actually reachable.
   */
  private static String columnsMessage(
      int total, int start, int returned, int end, boolean hasMore) {
    String message =
        String.format(
            "Returning %d of %d columns starting at columnOffset %d.", returned, total, start);
    if (hasMore) {
      message += String.format(" Fetch the next page with columnOffset=%d.", end);
    }
    return message;
  }

  /**
   * Removes verbose index/noise fields and applies the anti-nuke safety valve to the entity-level
   * DDL and dbt model SQL. Column descriptions and the entity-level description are deliberately left
   * in full — this is the detail tool, and total response size is bounded by column windowing rather
   * than by mangling field content. The map tree comes from a fresh Jackson conversion ({@code
   * JsonUtils.getMap}), so in-place edits never touch the cached entity POJO.
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
    }
    return cleaned;
  }

  private static void trimSchemaDefinition(Map<String, Object> entity) {
    if (entity.get(SCHEMA_DEFINITION_KEY) instanceof String ddl
        && ddl.length() > SCHEMA_SQL_MAX_LENGTH) {
      entity.put(SCHEMA_DEFINITION_KEY, McpResponseTrim.truncate(ddl, SCHEMA_SQL_MAX_LENGTH));
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
    if (dataModel.get(key) instanceof String sql && sql.length() > SCHEMA_SQL_MAX_LENGTH) {
      dataModel.put(key, McpResponseTrim.truncate(sql, SCHEMA_SQL_MAX_LENGTH));
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
