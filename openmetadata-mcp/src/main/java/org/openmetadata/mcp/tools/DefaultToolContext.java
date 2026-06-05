package org.openmetadata.mcp.tools;

import static org.openmetadata.mcp.McpUtils.getToolProperties;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.Collections;
import java.util.IdentityHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Predicate;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.app.mcp.McpToolCallUsage;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.AuthorizationException;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class DefaultToolContext {
  private static final int STATUS_BAD_REQUEST = 400;
  private static final int STATUS_FORBIDDEN = 403;
  private static final int STATUS_NOT_FOUND = 404;
  private static final int STATUS_TOO_MANY_REQUESTS = 429;
  private static final int STATUS_INTERNAL_ERROR = 500;
  private static final int STATUS_GATEWAY_TIMEOUT = 504;
  private static final String OVERSIZED_ADVICE =
      "Response exceeded the size limit and was withheld. Narrow your request — use a more specific "
          + "query, request fewer results, or fetch a single entity by its fullyQualifiedName.";

  public DefaultToolContext() {}

  /**
   * Loads tool definitions from a JSON file located at the specified path.
   * The JSON file should contain an array of tool definitions under the "tools" key.
   *
   * @return List of McpSchema.Tool objects loaded from the JSON file.
   */
  public List<McpSchema.Tool> loadToolsDefinitionsFromJson(String toolFilePath) {
    return getToolProperties(toolFilePath);
  }

  public McpSchema.CallToolResult callTool(
      Authorizer authorizer,
      Limits limits,
      String toolName,
      CatalogSecurityContext securityContext,
      McpSchema.CallToolRequest request) {
    return callToolWithMetadata(authorizer, limits, toolName, securityContext, request).result();
  }

  /**
   * Phase 3 entry point. Returns the tool result alongside the metadata the {@link
   * org.openmetadata.mcp.usage.McpUsageRecorder} needs (latency + error category). Kept as a
   * separate method so the legacy single-result signature stays available for external callers
   * that haven't migrated yet.
   */
  public CallToolOutcome callToolWithMetadata(
      Authorizer authorizer,
      Limits limits,
      String toolName,
      CatalogSecurityContext securityContext,
      McpSchema.CallToolRequest request) {
    long startNanos = System.nanoTime();
    LOG.info(
        "Catalog Principal: {} is trying to call the tool: {}",
        securityContext.getUserPrincipal().getName(),
        toolName);
    Map<String, Object> params = request.arguments();
    Object result;
    try {
      McpTool tool;
      switch (toolName) {
        case "search_metadata":
          tool = new SearchMetadataTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "semantic_search":
          result = new SemanticSearchTool().execute(authorizer, securityContext, params);
          break;
        case "get_entity_details":
          tool = new GetEntityTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "create_glossary":
          tool = new GlossaryTool();
          result = tool.execute(authorizer, limits, securityContext, params);
          break;
        case "create_glossary_term":
          tool = new GlossaryTermTool();
          result = tool.execute(authorizer, limits, securityContext, params);
          break;
        case "patch_entity":
          tool = new PatchEntityTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "get_entity_lineage":
          tool = new GetLineageTool();
          result = tool.execute(authorizer, securityContext, params);
          break;
        case "create_lineage":
          result = new LineageTool().execute(authorizer, securityContext, params);
          break;
        case "get_test_definitions":
          result = new TestDefinitionsTool().execute(authorizer, securityContext, params);
          break;
        case "create_test_case":
          result = new CreateTestCaseTool().execute(authorizer, limits, securityContext, params);
          break;
        case "root_cause_analysis":
          result = new RootCauseAnalysisTool().execute(authorizer, securityContext, params);
          break;
        case "create_metric":
          result = new CreateMetricTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_classification":
          result =
              new CreateClassificationTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_tag":
          result = new CreateTagTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_domain":
          result = new CreateDomainTool().execute(authorizer, limits, securityContext, params);
          break;
        case "create_data_product":
          result = new CreateDataProductTool().execute(authorizer, limits, securityContext, params);
          break;
        default:
          return new CallToolOutcome(
              McpSchema.CallToolResult.builder()
                  .content(
                      List.of(
                          new McpSchema.TextContent(
                              JsonUtils.pojoToJson(
                                  Map.of(
                                      "error",
                                      "Unknown function: " + toolName,
                                      "statusCode",
                                      STATUS_BAD_REQUEST)))))
                  .isError(true)
                  .build(),
              elapsedMs(startNanos),
              McpToolCallUsage.ErrorCategory.VALIDATION);
      }

      return new CallToolOutcome(
          McpSchema.CallToolResult.builder()
              .content(List.of(new McpSchema.TextContent(serializeWithinBudget(result, toolName))))
              .isError(false)
              .build(),
          elapsedMs(startNanos),
          null);
    } catch (AuthorizationException ex) {
      LOG.warn("Authorization error: {}", ex.getMessage());
      return new CallToolOutcome(
          McpSchema.CallToolResult.builder()
              .content(
                  List.of(
                      new McpSchema.TextContent(
                          JsonUtils.pojoToJson(
                              Map.of(
                                  "error",
                                  String.format(
                                      "Authorization error: %s", McpResponseTrim.safeMessage(ex)),
                                  "statusCode",
                                  STATUS_FORBIDDEN)))))
              .isError(true)
              .build(),
          elapsedMs(startNanos),
          McpToolCallUsage.ErrorCategory.AUTH);
    } catch (Exception ex) {
      LOG.error("Error executing tool '{}': {}", toolName, ex.getMessage(), ex);
      return new CallToolOutcome(
          McpSchema.CallToolResult.builder()
              .content(
                  List.of(
                      new McpSchema.TextContent(
                          JsonUtils.pojoToJson(
                              Map.of(
                                  "error",
                                  String.format(
                                      "Error executing tool: %s", McpResponseTrim.safeMessage(ex)),
                                  "statusCode",
                                  resolveStatusCode(ex))))))
              .isError(true)
              .build(),
          elapsedMs(startNanos),
          classifyException(ex));
    }
  }

  /**
   * Maps an arbitrary exception type to one of the {@link McpToolCallUsage.ErrorCategory} values.
   * Walks the cause chain because the tool wrappers usually rethrow framework errors wrapped in
   * a {@link RuntimeException}. Defaults to {@link McpToolCallUsage.ErrorCategory#INTERNAL} when
   * no specific bucket matches.
   */
  protected static McpToolCallUsage.ErrorCategory classifyException(Throwable t) {
    CategoryMatcher matched = matchException(t);
    return matched != null ? matched.category() : McpToolCallUsage.ErrorCategory.INTERNAL;
  }

  /**
   * Resolves the HTTP-style status code returned to the client for a failed tool call. Kept
   * separate from {@link #classifyException} (which buckets for telemetry) because the wire status
   * is a distinct concern: a missing entity is a 404 and a bad argument is a 400, even though both
   * bucket as {@code VALIDATION}. Defaults to 500 when no specific matcher applies.
   */
  protected static int resolveStatusCode(Throwable t) {
    CategoryMatcher matched = matchException(t);
    return matched != null ? matched.statusCode() : STATUS_INTERNAL_ERROR;
  }

  private static CategoryMatcher matchException(Throwable t) {
    CategoryMatcher result = null;
    // Identity-based visited set bounds the walk: a malformed cause cycle (A.cause=B, B.cause=A)
    // would otherwise spin forever. seen.add returns false on a revisit, ending the loop.
    Set<Throwable> seen = Collections.newSetFromMap(new IdentityHashMap<>());
    Throwable cursor = t;
    while (cursor != null && result == null && seen.add(cursor)) {
      result = matchSingle(cursor);
      cursor = cursor.getCause();
    }
    return result;
  }

  /**
   * Pairing of an exception (name, message) predicate with the telemetry bucket and HTTP status it
   * should produce. Kept as a static table so adding a new category (or extending an existing one
   * with a new keyword) is a one-line change rather than another {@code else if} branch.
   */
  private record CategoryMatcher(
      Predicate<ExceptionMeta> matches, McpToolCallUsage.ErrorCategory category, int statusCode) {}

  /** Lower-cased name + message pair so each matcher inspects both without re-parsing. */
  private record ExceptionMeta(String name, String message) {}

  /**
   * Ordered category table. Check order matters: more specific patterns sit before broader ones so
   * a {@code RateLimitException} doesn't get caught by the generic message-substring rules below
   * it. {@code AUTH} sits above {@code VALIDATION} because some auth exceptions ({@code
   * AuthorizationException}) extend {@code IllegalArgumentException}-style hierarchies and would
   * otherwise be mis-bucketed.
   */
  private static final List<CategoryMatcher> CATEGORY_MATCHERS =
      List.of(
          new CategoryMatcher(
              meta -> meta.name().contains("RateLimit") || meta.message().contains("rate limit"),
              McpToolCallUsage.ErrorCategory.RATE_LIMIT,
              STATUS_TOO_MANY_REQUESTS),
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Authorization")
                      || meta.name().contains("Forbidden")
                      || meta.name().contains("Unauthorized")
                      || meta.message().contains("forbidden")
                      || meta.message().contains("unauthorized")
                      || meta.message().contains("access denied")
                      || meta.message().contains("permission denied"),
              McpToolCallUsage.ErrorCategory.AUTH,
              STATUS_FORBIDDEN),
          // Validation by class name runs before the NotFound message heuristic below, so a
          // bad-argument exception whose message merely contains "not found" (e.g.
          // IllegalArgumentException("parameter not found")) stays a 400 rather than a 404.
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Validation")
                      || meta.name().contains("IllegalArgument")
                      || meta.name().contains("BadRequest")
                      || meta.message().contains("invalid argument"),
              McpToolCallUsage.ErrorCategory.VALIDATION,
              STATUS_BAD_REQUEST),
          new CategoryMatcher(
              meta -> meta.name().contains("NotFound") || meta.message().contains("not found"),
              McpToolCallUsage.ErrorCategory.VALIDATION,
              STATUS_NOT_FOUND),
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Timeout")
                      || meta.message().contains("timeout")
                      || meta.message().contains("timed out"),
              McpToolCallUsage.ErrorCategory.TIMEOUT,
              STATUS_GATEWAY_TIMEOUT));

  /**
   * Returns the matcher (category + status) for the supplied throwable's name or message, or
   * {@code null} when no specific bucket applies. Kept separate from {@link #matchException} so the
   * cause-chain walk reads as a single linear loop.
   */
  private static CategoryMatcher matchSingle(Throwable cursor) {
    ExceptionMeta meta =
        new ExceptionMeta(
            cursor.getClass().getSimpleName(),
            cursor.getMessage() == null ? "" : cursor.getMessage().toLowerCase(Locale.ROOT));
    return CATEGORY_MATCHERS.stream()
        .filter(matcher -> matcher.matches().test(meta))
        .findFirst()
        .orElse(null);
  }

  private static long elapsedMs(long startNanos) {
    return (System.nanoTime() - startNanos) / 1_000_000L;
  }

  /**
   * Serializes a tool result once and, only when it exceeds {@link
   * McpResponseTrim#MAX_RESPONSE_CHARS}, replaces it with a generic {@code truncated:true} envelope.
   * This is the dispatch-level floor that bounds tools without their own per-tool trim ({@code
   * get_entity_details}, {@code get_test_definitions}) and backstops the rest. The happy path
   * serializes exactly once; the re-serialization runs only on the rare oversized path.
   *
   * <p>Public so the Collate dispatcher ({@code CollateToolContext}), which builds its own success
   * result for Collate-only tools, applies the same floor instead of re-implementing it.
   */
  public static String serializeWithinBudget(Object result, String toolName) {
    String serialized = JsonUtils.pojoToJson(result);
    if (serialized.length() > McpResponseTrim.MAX_RESPONSE_CHARS) {
      LOG.warn(
          "[MCP] tool '{}' response {} chars exceeds {} budget; returning truncation envelope",
          toolName,
          serialized.length(),
          McpResponseTrim.MAX_RESPONSE_CHARS);
      Map<String, Object> capped =
          McpResponseTrim.oversizedEnvelope(
              serialized.length(), Map.of("tool", toolName), OVERSIZED_ADVICE);
      serialized = JsonUtils.pojoToJson(capped);
    }
    return serialized;
  }

  /**
   * Phase 3 — tuple returned by {@link #callToolWithMetadata} so the MCP server can record the
   * call with full diagnostic detail without re-classifying the exception or re-measuring the
   * latency at its level.
   */
  public record CallToolOutcome(
      McpSchema.CallToolResult result,
      long latencyMs,
      McpToolCallUsage.ErrorCategory errorCategory) {}
}
