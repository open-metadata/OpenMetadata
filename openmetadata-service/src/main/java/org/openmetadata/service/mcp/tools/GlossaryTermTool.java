package org.openmetadata.service.mcp.tools;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.GlossaryRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.resources.glossary.GlossaryTermMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class GlossaryTermTool implements McpTool {
  private static GlossaryTermMapper glossaryTermMapper = new GlossaryTermMapper();

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    // TODO:Use the securityContext to validate permissions
    org.openmetadata.schema.api.data.CreateGlossaryTerm createGlossaryTerm =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm();
    createGlossaryTerm.setGlossary((String) params.get("glossary"));
    createGlossaryTerm.setName((String) params.get("name"));
    createGlossaryTerm.setDescription((String) params.get("description"));
    UserRepository userRepository = Entity.getUserRepository();
    List<EntityReference> owners = new java.util.ArrayList<>();
    // TODO: Deal with Teams vs Users
    if (params.containsKey("owners")) {
      for (String owner : JsonUtils.readOrConvertValues(params.get("owners"), String.class)) {
        try {
          User user = userRepository.findByName(owner, Include.NON_DELETED);
          owners.add(user.getEntityReference());
        } catch (EntityNotFoundException e) {
          LOG.error(String.format("User '%s' not found", owner));
          Map<String, Object> error = new HashMap<>();
          error.put("error", e.getMessage());
          return error;
        }
      }
    }

    if (!owners.isEmpty()) {
      createGlossaryTerm.setOwners(owners);
    }

    try {
      GlossaryRepository glossaryRepository =
          (GlossaryRepository) Entity.getEntityRepository(Entity.GLOSSARY);
      Glossary glossary =
          glossaryRepository.findByNameOrNull(createGlossaryTerm.getGlossary(), Include.ALL);
      GlossaryTerm glossaryTerm =
          glossaryTermMapper.createToEntity(createGlossaryTerm, ADMIN_USER_NAME);
      GlossaryTermRepository glossaryTermRepository =
          (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
      // TODO: Get the updatedBy from the tool request.
      glossaryTermRepository.prepare(glossaryTerm, nullOrEmpty(glossary));
      glossaryTermRepository.setFullyQualifiedName(glossaryTerm);
      RestUtil.PutResponse<GlossaryTerm> response =
          glossaryTermRepository.createOrUpdate(null, glossaryTerm, "admin");
      return JsonUtils.convertValue(response.getEntity(), Map.class);
    } catch (Exception e) {
      Map<String, Object> error = new HashMap<>();
      error.put("error", e.getMessage());
      return error;
    }
  }
}
