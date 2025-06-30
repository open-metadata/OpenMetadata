package org.openmetadata.service.mcp.tools;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.data.CreateGlossary;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.glossary.GlossaryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GlossaryTool implements McpTool {
  private static GlossaryMapper glossaryMapper = new GlossaryMapper();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("GlossaryTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    CreateGlossary createGlossary = new CreateGlossary();
    createGlossary.setName((String) params.get("name"));
    createGlossary.setDescription((String) params.get("description"));
    if (params.containsKey("owners")) {
      CommonUtils.setOwners(createGlossary, params);
    }
    if (params.containsKey("reviewers")) {
      setReviewers(createGlossary, params);
    }

    Glossary glossary =
        glossaryMapper.createToEntity(createGlossary, securityContext.getUserPrincipal().getName());

    // Validate If the User Can Perform the Create Operation
    OperationContext operationContext =
        new OperationContext(Entity.GLOSSARY, MetadataOperation.CREATE);
    CreateResourceContext<Glossary> createResourceContext =
        new CreateResourceContext<>(Entity.GLOSSARY, glossary);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);

    glossaryRepository.prepare(glossary, true);
    glossaryRepository.setFullyQualifiedName(glossary);
    RestUtil.PutResponse<Glossary> response =
        glossaryRepository.createOrUpdate(
            null, glossary, securityContext.getUserPrincipal().getName());
    return JsonUtils.convertValue(response.getEntity(), Map.class);
  }

  public static void setReviewers(CreateGlossary entity, Map<String, Object> params) {
    List<EntityReference> reviewers = CommonUtils.getTeamsOrUsers(params.get("reviewers"));
    if (!reviewers.isEmpty()) {
      entity.setReviewers(reviewers);
    }
  }
}
