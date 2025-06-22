package org.openmetadata.service.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GlossaryTermTool implements McpTool {
  private static GlossaryTermMapper glossaryTermMapper = new GlossaryTermMapper();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("GlossaryTermTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    org.openmetadata.schema.api.data.CreateGlossaryTerm createGlossaryTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm();
    createGlossaryTerm.setName((String) params.get("name"));
    createGlossaryTerm.setGlossary((String) params.get("glossary"));
    createGlossaryTerm.setParent((String) params.get("parentTerm"));
    createGlossaryTerm.setDescription((String) params.get("description"));
    if (params.containsKey("owners")) {
      CommonUtils.setOwners(createGlossaryTerm, params);
    }

    GlossaryTerm glossaryTerm =
        glossaryTermMapper.createToEntity(
            createGlossaryTerm, securityContext.getUserPrincipal().getName());

    // Validate If the User Can Perform the Create Operation
    OperationContext operationContext =
        new OperationContext(Entity.GLOSSARY_TERM, MetadataOperation.CREATE);
    CreateResourceContext<GlossaryTerm> createResourceContext =
        new CreateResourceContext<>(Entity.GLOSSARY_TERM, glossaryTerm);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    GlossaryRepository glossaryRepository =
        (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
    Glossary glossary =
        glossaryRepository.findByNameOrNull(createGlossaryTerm.getGlossary(), Include.ALL);

    GlossaryTermRepository glossaryTermRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    // TODO: Get the updatedBy from the tool request.
    glossaryTermRepository.prepare(glossaryTerm, nullOrEmpty(glossary));
    glossaryTermRepository.setFullyQualifiedName(glossaryTerm);
    RestUtil.PutResponse<GlossaryTerm> response =
        glossaryTermRepository.createOrUpdate(
            null, glossaryTerm, securityContext.getUserPrincipal().getName());
    return JsonUtils.getMap(response.getEntity());
  }
}
