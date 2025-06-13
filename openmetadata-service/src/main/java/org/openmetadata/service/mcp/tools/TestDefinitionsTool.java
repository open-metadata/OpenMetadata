package org.openmetadata.service.mcp.tools;

import java.util.Map;
import org.openmetadata.schema.tests.TestPlatform;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.TestDefinitionRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.JsonUtils;

public class TestDefinitionsTool implements McpTool {
  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> params) {
    int limit = 10;
    if (params.containsKey("limit")) {
      Object limitObj = params.get("limit");
      if (limitObj instanceof Number) {
        limit = ((Number) limitObj).intValue();
      } else if (limitObj instanceof String) {
        limit = Integer.parseInt((String) limitObj);
      }
    }
    String entityType =
        params.containsKey("entityType") ? (String) params.get("entityType") : "TABLE";
    String testPlatformParam =
        params.containsKey("testPlatform")
            ? (String) params.get("testPlatform")
            : TestPlatform.OPEN_METADATA.value();
    String after = params.containsKey("after") ? (String) params.get("after") : null;

    TestDefinitionRepository repository =
        (TestDefinitionRepository) Entity.getEntityRepository(Entity.TEST_DEFINITION);

    OperationContext listOperationContext =
        new OperationContext(entityType, MetadataOperation.VIEW_BASIC);
    authorizer.authorize(
        catalogSecurityContext,
        listOperationContext,
        new ResourceContext<>(Entity.TEST_DEFINITION));
    ListFilter filter = new ListFilter(Include.NON_DELETED);
    if (entityType != null) {
      filter.addQueryParam("entityType", entityType);
    }
    if (testPlatformParam != null) {
      filter.addQueryParam("testPlatform", testPlatformParam);
    }

    return JsonUtils.getMap(
        repository.listAfter(null, repository.getFields("*"), filter, limit, after));
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext catalogSecurityContext,
      Map<String, Object> map) {
    throw new UnsupportedOperationException("TestDefinition does not requires limit validation.");
  }
}
