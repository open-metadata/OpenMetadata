package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_BASIC;
import static org.openmetadata.service.security.DefaultAuthorizer.getSubjectContext;

import com.google.common.annotations.VisibleForTesting;
import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.AIContext;
import org.openmetadata.schema.type.Edge;
import org.openmetadata.schema.type.EntityLineage;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.aicontext.AIContextBuilder;
import org.openmetadata.service.aicontext.AIContextMarkdown;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.search.vector.OpenSearchVectorService;
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

  private static final String ENTITIES_PARAM = "entities";
  private static final char REFERENCE_SEPARATOR = ':';
  private static final int MAX_BATCH = 10;
  private static final String BAD_REFERENCE_MESSAGE =
      "Expected 'entityType:fqn', e.g. 'table:svc.db.schema.orders'";

  private static final String INCLUDE_PARAM = "include";
  private static final String INCLUDE_LINEAGE = "lineage";
  private static final String INCLUDE_QUALITY = "quality";
  private static final String INCLUDE_CONTEXT = "context";
  private static final String INCLUDE_CONTENT = "content";
  private static final String FORMAT_PARAM = "format";
  private static final String QUERY_PARAM = "query";
  private static final String PASSAGES_PARAM = "passages";
  private static final String CONTENT_KEY = "content";
  private static final String FORMAT_JSON = "json";
  private static final String FORMAT_MARKDOWN = "markdown";
  private static final int DEFAULT_PASSAGES = 3;
  private static final int MAX_PASSAGES = 10;
  private static final String TEST_SUITE_KEY = "testSuite";
  private static final String CERTIFICATION_KEY = "certification";

  /** Two hops. The second one is what tells a caller whether a lone neighbour starts a chain. */
  private static final int REACH_DEPTH = 2;

  private static final String COLUMN_OFFSET_PARAM = "columnOffset";
  private static final String COLUMN_LIMIT_PARAM = "columnLimit";
  private static final String TOTAL_COLUMNS_KEY = "totalColumns";
  private static final String RETURNED_COLUMNS_KEY = "returnedColumns";
  private static final String COLUMN_OFFSET_KEY = "columnOffset";
  private static final String COLUMNS_TRUNCATED_KEY = "columnsTruncated";
  private static final String HAS_MORE_COLUMNS_KEY = "hasMoreColumns";
  private static final String COLUMNS_MESSAGE_KEY = "columnsMessage";
  private static final String OVERSIZED_COLUMN_OFFSET_KEY = "oversizedColumnOffset";

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
   * Combined ceiling shared across {@code schemaDefinition}, {@code dataModel.sql} and {@code
   * dataModel.rawSql}. All three are entity-level, un-paginable text, so three independent {@link
   * #SCHEMA_SQL_MAX_LENGTH} caps could sum close to the {@link McpResponseTrim#MAX_RESPONSE_CHARS}
   * dispatch cap and still nuke the payload. A shared budget keeps their combined size bounded while
   * the common single-field case still gets the full per-field valve.
   */
  private static final int SCHEMA_SQL_COMBINED_MAX = 60_000;

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
    List<String> batch = McpParams.getStringList(params, ENTITIES_PARAM);
    Map<String, Object> result;
    if (batch.isEmpty()) {
      result =
          readOne(
              authorizer,
              securityContext,
              params,
              (String) params.get("entityType"),
              (String) params.get("fqn"));
    } else {
      result = readMany(authorizer, securityContext, params, batch);
    }
    return result;
  }

  /**
   * Reads up to {@link #MAX_BATCH} entities in one call instead of one call each.
   *
   * <p>Each entity resolves on its own, so an unknown type, a missing asset or a denied permission
   * returns an {@code error} entry for that entity rather than failing the whole call.
   */
  private Map<String, Object> readMany(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> params,
      List<String> batch) {
    List<Map<String, Object>> entities = new ArrayList<>();
    for (String reference : batch.subList(0, Math.min(batch.size(), MAX_BATCH))) {
      entities.add(readBatchEntry(authorizer, securityContext, params, reference));
    }
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("entities", entities);
    result.put("requested", batch.size());
    result.put("returned", entities.size());
    if (batch.size() > MAX_BATCH) {
      result.put(
          McpResponseTrim.MESSAGE_KEY,
          String.format(
              "%d entities requested, %d returned. Ask for at most %d per call.",
              batch.size(), entities.size(), MAX_BATCH));
    }
    return result;
  }

  /** One batch entry, with its own failure contained to itself. */
  private Map<String, Object> readBatchEntry(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> params,
      String reference) {
    Map<String, Object> entry;
    EntityRef parsed = parseReference(reference);
    if (parsed == null) {
      entry = batchError(reference, BAD_REFERENCE_MESSAGE);
    } else {
      try {
        entry = readOne(authorizer, securityContext, params, parsed.entityType(), parsed.fqn());
      } catch (Exception e) {
        LOG.warn("Batch read failed for {}: {}", reference, e.getMessage());
        entry = batchError(reference, McpResponseTrim.safeMessage(e));
      }
    }
    return entry;
  }

  record EntityRef(String entityType, String fqn) {}

  /**
   * Splits {@code entityType:fqn} on the first colon only, because an FQN can contain colons.
   * Returns null when unparseable, so the caller can report it per entity.
   */
  @VisibleForTesting
  static EntityRef parseReference(String reference) {
    EntityRef parsed = null;
    if (reference != null) {
      int separator = reference.indexOf(REFERENCE_SEPARATOR);
      boolean parseable = separator > 0 && separator < reference.length() - 1;
      if (parseable) {
        String type = reference.substring(0, separator).trim();
        String fqn = reference.substring(separator + 1).trim();
        if (!type.isEmpty() && !fqn.isEmpty()) {
          parsed = new EntityRef(type, fqn);
        }
      }
    }
    return parsed;
  }

  private static Map<String, Object> batchError(String reference, String message) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("requested", reference);
    entry.put(McpResponseTrim.ERROR_KEY, message);
    return entry;
  }

  private Map<String, Object> readOne(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> params,
      String entityType,
      String fqn) {
    List<String> includes =
        McpParams.getStringList(params, INCLUDE_PARAM).stream().distinct().toList();
    if (includes.size() == 1 && includes.contains(INCLUDE_CONTENT)) {
      return readContentOnly(authorizer, securityContext, params, entityType, fqn);
    }
    // Authorize by FQN so entity-scoped tag/owner/domain policies are evaluated, not just the
    // resource-type permission.
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_ALL),
        new ResourceContext<>(entityType, null, fqn));
    LOG.info("Getting details for entity type: {}, FQN: {}", entityType, fqn);
    int columnOffset =
        Math.max(0, McpParams.getInt(params, COLUMN_OFFSET_PARAM, DEFAULT_COLUMN_OFFSET));
    int columnLimit = McpParams.getInt(params, COLUMN_LIMIT_PARAM, NO_COLUMN_LIMIT);
    // Kept as the entity, not just its map: the content section needs the object, and reading it
    // a second time for that would be the same fetch twice in one request.
    EntityInterface entity = Entity.getEntityByName(entityType, fqn, "*", null);
    Map<String, Object> entityData = JsonUtils.getMap(entity);

    // Clean response to optimize LLM context usage, then bound the columns array so a wide entity
    // stays under the dispatch-level size cap instead of being replaced by an empty stub.
    Map<String, Object> cleaned = cleanEntityResponse(entityData);
    resolveCertification(cleaned);
    Map<String, Object> windowed = applyColumnWindow(cleaned, columnOffset, columnLimit);
    addIncludes(
        windowed,
        new IncludeContext(authorizer, securityContext, entityType, fqn, entity, options(params)),
        includes);
    return windowed;
  }

  private static Map<String, Object> readContentOnly(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      Map<String, Object> params,
      String entityType,
      String fqn) {
    IncludeContext authorizationContext =
        new IncludeContext(authorizer, securityContext, entityType, fqn, null, options(params));
    authorizeKnowledge(authorizationContext);
    EntityInterface entity = Entity.getEntityByName(entityType, fqn, "", Include.NON_DELETED);
    IncludeContext contentContext =
        new IncludeContext(
            authorizer, securityContext, entityType, fqn, entity, authorizationContext.options());
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("entityType", entityType);
    result.put("fullyQualifiedName", fqn);
    result.put(INCLUDE_CONTENT, knowledgeContent(contentContext));
    return result;
  }

  /**
   * Folds lineage and test health into this response, so the caller does not spend a call on each.
   * Both are cheap in-process reads.
   *
   * <p>Each section degrades on its own: if one fails, its slot carries a note and the entity read
   * still succeeds.
   */
  /**
   * What an include section needs to fetch and authorize its own data. Each section reaches a
   * different entity than {@link #readOne} authorized - lineage the neighbours, quality the test
   * suite - so each carries the caller's identity.
   */
  private record IncludeContext(
      Authorizer authorizer,
      CatalogSecurityContext securityContext,
      String entityType,
      String fqn,
      EntityInterface entity,
      ContentOptions options) {}

  /** How the knowledge sections render, shared by {@code context} and {@code content}. */
  private record ContentOptions(String query, String format, int passages) {
    boolean asJson() {
      return FORMAT_JSON.equalsIgnoreCase(format);
    }
  }

  private static ContentOptions options(Map<String, Object> params) {
    int requested = McpParams.getInt(params, PASSAGES_PARAM, DEFAULT_PASSAGES);
    return new ContentOptions(
        CommonUtils.optString(params, QUERY_PARAM),
        McpParams.getString(params, FORMAT_PARAM, FORMAT_MARKDOWN),
        Math.min(Math.max(requested, 1), MAX_PASSAGES));
  }

  private static void addIncludes(
      Map<String, Object> result, IncludeContext ctx, List<String> include) {
    if (nullOrEmpty(include)) {
      return;
    }
    if (include.contains(INCLUDE_LINEAGE)) {
      result.put(INCLUDE_LINEAGE, section(() -> neighbours(ctx), INCLUDE_LINEAGE, ctx.fqn()));
    }
    if (include.contains(INCLUDE_QUALITY)) {
      result.put(INCLUDE_QUALITY, section(() -> quality(result, ctx), INCLUDE_QUALITY, ctx.fqn()));
    }
    if (include.contains(INCLUDE_CONTEXT)) {
      result.put(INCLUDE_CONTEXT, section(() -> assetContext(ctx), INCLUDE_CONTEXT, ctx.fqn()));
    }
    if (include.contains(INCLUDE_CONTENT)) {
      result.put(INCLUDE_CONTENT, section(() -> knowledge(ctx), INCLUDE_CONTENT, ctx.fqn()));
    }
  }

  /**
   * The asset's Context Profile - attached business knowledge plus the type-specific structural
   * context (for a table: keys, frequent joins, partitions). Was {@code get_asset_context}, which
   * took the same {@code entityType} and {@code fqn} this tool already has and read them again.
   *
   * <p>Authorized against this specific asset rather than its type, so per-entity policies apply -
   * the same check the standalone tool made.
   */
  private static Object assetContext(IncludeContext ctx) {
    ctx.authorizer()
        .authorize(
            ctx.securityContext(),
            new OperationContext(ctx.entityType(), VIEW_ALL),
            new ResourceContext<>(ctx.entityType(), null, ctx.fqn()));
    AIContext context =
        new AIContextBuilder(ctx.entityType(), ctx.fqn())
            .withQuery(ctx.options().query())
            .withSecurity(ctx.authorizer(), ctx.securityContext())
            .build();
    return ctx.options().asJson()
        ? JsonUtils.getMap(context)
        : Map.of(FORMAT_PARAM, FORMAT_MARKDOWN, CONTENT_KEY, AIContextMarkdown.render(context));
  }

  /**
   * The body of a knowledge item - a whole article, or with a {@code query} only the passages that
   * answer it, using the per-chunk embeddings. Was {@code get_knowledge_content}.
   *
   * <p>VIEW_BASIC, not VIEW_ALL: that is what the standalone tool required, and folding it in must
   * not quietly raise the bar for reading an article a caller could read yesterday.
   */
  private static Object knowledge(IncludeContext ctx) {
    authorizeKnowledge(ctx);
    return knowledgeContent(ctx);
  }

  private static void authorizeKnowledge(IncludeContext ctx) {
    ctx.authorizer()
        .authorize(
            ctx.securityContext(),
            new OperationContext(ctx.entityType(), VIEW_BASIC),
            new ResourceContext<>(ctx.entityType(), null, ctx.fqn()));
  }

  private static Object knowledgeContent(IncludeContext ctx) {
    String query = ctx.options().query();
    Object rendered;
    if (query != null && !query.isBlank() && vectorSearchEnabled()) {
      rendered = passages(ctx, query);
    } else {
      String body = AIContextBuilder.fullContentOf(ctx.entity());
      rendered = renderText(ctx, body == null ? "" : body);
    }
    return rendered;
  }

  private static Object passages(IncludeContext ctx, String query) {
    List<String> found =
        OpenSearchVectorService.getInstance()
            .searchChunksByParent(ctx.entity().getId().toString(), query, ctx.options().passages());
    return ctx.options().asJson()
        ? Map.of("passages", found)
        : renderText(ctx, String.join("\n\n---\n\n", found));
  }

  private static Object renderText(IncludeContext ctx, String text) {
    return ctx.options().asJson()
        ? Map.of(CONTENT_KEY, text)
        : Map.of(FORMAT_PARAM, FORMAT_MARKDOWN, CONTENT_KEY, text);
  }

  private static boolean vectorSearchEnabled() {
    return Entity.getSearchRepository().isVectorEmbeddingEnabled()
        && OpenSearchVectorService.getInstance() != null;
  }

  /** Runs one include section, converting a failure into a note instead of losing the whole read. */
  private static Object section(Supplier<Object> supplier, String name, String fqn) {
    Object value;
    try {
      value = supplier.get();
    } catch (Exception e) {
      LOG.warn("include={} failed for {}: {}", name, fqn, e.getMessage());
      value = Map.of("unavailable", McpResponseTrim.safeMessage(e));
    }
    return value;
  }

  /**
   * Immediate neighbours, plus whether the graph continues past them. {@code get_entity_lineage} is
   * still the tool for depth and edge detail.
   *
   * <p>Reads two hops once and decides "is there more" from which edges touch the root. Probing
   * each neighbour instead means looking it up under the root's entity type, which fails whenever a
   * neighbour is a different type - a table feeding a dashboard, say.
   */
  private static Map<String, Object> neighbours(IncludeContext ctx) {
    // The subject context applies the caller's domain restrictions
    // (LineageRepository.pruneLineageByDomain). Without it they see neighbours they cannot access.
    EntityLineage lineage =
        Entity.getLineageRepository()
            .getByName(
                ctx.entityType(),
                ctx.fqn(),
                REACH_DEPTH,
                REACH_DEPTH,
                getSubjectContext(ctx.securityContext()));
    UUID root = rootId(lineage, ctx.fqn());
    Map<UUID, EntityReference> index = indexNodes(lineage);
    Map<String, Object> summary = new LinkedHashMap<>();
    addDirection(summary, root, index, lineage.getUpstreamEdges(), true);
    addDirection(summary, root, index, lineage.getDownstreamEdges(), false);
    summary.put("note", reachNote(continuesAnywhere(summary)));
    return summary;
  }

  /** Neighbours whose edge touches the root, and whether any edge in that direction does not. */
  @VisibleForTesting
  static void addDirection(
      Map<String, Object> summary,
      UUID root,
      Map<UUID, EntityReference> index,
      List<Edge> edges,
      boolean upstream) {
    List<String> immediate = new ArrayList<>();
    boolean continues = false;
    for (Edge edge : nullOrEmpty(edges) ? List.<Edge>of() : edges) {
      UUID near = upstream ? edge.getToEntity() : edge.getFromEntity();
      UUID far = upstream ? edge.getFromEntity() : edge.getToEntity();
      if (root.equals(near)) {
        addEndpoint(immediate, index, far);
      } else {
        continues = true;
      }
    }
    summary.put(upstream ? "upstream" : "downstream", immediate);
    summary.put(upstream ? "hasMoreUpstream" : "hasMoreDownstream", continues);
  }

  private static boolean continuesAnywhere(Map<String, Object> summary) {
    return Boolean.TRUE.equals(summary.get("hasMoreUpstream"))
        || Boolean.TRUE.equals(summary.get("hasMoreDownstream"));
  }

  /**
   * The entity's own id, which every reach decision is measured against. Throwing when it is absent
   * lets {@link #section} report it, rather than guessing the flags.
   */
  private static UUID rootId(EntityLineage lineage, String fqn) {
    EntityReference entity = lineage.getEntity();
    if (entity == null || entity.getId() == null) {
      throw new IllegalStateException("Lineage for '" + fqn + "' carries no root entity");
    }
    return entity.getId();
  }

  private static Map<UUID, EntityReference> indexNodes(EntityLineage lineage) {
    Map<UUID, EntityReference> index = new HashMap<>();
    if (!nullOrEmpty(lineage.getNodes())) {
      lineage.getNodes().forEach(node -> index.put(node.getId(), node));
    }
    return index;
  }

  /**
   * Says whether the graph continues past the immediate neighbours. Without it a single upstream is
   * ambiguous between "that is everything" and "that is the first of several hops".
   */
  private static String reachNote(boolean continues) {
    return continues
        ? "Immediate neighbours only, and the graph continues beyond them. Use get_entity_lineage"
            + " for the full depth."
        : "Immediate neighbours only - and this is the complete graph; nothing lies beyond these."
            + " A further get_entity_lineage call would add only edge detail.";
  }

  private static void addEndpoint(List<String> names, Map<UUID, EntityReference> index, UUID id) {
    EntityReference ref = index.get(id);
    if (ref != null
        && ref.getFullyQualifiedName() != null
        && !names.contains(ref.getFullyQualifiedName())) {
      names.add(ref.getFullyQualifiedName());
    }
  }

  /**
   * Test health for the entity's suite. The entity carries the suite reference but not its
   * pass/fail counts, so answering "are the tests passing?" otherwise costs another call.
   */
  private static Object quality(Map<String, Object> entity, IncludeContext ctx) {
    Object suiteRef = entity.get(TEST_SUITE_KEY);
    Object result = Map.of("note", "No test suite is attached to this entity.");
    if (suiteRef instanceof Map<?, ?> ref && ref.get("fullyQualifiedName") != null) {
      String suiteFqn = ref.get("fullyQualifiedName").toString();
      // A test suite is its own entity with its own policies, so being able to see the table it is
      // attached to does not imply the right to read it.
      ctx.authorizer()
          .authorize(
              ctx.securityContext(),
              new OperationContext(Entity.TEST_SUITE, VIEW_ALL),
              new ResourceContext<>(Entity.TEST_SUITE, null, suiteFqn));
      Map<String, Object> suite =
          JsonUtils.getMap(
              Entity.getEntityByName(Entity.TEST_SUITE, suiteFqn, "*", Include.NON_DELETED));
      Map<String, Object> health = new LinkedHashMap<>();
      health.put("testSuite", suiteFqn);
      health.put("summary", withNeverRun(suite.get("summary")));
      // columnTestSummary counts tests per column but does not name them. The suite already has
      // per-test names and statuses, so pass those through instead of forcing another call.
      Object perTest = suite.get("testCaseResultSummary");
      if (perTest instanceof List<?> list && !list.isEmpty()) {
        health.put("tests", list);
      }
      result = health;
    }
    return result;
  }

  /**
   * Resolves certification expiry here too, not only in search hits. This tool used to return
   * {@code expiryDate} as epoch millis next to {@code state: "Confirmed"}, so a lapsed badge read as
   * a live one unless the caller converted the timestamp by hand.
   */
  private static void resolveCertification(Map<String, Object> entity) {
    Object certification = entity.get(CERTIFICATION_KEY);
    if (certification != null) {
      entity.put(
          CERTIFICATION_KEY,
          McpResponseTrim.slimCertification(certification, System.currentTimeMillis()));
    }
  }

  /**
   * Adds the bucket the raw summary cannot express: tests that exist but have never run.
   *
   * <p>The summary counts success/failed/aborted/queued against a total. When nothing has run, every
   * bucket is zero while total is 13 - which reads as "13 tests, no failures, healthy" and is the
   * opposite of the truth.
   */
  @VisibleForTesting
  static Object withNeverRun(Object rawSummary) {
    Object result = rawSummary;
    if (rawSummary instanceof Map<?, ?> summary) {
      Map<String, Object> annotated = new LinkedHashMap<>();
      summary.forEach((key, value) -> annotated.put(String.valueOf(key), value));
      // Queued does not count as executed: a queued test has produced no verdict, so counting it
      // would let a suite that is only waiting to run report neverRun: 0. This also matches
      // AIContextMarkdown.appendCoverageVerdict, so both tools give the same verdict.
      int executed =
          intOf(annotated.get("success"))
              + intOf(annotated.get("failed"))
              + intOf(annotated.get("aborted"));
      int neverRun = Math.max(0, intOf(annotated.get("total")) - executed);
      annotated.put("neverRun", neverRun);
      if (neverRun > 0 && executed == 0) {
        annotated.put(
            McpResponseTrim.MESSAGE_KEY,
            "No test has ever executed on this suite. Zero failures here means unverified, not"
                + " healthy.");
      }
      result = annotated;
    }
    return result;
  }

  private static int intOf(Object value) {
    return value instanceof Number number ? number.intValue() : 0;
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
    int overhead = overheadChars(cleaned);
    int end = fitToBudget(overhead, columns, start, requestedEnd);
    boolean forcedOversized = end - start == 1 && columnExceedsBudget(overhead, columns.get(start));
    cleaned.put(COLUMNS_KEY, new ArrayList<>(columns.subList(start, end)));
    annotateWindow(cleaned, total, start, end, forcedOversized);
    return cleaned;
  }

  /**
   * True when a single column plus the entity overhead does not fit the column budget. Used to flag
   * the force-advanced page: the column is still returned in full (content is never cut), but the
   * caller is warned that it may trip the dispatch-level cap so an agent knows to skip past it. The
   * durable fix for genuinely un-representable columns is index-backed sub-column paging.
   */
  private static boolean columnExceedsBudget(int overhead, Object column) {
    long available = (long) (McpResponseTrim.MAX_RESPONSE_CHARS * COLUMN_BUDGET_FACTOR) - overhead;
    return McpResponseTrim.serializedLength(column) + 1 > available;
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

  private static void annotateWindow(
      Map<String, Object> cleaned, int total, int start, int end, boolean forcedOversized) {
    boolean windowed = start > 0 || end < total || forcedOversized;
    if (windowed) {
      int returned = end - start;
      boolean hasMore = end < total && returned > 0;
      cleaned.put(TOTAL_COLUMNS_KEY, total);
      cleaned.put(RETURNED_COLUMNS_KEY, returned);
      cleaned.put(COLUMN_OFFSET_KEY, start);
      cleaned.put(COLUMNS_TRUNCATED_KEY, Boolean.TRUE);
      cleaned.put(HAS_MORE_COLUMNS_KEY, hasMore);
      cleaned.put(
          COLUMNS_MESSAGE_KEY,
          columnsMessage(total, start, returned, end, hasMore, forcedOversized));
      if (forcedOversized) {
        cleaned.put(OVERSIZED_COLUMN_OFFSET_KEY, start);
      }
    }
  }

  /**
   * Human/LLM-readable window summary. Uses the {@code returnedColumns}/{@code columnOffset} counts
   * rather than an inclusive-vs-exclusive index range so it cannot be misread, and only advertises a
   * next page when one is actually reachable. When a single over-budget column was force-emitted to
   * keep paging moving, warns that the response may hit the size limit and how to skip past it.
   */
  private static String columnsMessage(
      int total, int start, int returned, int end, boolean hasMore, boolean forcedOversized) {
    String message =
        String.format(
            "Returning %d of %d columns starting at columnOffset %d.", returned, total, start);
    if (forcedOversized) {
      message +=
          String.format(
              " The column at columnOffset %d is very large and may exceed the response size limit;"
                  + " if this response was replaced by a size-limit notice, skip it with"
                  + " columnOffset=%d.",
              start, end);
    }
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
      trimEntityText(cleaned);
    }
    return cleaned;
  }

  /**
   * Applies the anti-nuke safety valve to the entity-level DDL and dbt model SQL under a single
   * shared budget. schemaDefinition is trimmed first, then dataModel.sql/rawSql draw from whatever
   * budget remains, so the three fields combined can never approach the dispatch cap.
   */
  private static void trimEntityText(Map<String, Object> entity) {
    int remaining = trimSchemaDefinition(entity, SCHEMA_SQL_COMBINED_MAX);
    trimDataModelSql(entity, remaining);
  }

  private static int trimSchemaDefinition(Map<String, Object> entity, int budget) {
    int cap = Math.min(SCHEMA_SQL_MAX_LENGTH, budget);
    int used = 0;
    if (entity.get(SCHEMA_DEFINITION_KEY) instanceof String ddl) {
      used = Math.min(ddl.length(), cap);
      if (ddl.length() > cap) {
        entity.put(SCHEMA_DEFINITION_KEY, McpResponseTrim.truncate(ddl, cap));
        entity.put(SCHEMA_DEFINITION_TRUNCATED_KEY, Boolean.TRUE);
      }
    }
    return budget - used;
  }

  private static void trimDataModelSql(Map<String, Object> entity, int budget) {
    if (entity.get(DATA_MODEL_KEY) instanceof Map) {
      Map<String, Object> dataModel = castMap(entity.get(DATA_MODEL_KEY));
      int remaining = trimSqlField(dataModel, SQL_KEY, budget);
      trimSqlField(dataModel, RAW_SQL_KEY, remaining);
    }
  }

  private static int trimSqlField(Map<String, Object> dataModel, String key, int budget) {
    int cap = Math.min(SCHEMA_SQL_MAX_LENGTH, budget);
    int used = 0;
    if (dataModel.get(key) instanceof String sql) {
      used = Math.min(sql.length(), cap);
      if (sql.length() > cap) {
        dataModel.put(key, McpResponseTrim.truncate(sql, cap));
        dataModel.put(SQL_TRUNCATED_KEY, Boolean.TRUE);
      }
    }
    return budget - used;
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
