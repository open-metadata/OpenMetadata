package org.openmetadata.mcp.tools;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.api.context.CreateContextMemory;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.limits.Limits;
import org.openmetadata.service.resources.context.ContextMemoryMapper;
import org.openmetadata.service.security.Authorizer;
import org.openmetadata.service.security.ImpersonationContext;
import org.openmetadata.service.security.auth.CatalogSecurityContext;
import org.openmetadata.service.security.policyevaluator.CreateResourceContext;
import org.openmetadata.service.security.policyevaluator.OperationContext;
import org.openmetadata.service.util.RestUtil;

/**
 * Creates a reusable Context Center memory (a {@link ContextMemory}) the assistant should retain
 * across conversations. Memories created through this tool are stamped with {@link
 * ContextMemorySourceType#REMEMBER_REQUEST} so their provenance reflects an explicit "remember this"
 * request rather than a manual UI edit, and so the Memory Agent can pick them up for glossary/metric
 * derivation when enabled.
 */
@Slf4j
public class CreateContextMemoryTool implements McpTool {
  private static final String MEMORY_TYPE_VALUES = "Preference, UseCase, Note, Runbook, Faq";
  private static final String MEMORY_SCOPE_VALUES = "UserGlobal, EntityScoped";

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer, CatalogSecurityContext securityContext, Map<String, Object> params) {
    throw new UnsupportedOperationException("CreateContextMemoryTool requires limit validation.");
  }

  @Override
  public Map<String, Object> execute(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      Map<String, Object> params) {
    final CreateContextMemory create = buildCreateRequest(params);

    final ContextMemoryMapper mapper = new ContextMemoryMapper();
    final ContextMemory entity =
        mapper.createToEntity(create, CommonUtils.principal(securityContext));

    authorize(authorizer, limits, securityContext, entity);

    final ContextMemoryRepository repo =
        (ContextMemoryRepository) Entity.getEntityRepository(Entity.CONTEXT_MEMORY);
    repo.prepareInternal(entity, false);

    final String userName = CommonUtils.principal(securityContext);
    final RestUtil.PutResponse<ContextMemory> response =
        repo.createOrUpdate(null, entity, userName, ImpersonationContext.getImpersonatedBy());
    McpChangeEventUtil.publishChangeEvent(response.getEntity(), response.getChangeType(), userName);
    return McpResponseUtils.compact(response.getEntity(), response.getChangeType());
  }

  private CreateContextMemory buildCreateRequest(Map<String, Object> params) {
    final CreateContextMemory create = new CreateContextMemory();
    create.setName(CommonUtils.requireNonBlank(params.get("name"), "name"));
    create.setQuestion(CommonUtils.requireNonBlank(params.get("question"), "question"));
    create.setAnswer(CommonUtils.requireNonBlank(params.get("answer"), "answer"));
    create.setSourceType(ContextMemorySourceType.REMEMBER_REQUEST);
    applyContent(create, params);
    applyClassification(create, params);
    applyGovernance(create, params);
    return create;
  }

  private void applyContent(CreateContextMemory create, Map<String, Object> params) {
    final String title = CommonUtils.optString(params, "title");
    if (title != null) {
      create.setTitle(title);
    }
    final String summary = CommonUtils.optString(params, "summary");
    if (summary != null) {
      create.setSummary(summary);
    }
    final String description = CommonUtils.optString(params, "description");
    if (description != null) {
      create.setDescription(description);
    }
    final String displayName = CommonUtils.optString(params, "displayName");
    if (displayName != null) {
      create.setDisplayName(displayName);
    }
  }

  private void applyClassification(CreateContextMemory create, Map<String, Object> params) {
    if (params.containsKey("memoryType")) {
      create.setMemoryType(parseMemoryType(params.get("memoryType")));
    }
    if (params.containsKey("memoryScope")) {
      create.setMemoryScope(parseMemoryScope(params.get("memoryScope")));
    }
  }

  private void applyGovernance(CreateContextMemory create, Map<String, Object> params) {
    if (params.containsKey("owners")) {
      CommonUtils.setOwners(create, params);
    }
    if (params.containsKey("tags")) {
      create.setTags(CommonUtils.buildTagLabels(params.get("tags")));
    }
    if (params.containsKey("domains")) {
      create.setDomains(JsonUtils.readOrConvertValues(params.get("domains"), String.class));
    }
  }

  static ContextMemoryType parseMemoryType(Object raw) {
    if (!(raw instanceof String value) || value.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'memoryType' must be a non-blank string. Valid values are: "
              + MEMORY_TYPE_VALUES
              + ". Received: "
              + raw);
    }
    ContextMemoryType result;
    try {
      result = ContextMemoryType.fromValue(value);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          "Parameter 'memoryType' has invalid value '"
              + value
              + "'. Valid values are: "
              + MEMORY_TYPE_VALUES);
    }
    return result;
  }

  static ContextMemoryScope parseMemoryScope(Object raw) {
    if (!(raw instanceof String value) || value.isBlank()) {
      throw new IllegalArgumentException(
          "Parameter 'memoryScope' must be a non-blank string. Valid values are: "
              + MEMORY_SCOPE_VALUES
              + ". Received: "
              + raw);
    }
    ContextMemoryScope result;
    try {
      result = ContextMemoryScope.fromValue(value);
    } catch (IllegalArgumentException e) {
      throw new IllegalArgumentException(
          "Parameter 'memoryScope' has invalid value '"
              + value
              + "'. Valid values are: "
              + MEMORY_SCOPE_VALUES);
    }
    return result;
  }

  private static void authorize(
      Authorizer authorizer,
      Limits limits,
      CatalogSecurityContext securityContext,
      ContextMemory entity) {
    final OperationContext operationContext =
        new OperationContext(Entity.CONTEXT_MEMORY, MetadataOperation.CREATE);
    final CreateResourceContext<ContextMemory> createResourceContext =
        new CreateResourceContext<>(Entity.CONTEXT_MEMORY, entity);
    limits.enforceLimits(securityContext, createResourceContext, operationContext);
    authorizer.authorize(securityContext, operationContext, createResourceContext);
  }
}
