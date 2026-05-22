package org.openmetadata.mcp.tools;

import static org.openmetadata.mcp.McpUtils.getToolProperties;

import io.modelcontextprotocol.spec.McpSchema;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
                                  Map.of("error", "Unknown function: " + toolName)))))
                  .isError(true)
                  .build(),
              elapsedMs(startNanos),
              McpToolCallUsage.ErrorCategory.VALIDATION);
      }

      return new CallToolOutcome(
          McpSchema.CallToolResult.builder()
              .content(List.of(new McpSchema.TextContent(JsonUtils.pojoToJson(result))))
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
                                  String.format("Authorization error: %s", ex.getMessage()),
                                  "statusCode",
                                  403)))))
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
                                  String.format("Error executing tool: %s", ex.getMessage()),
                                  "statusCode",
                                  500)))))
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
  static McpToolCallUsage.ErrorCategory classifyException(Throwable t) {
    McpToolCallUsage.ErrorCategory result = McpToolCallUsage.ErrorCategory.INTERNAL;
    Throwable cursor = t;
    while (cursor != null && result == McpToolCallUsage.ErrorCategory.INTERNAL) {
      McpToolCallUsage.ErrorCategory match = matchCategory(cursor);
      if (match != null) {
        result = match;
      } else {
        Throwable next = cursor.getCause();
        cursor = (next == null || next == cursor) ? null : next;
      }
    }
    return result;
  }

  /**
   * Pairing of an exception (name, message) predicate with the bucket it should produce. Kept
   * as a static table so adding a new category (or extending an existing one with a new keyword)
   * is a one-line change rather than another {@code else if} branch.
   */
  private record CategoryMatcher(
      Predicate<ExceptionMeta> matches, McpToolCallUsage.ErrorCategory category) {}

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
              McpToolCallUsage.ErrorCategory.RATE_LIMIT),
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Authorization")
                      || meta.name().contains("Forbidden")
                      || meta.name().contains("Unauthorized")
                      || meta.message().contains("forbidden")
                      || meta.message().contains("unauthorized")
                      || meta.message().contains("access denied")
                      || meta.message().contains("permission denied"),
              McpToolCallUsage.ErrorCategory.AUTH),
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Validation")
                      || meta.name().contains("IllegalArgument")
                      || meta.name().contains("BadRequest")
                      || meta.message().contains("invalid argument"),
              McpToolCallUsage.ErrorCategory.VALIDATION),
          new CategoryMatcher(
              meta ->
                  meta.name().contains("Timeout")
                      || meta.message().contains("timeout")
                      || meta.message().contains("timed out"),
              McpToolCallUsage.ErrorCategory.TIMEOUT));

  /**
   * Returns the category that matches the supplied throwable's name or message, or {@code null}
   * when no specific bucket applies. Kept separate from {@link #classifyException} so the
   * cause-chain walk reads as a single linear loop.
   */
  private static McpToolCallUsage.ErrorCategory matchCategory(Throwable cursor) {
    ExceptionMeta meta =
        new ExceptionMeta(
            cursor.getClass().getSimpleName(),
            cursor.getMessage() == null ? "" : cursor.getMessage().toLowerCase(Locale.ROOT));
    return CATEGORY_MATCHERS.stream()
        .filter(matcher -> matcher.matches().test(meta))
        .map(CategoryMatcher::category)
        .findFirst()
        .orElse(null);
  }

  private static long elapsedMs(long startNanos) {
    return (System.nanoTime() - startNanos) / 1_000_000L;
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
