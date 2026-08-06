package org.openmetadata.mcp.tools;

import com.google.common.annotations.VisibleForTesting;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
import org.openmetadata.mcp.util.PageCursor;
import org.openmetadata.mcp.util.ResponseBudget;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

@Slf4j
public class TestDefinitionsTool implements McpTool {

  private static final int DEFAULT_LIMIT = 10;
  private static final int MAX_LIMIT = 50;
  private static final String DEFAULT_ENTITY_TYPE = "TABLE";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> params) {
    authorizer.authorize(
        catalogSecurityContext,
        new OperationContext(Entity.TEST_DEFINITION, MetadataOperation.VIEW_BASIC),
        new ResourceContext<>(Entity.TEST_DEFINITION));
    int limit = resolveLimit(params);
    String entityType = stringParam(params, "entityType", DEFAULT_ENTITY_TYPE);
    String testPlatform = stringParam(params, "testPlatform", TestPlatform.OPEN_METADATA.value());
    String after = keysetCursorOrAfter(params);
    LOG.info(
        "Listing test definitions for entityType: {}, testPlatform: {}, limit: {}",
        entityType,
        testPlatform,
        limit);
    Map<String, Object> page =
        listWithinBudget(buildFilter(entityType, testPlatform), limit, after);
    attachPagingContract(page);
    return page;
  }

  private static String keysetCursorOrAfter(Map<String, Object> params) {
    String after = stringParam(params, "after", null);
    Optional<PageCursor.Cursor> cursor = PageCursor.decode(stringParam(params, "cursor", null));
    if (cursor.isPresent() && !cursor.get().isOffset()) {
      after = cursor.get().after();
    }
    return after;
  }

  /**
   * Surfaces the repository's native keyset cursor as the unified {@code nextCursor}/{@code hasMore}/
   * {@code total} markers. {@code listAfter} sets {@code paging.after} to the token for the next page
   * (null on the last page); wrapping it in {@link PageCursor} keeps the wire contract identical to
   * the offset-based tools while preserving keyset write-stability underneath.
   */
  @VisibleForTesting
  static void attachPagingContract(Map<String, Object> page) {
    if (page.get("paging") instanceof Map<?, ?> paging) {
      Object total = paging.get("total");
      if (total != null) {
        page.put(McpResponseTrim.TOTAL_KEY, total);
      }
      if (paging.get("after") instanceof String nativeAfter && !nativeAfter.isBlank()) {
        page.put(McpResponseTrim.HAS_MORE_KEY, Boolean.TRUE);
        page.put(McpResponseTrim.NEXT_CURSOR_KEY, PageCursor.encodeKeyset(nativeAfter));
      }
    }
  }

  private static int resolveLimit(Map<String, Object> params) {
    int limit = McpParams.getInt(params, "limit", DEFAULT_LIMIT);
    return Math.min(Math.max(limit, 1), MAX_LIMIT);
  }

  private static String stringParam(Map<String, Object> params, String key, String defaultValue) {
    return params.containsKey(key) ? (String) params.get(key) : defaultValue;
  }

  private static ListFilter buildFilter(String entityType, String testPlatform) {
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    if (entityType != null) {
      filter.addQueryParam("entityType", entityType);
    }
    if (testPlatform != null) {
      filter.addQueryParam("testPlatform", testPlatform);
    }
    return filter;
  }

  /**
   * Keeps the page under the dispatch-level size cap by requesting fewer test definitions, never by
   * mangling the ones returned. Because {@code listAfter} produces the {@code after} cursor for the
   * exact window it returns, shrinking the limit and refetching keeps native cursor pagination
   * consistent (no test definition is skipped on the next page).
   */
  private static Map<String, Object> listWithinBudget(ListFilter filter, int limit, String after) {
    TestDefinitionRepository repository =
        (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);
    long budget = ResponseBudget.defaultBudgetChars();
    int pageLimit = limit;
    Map<String, Object> page = listPage(repository, filter, pageLimit, after);
    while (pageLimit > 1 && McpResponseTrim.serializedLength(page) > budget) {
      pageLimit = pageLimit / 2;
      page = listPage(repository, filter, pageLimit, after);
    }
    return page;
  }

  private static Map<String, Object> listPage(
      TestDefinitionRepository repository, ListFilter filter, int limit, String after) {
    return JsonUtils.getMap(
        repository.listAfter(null, repository.getFields("*"), filter, limit, after));
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> map) {
    throw new UnsupportedOperationException(
        "TestDefinitionsTool does not require limit validation.");
  }
}
