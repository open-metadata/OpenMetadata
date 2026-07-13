package org.openmetadata.mcp.tools;

import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ClassificationRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.tags.ClassificationMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class CreateClassificationTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateClassificationTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    final String name = CommonUtils.requireNonBlank(params.get("name"), "name");
    final String description =
        CommonUtils.requireNonBlank(params.get("description"), "description");

    final CreateClassification create = new CreateClassification();
    create.setName(name);
    create.setDescription(description);
    final String displayName = CommonUtils.optString(params, "displayName");
    if (displayName != null) {
      create.setDisplayName(displayName);
    }
    final Boolean suppliedMutuallyExclusive = applyMutuallyExclusive(create, params);
    applyOwnersAndReviewers(create, params);
    applyDomains(create, params);

    final ClassificationMapper mapper = new ClassificationMapper();
    final Classification entity =
        mapper.createToEntity(create, CommonUtils.principal(securityContext));

    authorize(authorizer, limits, securityContext, entity);

    final ClassificationRepository repo =
        (ClassificationRepository) Entity.getEntityRepository(Entity.CLASSIFICATION);
    repo.prepareInternal(entity, false);

    final String userName = CommonUtils.principal(securityContext);
    final RestUtil.PutResponse<Classification> response =
        repo.createOrUpdate(null, entity, userName, ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);

    final Map<String, Object> result =
        McpResponseUtils.compact(response.getEntity(), response.getChangeType());
    addMutuallyExclusiveWarning(result, response, suppliedMutuallyExclusive);
    return result;
  }

  private static void authorize(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Classification entity) {
    final OperationContext operationContext =
        new OperationContext(Entity.CLASSIFICATION, MetadataOperation.CREATE);
    final CreateResourceContext<Classification> createResourceContext =
        new CreateResourceContext<>(Entity.CLASSIFICATION, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
  }

  private static void addMutuallyExclusiveWarning(
      Map<String, Object> result, RestUtil.PutResponse<Classification> response, Boolean supplied) {
    final Boolean stored = response.getEntity().getMutuallyExclusive();
    final boolean wasUpdate = !EventType.ENTITY_CREATED.equals(response.getChangeType());
    if (wasUpdate && supplied != null && !Objects.equals(supplied, stored)) {
      result.put(
          "_warning",
          "mutuallyExclusive cannot be changed on an existing classification. Retained existing"
              + " value: "
              + stored
              + ". Supplied value "
              + supplied
              + " was ignored.");
    }
  }

  private static Boolean applyMutuallyExclusive(
      CreateClassification create, Map<String, Object> params) {
    Boolean supplied = null;
    if (params.containsKey("mutuallyExclusive")) {
      supplied = CommonUtils.parseBoolean(params.get("mutuallyExclusive"), "mutuallyExclusive");
      create.setMutuallyExclusive(supplied);
    }
    return supplied;
  }

  private static void applyOwnersAndReviewers(
      CreateClassification create, Map<String, Object> params) {
    if (params.containsKey("owners")) {
      CommonUtils.setOwners(create, params);
    }
    if (params.containsKey("reviewers")) {
      final List<EntityReference> reviewers = CommonUtils.getTeamsOrUsers(params.get("reviewers"));
      if (!reviewers.isEmpty()) {
        create.setReviewers(reviewers);
      }
    }
  }

  private static void applyDomains(CreateClassification create, Map<String, Object> params) {
    if (params.containsKey("domains")) {
      final List<String> domains =
          JsonUtils.readOrConvertValues(params.get("domains"), String.class);
      CommonUtils.preflightDomains(domains);
      create.setDomains(domains);
    }
  }
}
