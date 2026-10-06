package org.openmetadata.service.governance.workflows;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.governance.workflows.WorkflowEventConsumer.GOVERNANCE_BOT;

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.governance.workflows.elements.WorkflowNodeDefinitionInterface;
import org.openmetadata.schema.governance.workflows.elements.triggers.Config;
import org.openmetadata.schema.governance.workflows.elements.triggers.EventBasedEntityTriggerDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.workflows.elements.triggers.impl.TriggerEntityFilter;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WorkflowDefinitionRepository;

/**
 * The active governance workflows that own an entity type's lifecycle stage. A workflow owns the
 * stage when it is deployed and not suspended, starts on that type's entity events, and has a step
 * that sets the stage: a Set Action on status, an approval task (approving one stamps the stage), a
 * rollback, or the glossary-term status task. While such a workflow applies to an entity, only the
 * workflow may change that entity's stage.
 */
@Slf4j
public final class EntityStatusWorkflows implements StageOwnership {
  /** Stage ownership as decided by the workflows active on this server. */
  public static final EntityStatusWorkflows ACTIVE = new EntityStatusWorkflows();

  private static final String SET_ENTITY_ATTRIBUTE_NODE = "setEntityAttributeTask";
  private static final Set<String> STAGE_SETTING_NODES =
      Set.of("userApprovalTask", "rollbackEntityTask", "setGlossaryTermStatusTask");
  // The field names a Set Action resolves to the entity's lifecycle stage.
  private static final Set<String> STAGE_FIELD_NAMES = Set.of("status", Entity.FIELD_ENTITY_STATUS);
  private static final String FIELD_NAME_CONFIG = "fieldName";
  private static final Boolean ACTIVE_STAGE_WORKFLOWS_KEY = Boolean.TRUE;

  // Holds one entry: the active workflows that own a stage. A workflow change on this server
  // invalidates it at once; the expiry bounds how long another server acts on a stale copy.
  private static final LoadingCache<Boolean, List<WorkflowDefinition>> ACTIVE_STAGE_WORKFLOWS =
      Caffeine.newBuilder()
          .maximumSize(1)
          .expireAfterWrite(Duration.ofSeconds(30))
          .build(ignored -> loadActiveStageWorkflows());

  private EntityStatusWorkflows() {}

  @Override
  public List<String> owningStageOf(String entityType) {
    return ACTIVE_STAGE_WORKFLOWS.get(ACTIVE_STAGE_WORKFLOWS_KEY).stream()
        .filter(workflow -> startsOn(workflow, entityType))
        .map(WorkflowDefinition::getName)
        .sorted()
        .toList();
  }

  @Override
  public Optional<String> owningStageOf(String entityType, EntityInterface entity) {
    return ACTIVE_STAGE_WORKFLOWS.get(ACTIVE_STAGE_WORKFLOWS_KEY).stream()
        .filter(workflow -> appliesTo(workflow, entityType, entity))
        .map(WorkflowDefinition::getName)
        .sorted()
        .findFirst();
  }

  /** Workflows change entities as, or impersonating, the governance bot. */
  public static boolean isWorkflowChange(EntityInterface entity) {
    return GOVERNANCE_BOT.equals(entity.getUpdatedBy())
        || GOVERNANCE_BOT.equals(entity.getImpersonatedBy());
  }

  public static void invalidate() {
    ACTIVE_STAGE_WORKFLOWS.invalidateAll();
  }

  /** Whether the workflow, once deployed, owns a stage: it is not suspended and sets the stage. */
  static boolean ownsStage(WorkflowDefinition workflow) {
    return !Boolean.TRUE.equals(workflow.getSuspended())
        && listOrEmpty(workflow.getNodes()).stream().anyMatch(EntityStatusWorkflows::setsStage);
  }

  static boolean startsOn(WorkflowDefinition workflow, String entityType) {
    return workflow.getTrigger() instanceof EventBasedEntityTriggerDefinition trigger
        && trigger.getConfig() != null
        && triggerEntityTypes(trigger.getConfig()).contains(entityType);
  }

  static boolean appliesTo(WorkflowDefinition workflow, String entityType, EntityInterface entity) {
    return startsOn(workflow, entityType) && !excludedByTriggerFilter(workflow, entityType, entity);
  }

  private static boolean excludedByTriggerFilter(
      WorkflowDefinition workflow, String entityType, EntityInterface entity) {
    Object filter =
        ((EventBasedEntityTriggerDefinition) workflow.getTrigger()).getConfig().getFilter();
    return TriggerEntityFilter.excludes(
        TriggerEntityFilter.forEntityType(filter, entityType), entity);
  }

  private static boolean setsStage(WorkflowNodeDefinitionInterface node) {
    return STAGE_SETTING_NODES.contains(node.getSubType()) || setsStageField(node);
  }

  private static boolean setsStageField(WorkflowNodeDefinitionInterface node) {
    return SET_ENTITY_ATTRIBUTE_NODE.equals(node.getSubType())
        && node.getConfig() != null
        && STAGE_FIELD_NAMES.contains(
            String.valueOf(JsonUtils.getMap(node.getConfig()).get(FIELD_NAME_CONFIG)));
  }

  // entityType is the deprecated single-type form of entityTypes; older workflows still use it.
  private static Set<String> triggerEntityTypes(Config config) {
    Set<String> entityTypes = new HashSet<>();
    if (config.getEntityTypes() != null) {
      entityTypes.addAll(config.getEntityTypes());
    }
    if (!nullOrEmpty(config.getEntityType())) {
      entityTypes.add(config.getEntityType());
    }
    return entityTypes;
  }

  // Workflows only run while the engine is up, so with it down nothing owns a stage.
  private static List<WorkflowDefinition> loadActiveStageWorkflows() {
    List<WorkflowDefinition> workflows = List.of();
    if (WorkflowHandler.isInitialized()) {
      workflows =
          readableWorkflowDefinitions().stream()
              .filter(EntityStatusWorkflows::ownsStage)
              .filter(workflow -> WorkflowHandler.getInstance().isDeployed(workflow))
              .toList();
    }
    return workflows;
  }

  // Every lifecycle-stage write consults this list, so one stored definition this server cannot
  // read (a node type from another version) must not fail stage changes on every entity type. It
  // cannot be deployed here either, so skipping it leaves ownership unchanged.
  private static List<WorkflowDefinition> readableWorkflowDefinitions() {
    WorkflowDefinitionRepository repository =
        (WorkflowDefinitionRepository) Entity.getEntityRepository(Entity.WORKFLOW_DEFINITION);
    List<WorkflowDefinition> workflows = new ArrayList<>();
    for (String json :
        repository
            .getDao()
            .listAfter(new ListFilter(Include.NON_DELETED), Integer.MAX_VALUE, "", "")) {
      try {
        workflows.add(JsonUtils.readValue(json, WorkflowDefinition.class));
      } catch (Exception e) {
        LOG.error("Skipping unreadable workflow definition for lifecycle-stage ownership", e);
      }
    }
    return workflows;
  }
}
