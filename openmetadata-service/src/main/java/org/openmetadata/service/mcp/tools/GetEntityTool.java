package org.openmetadata.service.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.JsonUtils;

@Slf4j
public class GetEntityTool implements McpTool {
  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    if (nullOrEmpty(params)) {
      throw new IllegalArgumentException("Parameters cannot be null or empty");
    }
    String entityType = (String) params.get("entity_type");
    String fqn = (String) params.get("fqn");
    authorizer.authorize(
        securityContext,
        new OperationContext(entityType, VIEW_ALL),
        new ResourceContext<>(entityType));
    LOG.info("Getting details for entity type: {}, FQN: {}", entityType, fqn);
    String fields = "*";
    return JsonUtils.getMap(Entity.getEntityByName(entityType, fqn, fields, null));
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
