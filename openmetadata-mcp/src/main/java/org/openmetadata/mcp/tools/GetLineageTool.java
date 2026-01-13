package org.openmetadata.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.LineageRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;

@Slf4j
public class GetLineageTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    try {
      if (nullOrEmpty(params)) {
        throw new IllegalArgumentException("Parameters cannot be null or empty");
      }
      String entityType = (String) params.get("entity_type");
      String fqn = (String) params.get("fqn");
      Integer upstreamDepth = (Integer) params.get("upstream_depth");
      Integer downstreamDepth = (Integer) params.get("downstream_depth");

      return JsonUtils.getMap(
          new LineageRepository().getByName(entityType, fqn, upstreamDepth, downstreamDepth));
    } catch (Exception e) {
      return Map.of("error", e.getMessage());
    }
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params)
      throws IOException {
    throw new UnsupportedOperationException("GetLineageTool does not support limits enforcement.");
  }
}
