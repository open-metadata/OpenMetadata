package org.openmetadata.mcp.tools;

import static org.openmetadata.schema.type.MetadataOperation.VIEW_ALL;

import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.security.policyevaluator.ResourceContext;

/** Fetches a single Company Context knowledge pill (a {@link ContextMemory}) by FQN. */
@Slf4j
public class GetCompanyContextTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params)
      throws IOException {
    String fqn = (String) params.get("fqn");
    authorizer.authorize(
        securityContext,
        new OperationContext(Entity.CONTEXT_MEMORY, VIEW_ALL),
        new ResourceContext<>(Entity.CONTEXT_MEMORY));
    LOG.info("Getting company context pill: {}", fqn);
    ContextMemory memory =
        Entity.getEntityByName(Entity.CONTEXT_MEMORY, fqn, "sourceFile,owners,tags,domains", null);
    return projectPill(memory);
  }

  static Map<String, Object> projectPill(ContextMemory memory) {
    Map<String, Object> pill = new HashMap<>();
    pill.put("fullyQualifiedName", memory.getFullyQualifiedName());
    pill.put("name", memory.getName());
    putIfPresent(pill, "title", memory.getTitle());
    putIfPresent(pill, "question", memory.getQuestion());
    putIfPresent(pill, "answer", memory.getAnswer());
    putIfPresent(pill, "summary", memory.getSummary());
    putIfPresent(pill, "memoryType", memory.getMemoryType());
    if (memory.getSourceFile() != null) {
      pill.put("sourceFile", memory.getSourceFile().getFullyQualifiedName());
    }
    return pill;
  }

  private static void putIfPresent(Map<String, Object> pill, String key, Object value) {
    if (value != null) {
      pill.put(key, value);
    }
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    throw new UnsupportedOperationException(
        "GetCompanyContextTool does not require limit validation.");
  }
}
