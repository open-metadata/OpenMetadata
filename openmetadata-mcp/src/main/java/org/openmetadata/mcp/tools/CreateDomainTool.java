package org.openmetadata.mcp.tools;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DomainRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.domains.DomainMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class CreateDomainTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateDomainTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    Object nameRaw = params.get("name");
    if (!(nameRaw instanceof String name) || name.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'name' is required and must be a non-blank string. Received: " + nameRaw);
    }

    Object descriptionRaw = params.get("description");
    if (!(descriptionRaw instanceof String description) || description.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'description' is required and must be a non-blank string. Received: " + descriptionRaw);
    }

    Object domainTypeRaw = params.get("domainType");
    if (!(domainTypeRaw instanceof String domainType) || domainType.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'domainType' is required and must be a non-blank string. Received: " + domainTypeRaw);
    }

    CreateDomain createDomain = new CreateDomain();
    createDomain.setName(name);
    createDomain.setDescription(description);
    
    try {
        createDomain.setDomainType(org.openmetadata.schema.type.DomainType.fromValue(domainType));
    } catch (Exception e) {
        throw new IllegalArgumentException(
            "Parameter 'domainType' has invalid value '" + domainType + "'. Valid values are: Aggregate, Source-aligned, Consumer-aligned");
    }

    if (params.containsKey("displayName")) {
      Object displayNameRaw = params.get("displayName");
      if (!(displayNameRaw instanceof String)) {
        throw new IllegalArgumentException(
            "Parameter 'displayName' must be a string. Received: " + displayNameRaw);
      }
      createDomain.setDisplayName((String) displayNameRaw);
    }

    if (params.containsKey("parent")) {
      Object parentRaw = params.get("parent");
      if (!(parentRaw instanceof String)) {
        throw new IllegalArgumentException(
            "Parameter 'parent' must be a string. Received: " + parentRaw);
      }
      createDomain.setParent((String) parentRaw);
    }

    if (params.containsKey("owners")) {
      CommonUtils.setOwners(createDomain, params);
    }

    if (params.containsKey("experts")) {
      createDomain.setExperts(JsonUtils.readOrConvertValues(params.get("experts"), String.class));
    }

    if (params.containsKey("tags")) {
      List<TagLabel> tags = new ArrayList<>();
      for (String tagFqn : JsonUtils.readOrConvertValues(params.get("tags"), String.class)) {
        tags.add(
            new TagLabel()
                .withTagFQN(tagFqn)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL));
      }
      createDomain.setTags(tags);
    }

    DomainMapper mapper = new DomainMapper();
    Domain domain =
        mapper.createToEntity(createDomain, securityContext.getUserPrincipal().getName());

    OperationContext operationContext =
        new OperationContext(Entity.DOMAIN, MetadataOperation.CREATE);
    CreateResourceContext<Domain> createResourceContext =
        new CreateResourceContext<>(Entity.DOMAIN, domain);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);

    DomainRepository repo = (DomainRepository) Entity.getEntityRepository(Entity.DOMAIN);
    repo.prepareInternal(domain, false);

    String userName = securityContext.getUserPrincipal().getName();
    String impersonatedBy = ImpersonationContext.getImpersonatedBy();
    RestUtil.PutResponse<Domain> response =
        repo.createOrUpdate(null, domain, userName, impersonatedBy);
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);
    return JsonUtils.getMap(response.getEntity());
  }
}
