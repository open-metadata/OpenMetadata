package org.openmetadata.service.mcp.tools;

import jakarta.json.JsonPatch;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class PatchEntityTool implements McpTool {
  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    String entityType = (String) params.get("entityType");
    String entityFqn = (String) params.get("entityFqn");
    JsonPatch patch = JsonUtils.readOrConvertValue(params.get("patch"), JsonPatch.class);

    // Validate If the User Can Perform the Patch Operation
    OperationContext operationContext = new OperationContext(entityType, patch);
    authorizer.authorize(
        securityContext, operationContext, new ResourceContext<>(entityType, null, entityFqn));

    EntityRepository<? extends EntityInterface> repository = Entity.getEntityRepository(entityType);
    RestUtil.PatchResponse<? extends EntityInterface> response =
        repository.patch(
            null,
            entityFqn,
            securityContext.getUserPrincipal().getName(),
            patch,
            ChangeSource.MANUAL);
    return JsonUtils.convertValue(response, Map.class);
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException("PatchEntityTool does not support limits enforcement.");
  }
}
