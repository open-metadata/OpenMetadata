package org.openmetadata.mcp.tools;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.mcp.util.McpParams;
import org.openmetadata.mcp.util.McpResponseTrim;
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
    String after = stringParam(params, "after", null);
    LOG.info(
        "Listing test definitions for entityType: {}, testPlatform: {}, limit: {}",
        entityType,
        testPlatform,
        limit);
    return listWithinBudget(buildFilter(entityType, testPlatform), limit, after);
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
