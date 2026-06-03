package org.openmetadata.mcp.tools;

import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.TagRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.tags.TagMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

@Slf4j
public class CreateTagTool implements McpTool {

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateTagTool requires limit validation.");
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

    final String classificationParam = CommonUtils.optString(params, "classification");
    final String parent = normalizeParent(CommonUtils.optString(params, "parent"));
    final String classification = resolveClassification(classificationParam, parent);

    preflightClassification(classification);
    preflightParent(parent);

    final CreateTag create = new CreateTag();
    create.setName(name);
    create.setDescription(description);
    create.setClassification(classification);
    if (parent != null) {
      create.setParent(parent);
    }
    final String displayName = CommonUtils.optString(params, "displayName");
    if (displayName != null) {
      create.setDisplayName(displayName);
    }
    if (params.containsKey("mutuallyExclusive")) {
      create.setMutuallyExclusive(
          CommonUtils.parseBoolean(params.get("mutuallyExclusive"), "mutuallyExclusive"));
    }
    applyOwnersAndReviewers(create, params);
    applyDomains(create, params);

    final TagMapper mapper = new TagMapper();
    final Tag entity = mapper.createToEntity(create, CommonUtils.principal(securityContext));

    authorize(authorizer, limits, securityContext, entity);

    final TagRepository repo = (TagRepository) Entity.getEntityRepository(Entity.TAG);
    repo.prepareInternal(entity, false);

    final String userName = CommonUtils.principal(securityContext);
    final RestUtil.PutResponse<Tag> response =
        repo.createOrUpdate(null, entity, userName, ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);
    return McpResponseUtils.compact(response.getEntity(), response.getChangeType());
  }

  static String resolveClassification(String classification, String parent) {
    final boolean hasClassification = classification != null && !classification.isBlank();
    String result;
    if (parent != null && !hasClassification) {
      result = FullyQualifiedName.split(parent)[0];
    } else if (parent != null) {
      final String derived = FullyQualifiedName.split(parent)[0];
      if (!classification.equals(derived)) {
        throw new IllegalArgumentException(
            "'classification' ("
                + classification
                + ") must be the root segment of 'parent' ("
                + parent
                + "). Expected '"
                + derived
                + "'.");
      }
      result = classification;
    } else if (hasClassification) {
      result = classification;
    } else {
      throw new IllegalArgumentException(
          "Parameter 'classification' is required. Provide the classification this tag belongs to"
              + " (e.g. 'PII', 'Tier').");
    }
    return result;
  }

  private static String normalizeParent(String parent) {
    String result = null;
    if (parent != null && !parent.isBlank()) {
      result = parent.trim();
    }
    return result;
  }

  private static void preflightClassification(String classification) {
    CommonUtils.requireExists(
        Entity.CLASSIFICATION,
        classification,
        "Classification '"
            + classification
            + "' not found. Create it first with create_classification or verify its name.");
  }

  private static void preflightParent(String parent) {
    if (parent != null) {
      CommonUtils.requireExists(
          Entity.TAG,
          parent,
          "Parent tag '"
              + parent
              + "' not found. Verify the FQN format is 'Classification.TagName' (e.g."
              + " 'PII.PersonalData').");
    }
  }

  private static void applyOwnersAndReviewers(CreateTag create, Map<String, Object> params) {
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

  private static void applyDomains(CreateTag create, Map<String, Object> params) {
    if (params.containsKey("domains")) {
      final List<String> domains =
          JsonUtils.readOrConvertValues(params.get("domains"), String.class);
      CommonUtils.preflightDomains(domains);
      create.setDomains(domains);
    }
  }

  private static void authorize(
      Authorizer authorizer, Limits limits, CatalogSecurityContext securityContext, Tag entity) {
    final OperationContext operationContext =
        new OperationContext(Entity.TAG, MetadataOperation.CREATE);
    final CreateResourceContext<Tag> createResourceContext =
        new CreateResourceContext<>(Entity.TAG, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
  }
}
