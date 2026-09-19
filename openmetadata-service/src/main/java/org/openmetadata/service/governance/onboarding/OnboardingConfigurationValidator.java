package org.openmetadata.service.governance.onboarding;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.OnboardingAssignment;
import org.openmetadata.schema.governance.onboarding.OnboardingAssistance;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingCondition;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingRequirement;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.TypeRegistry;
import org.openmetadata.service.exception.EntityNotFoundException;

public final class OnboardingConfigurationValidator {
  private static final Map<String, Set<String>> CREATION_FIELDS =
      Map.of(
          "dataProduct",
          Set.of("name", "description", "domains"),
          "domain",
          Set.of("name", "description", "domainType"),
          "glossaryTerm",
          Set.of("name", "description", "glossary"),
          "metric",
          Set.of("name"));

  private static final Set<String> SYSTEM_FIELDS =
      Set.of(
          "id",
          "version",
          "entityStatus",
          "updatedAt",
          "updatedBy",
          "deleted",
          "href",
          "changeDescription",
          "incrementalChangeDescription",
          "fullyQualifiedName");

  /**
   * Accessors that are not fields a playbook can ask someone to fill: the bean's own plumbing, the
   * custom-property container (listed separately with its {@code extension.} prefix), and values
   * the platform derives - engagement, usage and ingestion bookkeeping are observed, not supplied.
   */
  private static final Set<String> NON_AUTHORABLE_FIELDS =
      Set.of(
          "class",
          "extension",
          "additionalProperties",
          "entityReference",
          "impersonatedBy",
          "sourceHash",
          "provider",
          "followers",
          "votes",
          "usageSummary",
          "lifeCycle",
          "children");

  private static final String SET_ATTRIBUTE_TASK = "setEntityAttributeTask";
  private static final String GLOSSARY_STATUS_TASK = "setGlossaryTermStatusTask";
  private static final String USER_APPROVAL_TASK = "userApprovalTask";
  private static final String SUB_TYPE = "subType";
  private static final Set<String> STATUS_FIELDS = Set.of("status", "entityStatus");
  private static final Set<OnboardingCondition.Operator> VALUED_OPERATORS =
      Set.of(OnboardingCondition.Operator.CONTAINS, OnboardingCondition.Operator.STARTS_WITH);
  private static final String EXTENSION_PREFIX = "extension.";

  private OnboardingConfigurationValidator() {}

  public static Set<String> creationFields(String type) {
    return CREATION_FIELDS.getOrDefault(type, Set.of());
  }

  /**
   * The native fields a playbook may require on this asset type - every path {@link #validatePath}
   * would accept. Derived from the entity class rather than listed by hand so the picker can never
   * offer a field the API will reject. Custom properties are read separately and carry the
   * {@code extension.} prefix.
   */
  public static List<String> onboardingFields(String type) {
    Class<?> entityClass = Entity.getEntityRepository(type).getEntityClass();
    Set<String> fields = new TreeSet<>();
    for (var method : entityClass.getMethods()) {
      if (method.getParameterCount() > 0
          || !method.getName().startsWith("get")
          || method.getName().length() < 4) {
        continue;
      }
      String field =
          Character.toLowerCase(method.getName().charAt(3)) + method.getName().substring(4);
      if (!SYSTEM_FIELDS.contains(field) && !NON_AUTHORABLE_FIELDS.contains(field)) {
        fields.add(field);
      }
    }
    return List.copyOf(fields);
  }

  public static void validate(OnboardingPlaybook playbook) {
    if (playbook.getOnboarding() == null) return;
    require(playbook.getOnboarding().getGates() != null, "Onboarding gates are required");
    normalizeStages(playbook);
    normalizeCustomPaths(playbook);
    Set<String> ids = new HashSet<>();
    Set<String> fields = new HashSet<>();
    Set<String> stages = new HashSet<>();
    for (var gate : playbook.getOnboarding().getGates()) {
      require(gate != null && gate.getSteps() != null, "Gate steps are required");
      require(gate.getStage() != null && stages.add(gate.getStage()), "Each stage must occur once");
      require(
          !terminalStage(playbook, gate.getStage()) || gate.getSteps().isEmpty(),
          "A terminal stage completes onboarding and cannot contain checks");
      for (var step : gate.getSteps()) {
        require(step != null, "A check definition is required");
        applyDefaults(step);
        require(
            step.getId() != null
                && step.getId().matches("[a-zA-Z0-9_-]{1,64}")
                && ids.add(step.getId()),
            "Step IDs must be unique");
        validateStep(playbook, gate.getStage(), step, fields);
      }
      validateHandoff(playbook, gate);
      validateStallPolicies(playbook, gate);
    }
    Set<String> resolvedIds = new HashSet<>();
    for (var stage : OnboardingLifecycle.stageKeys(playbook.getOnboarding())) {
      for (var step : OnboardingEvaluator.steps(playbook, stage)) {
        require(resolvedIds.add(step.getId()), "Step IDs must be unique including Creation checks");
      }
    }
  }

  /**
   * {@code status.json} defaults every generated {@code EntityStatus} to {@code Unprocessed}, so a
   * stage declared without a status arrives as Unprocessed - a status no onboarding asset ever holds.
   * Store it as absent so readers do not have to know about the generator's default.
   */
  private static void normalizeStages(OnboardingPlaybook playbook) {
    for (var stage : listOrEmpty(playbook.getOnboarding().getStages())) {
      if (stage != null && stage.getEntityStatus() == EntityStatus.UNPROCESSED) {
        stage.setEntityStatus(null);
      }
    }
  }

  /**
   * Generated models cannot carry a default through a {@code $ref}, so the schema's documented
   * defaults are written in here once, at publish time, rather than re-derived by every reader.
   */
  private static void applyDefaults(OnboardingStep step) {
    if (step.getConditions() == null) step.setConditions(List.of());
    if (step.getRequirement() == null) step.setRequirement(OnboardingRequirement.BLOCKING);
    if (step.getAssistance() == null) step.setAssistance(OnboardingAssistance.NONE);
  }

  /**
   * Custom properties are addressed as {@code extension.<name>}. A check may name one without the
   * prefix, so resolve it against the registered custom properties before validating.
   */
  private static void normalizeCustomPaths(OnboardingPlaybook playbook) {
    Map<String, String> paths = new HashMap<>();
    String type = playbook.getEntityType().value();
    for (var gate : playbook.getOnboarding().getGates()) {
      if (gate == null || gate.getSteps() == null) continue;
      for (var step : gate.getSteps()) {
        String path = step == null ? null : step.getFieldPath();
        if (path == null || path.startsWith(EXTENSION_PREFIX)) continue;
        if (TypeRegistry.instance().getSchema(type, path) != null) {
          paths.put(path, EXTENSION_PREFIX + path);
        }
      }
    }
    for (var gate : playbook.getOnboarding().getGates()) {
      if (gate == null || gate.getSteps() == null) continue;
      for (var step : gate.getSteps()) {
        if (step == null) continue;
        step.setFieldPath(paths.getOrDefault(step.getFieldPath(), step.getFieldPath()));
        if (step.getConditions() != null) {
          for (var condition : step.getConditions()) {
            if (condition != null)
              condition.setFieldPath(
                  paths.getOrDefault(condition.getFieldPath(), condition.getFieldPath()));
          }
        }
      }
    }
  }

  /** A stage at or past the one the playbook maps to Approved - nothing further is gated. */
  private static boolean terminalStage(OnboardingPlaybook playbook, String stage) {
    var configuration = playbook.getOnboarding();
    int index = OnboardingLifecycle.indexOf(configuration, stage);
    int approved = OnboardingLifecycle.indexOf(configuration, OnboardingLifecycle.APPROVED);
    return index >= 0 && approved >= 0 && index >= approved;
  }

  private static void validateStep(
      OnboardingPlaybook playbook, String stage, OnboardingStep step, Set<String> fields) {
    require(step.getType() != null, "Step type is required");
    if (step.getType() == OnboardingCheckType.APPROVAL) {
      require(
          !OnboardingLifecycle.isCreation(playbook.getOnboarding(), stage),
          "Approvals require an existing asset");
      require(
          step.getWorkflow() != null && step.getWorkflow().getId() != null,
          "Select an approval workflow");
      workflow(step);
      require(step.getAssignment() == null, "Approval assignments come from the workflow");
    } else {
      require(
          step.getFieldPath() != null && fields.add(step.getFieldPath()),
          "A field can be captured only once");
      validatePath(playbook.getEntityType().value(), step.getFieldPath());
      require(
          OnboardingLifecycle.isCreation(playbook.getOnboarding(), stage)
              || !CREATION_FIELDS
                  .get(playbook.getEntityType().value())
                  .contains(step.getFieldPath()),
          "Schema-required fields must remain at Creation");
      if (creationFields(playbook.getEntityType().value()).contains(step.getFieldPath())) {
        require(step.getConditions().isEmpty(), "Schema-required fields cannot be conditional");
      }
    }
    if (step.getRules() != null) {
      require(
          step.getRules().getMinLength() == null || step.getRules().getMinLength() > 0,
          "Minimum length must be positive");
      require(
          step.getRules().getMinItems() == null || step.getRules().getMinItems() > 0,
          "Minimum count must be positive");
    }
    for (var condition : step.getConditions()) {
      require(
          condition != null && condition.getFieldPath() != null && condition.getOperator() != null,
          "Conditions require a field and operator");
      validatePath(playbook.getEntityType().value(), condition.getFieldPath());
      require(
          !VALUED_OPERATORS.contains(condition.getOperator()) || hasText(condition.getValue()),
          "A '" + condition.getOperator().value() + "' condition needs a value to compare");
    }
  }

  private static void validatePath(String type, String path) {
    require(path != null && !path.isBlank(), "Select an entity field");
    if (path.startsWith(EXTENSION_PREFIX)) {
      require(
          TypeRegistry.instance().getSchema(type, path.substring(EXTENSION_PREFIX.length()))
              != null,
          "Custom property does not exist: " + path);
      return;
    }
    require(
        !SYSTEM_FIELDS.contains(path.split("\\.")[0]),
        "System fields cannot be onboarding requirements");
    Class<?> valueType = Entity.getEntityRepository(type).getEntityClass();
    try {
      for (String segment : path.split("\\.")) {
        require(!segment.isBlank(), "Invalid field path: " + path);
        valueType =
            valueType
                .getMethod("get" + Character.toUpperCase(segment.charAt(0)) + segment.substring(1))
                .getReturnType();
      }
    } catch (NoSuchMethodException missingField) {
      throw new IllegalArgumentException("Unknown onboarding field: " + path);
    }
  }

  public static WorkflowDefinition workflow(OnboardingStep step) {
    return workflow(step, OnboardingReadContext.DIRECT);
  }

  static WorkflowDefinition workflow(OnboardingStep step, OnboardingReadContext reads) {
    WorkflowDefinition workflow =
        (WorkflowDefinition)
            reads.entity(
                new EntityReference()
                    .withType(Entity.WORKFLOW_DEFINITION)
                    .withId(step.getWorkflow().getId()),
                "*");
    require(
        Boolean.TRUE.equals(workflow.getDeployed())
            && !Boolean.TRUE.equals(workflow.getSuspended()),
        "Approval workflow must be deployed and active");
    var json = JsonUtils.valueToTree(workflow);
    require(
        "noOp".equals(json.path("trigger").path("type").asText()),
        "Select a task workflow with a manual trigger");
    require(
        workflow.getNodes().stream()
            .anyMatch(
                node ->
                    USER_APPROVAL_TASK.equals(JsonUtils.valueToTree(node).path(SUB_TYPE).asText())),
        "Workflow must contain an approval task");
    require(
        !setsEntityStatus(workflow),
        "Onboarding workflows must record decisions without changing entity status");
    return workflow;
  }

  /**
   * The workflow a gate hands off to. It is the mirror image of a per-step approval workflow: a
   * step's workflow records one decision and must leave the asset's status alone, while the gate's
   * workflow is the only thing allowed to move the asset on. A gate pointing at a workflow with no
   * status-setting node would pass and then strand every asset behind it, so that is rejected at
   * publish time rather than discovered in production.
   */
  private static void validateHandoff(OnboardingPlaybook playbook, OnboardingGate gate) {
    EntityReference reference = gate.getHandoffWorkflow();
    if (reference == null) return;
    require(
        OnboardingLifecycle.next(playbook.getOnboarding(), gate.getStage()) != null,
        "Stage '" + gate.getStage() + "' has no next stage to hand off to");
    WorkflowDefinition workflow = resolveHandoff(reference);
    require(
        Boolean.TRUE.equals(workflow.getDeployed())
            && !Boolean.TRUE.equals(workflow.getSuspended()),
        "Handoff workflow '" + workflow.getName() + "' must be deployed and active");
    require(
        setsEntityStatus(workflow),
        "Handoff workflow '"
            + workflow.getName()
            + "' never sets the asset's status, so assets would never leave "
            + gate.getStage());
  }

  /** Resolve the reference and complete it in place: the handoff is started by fully qualified name. */
  private static WorkflowDefinition resolveHandoff(EntityReference reference) {
    WorkflowDefinition workflow = findWorkflow(reference);
    reference
        .withId(workflow.getId())
        .withType(Entity.WORKFLOW_DEFINITION)
        .withName(workflow.getName())
        .withFullyQualifiedName(workflow.getFullyQualifiedName())
        .withDisplayName(workflow.getDisplayName());
    return workflow;
  }

  private static WorkflowDefinition findWorkflow(EntityReference reference) {
    String name =
        reference.getFullyQualifiedName() == null
            ? reference.getName()
            : reference.getFullyQualifiedName();
    try {
      return reference.getId() != null
          ? Entity.getEntity(
              Entity.WORKFLOW_DEFINITION, reference.getId(), "*", Include.NON_DELETED, false)
          : Entity.getEntityByName(
              Entity.WORKFLOW_DEFINITION, name, "*", Include.NON_DELETED, false);
    } catch (EntityNotFoundException missingWorkflow) {
      throw new IllegalArgumentException(
          "Handoff workflow does not exist: "
              + (reference.getId() == null ? name : reference.getId()));
    }
  }

  private static boolean setsEntityStatus(WorkflowDefinition workflow) {
    return workflow.getNodes().stream()
        .map(JsonUtils::valueToTree)
        .anyMatch(OnboardingConfigurationValidator::setsStatus);
  }

  private static boolean setsStatus(JsonNode node) {
    String subType = node.path(SUB_TYPE).asText();
    if (GLOSSARY_STATUS_TASK.equals(subType)) return true;
    return SET_ATTRIBUTE_TASK.equals(subType)
        && STATUS_FIELDS.contains(node.path("config").path("fieldName").asText());
  }

  /**
   * A gate that chases people must know who to tell and who to hand the work to. Reassigning to the
   * creator is rejected: the creator is who stopped responding.
   */
  private static void validateStallPolicies(OnboardingPlaybook playbook, OnboardingGate gate) {
    if (OnboardingGates.notifiesOnStall(gate)) {
      require(
          !nullOrEmpty(playbook.getOwners()),
          "Give the playbook an owner before it can report stalled onboarding");
    }
    if (!OnboardingGates.reassignsOnStall(gate)) return;
    OnboardingAssignment role = gate.getReassignOnStall().getRole();
    require(role != null && role.getRole() != null, "Choose who stalled work is reassigned to");
    require(
        role.getRole() != OnboardingAssignment.Role.CREATOR,
        "Stalled work cannot be reassigned to the creator it is already waiting on");
    require(
        role.getRole() != OnboardingAssignment.Role.EXPLICIT || !nullOrEmpty(role.getAssignees()),
        "Name the users or teams stalled work is reassigned to");
  }

  private static boolean hasText(Object value) {
    return value instanceof String text && !text.isBlank();
  }

  private static void require(boolean valid, String message) {
    if (!valid) throw new IllegalArgumentException(message);
  }

  private static <T> List<T> listOrEmpty(List<T> list) {
    return list == null ? List.of() : list;
  }
}
