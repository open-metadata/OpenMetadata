package org.openmetadata.service.governance.onboarding;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.workflows.WorkflowDefinition;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.IntakeFormUtil;

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

  private OnboardingConfigurationValidator() {}

  public static Set<String> creationFields(String type) {
    return CREATION_FIELDS.getOrDefault(type, Set.of());
  }

  public static void validate(IntakeForm form) {
    if (form.getOnboarding() == null) return;
    require(form.getOnboarding().getGates() != null, "Onboarding gates are required");
    normalizeCustomPaths(form);
    Set<String> fieldPaths = new HashSet<>();
    for (var field : IntakeFormUtil.getEffectiveFormFields(form)) {
      validatePath(form.getEntityType().value(), field.getFieldPath());
      require(fieldPaths.add(field.getFieldPath()), "Each intake field must be defined once");
    }
    Set<String> ids = new HashSet<>();
    Set<String> fields = new HashSet<>();
    Set<OnboardingStage> stages = new HashSet<>();
    for (var gate : form.getOnboarding().getGates()) {
      require(gate != null && gate.getSteps() != null, "Gate steps are required");
      require(gate.getStage() != null && stages.add(gate.getStage()), "Each stage must occur once");
      require(
          gate.getStage().ordinal() < OnboardingStage.APPROVED.ordinal()
              || gate.getSteps().isEmpty(),
          "Approved completes onboarding and cannot contain checks");
      for (var step : gate.getSteps()) {
        require(step != null, "A check definition is required");
        if (step.getConditions() == null) step.setConditions(List.of());
        require(
            step.getId() != null
                && step.getId().matches("[a-zA-Z0-9_-]{1,64}")
                && ids.add(step.getId()),
            "Step IDs must be unique");
        validateStep(form, gate.getStage(), step, fields);
      }
    }
    Set<String> resolvedIds = new HashSet<>();
    for (var stage : OnboardingEvaluator.STAGES) {
      for (var step : OnboardingEvaluator.steps(form, stage)) {
        require(resolvedIds.add(step.getId()), "Step IDs must be unique including Creation checks");
      }
    }
  }

  private static void normalizeCustomPaths(IntakeForm form) {
    Map<String, String> paths = new HashMap<>();
    for (var field : IntakeFormUtil.getEffectiveFormFields(form)) {
      if (field.getFieldKind() == IntakeFormField.FieldKind.CUSTOM_PROPERTY
          && field.getFieldPath() != null
          && !field.getFieldPath().startsWith("extension.")) {
        String original = field.getFieldPath();
        field.setFieldPath("extension." + original);
        paths.put(original, field.getFieldPath());
      }
    }
    for (var gate : form.getOnboarding().getGates()) {
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
    IntakeFormUtil.synchronizeFields(form);
  }

  private static void validateStep(
      IntakeForm form, OnboardingStage stage, OnboardingStep step, Set<String> fields) {
    require(step.getType() != null, "Step type is required");
    if (step.getType() == OnboardingStep.Type.APPROVAL) {
      require(stage != OnboardingStage.CREATION, "Approvals require an existing asset");
      require(
          step.getWorkflow() != null && step.getWorkflow().getId() != null,
          "Select an approval workflow");
      workflow(step);
      require(step.getAssignment() == null, "Approval assignments come from the workflow");
    } else {
      require(
          step.getFieldPath() != null && fields.add(step.getFieldPath()),
          "A field can be captured only once");
      require(
          IntakeFormUtil.getEffectiveFormFields(form).stream()
              .anyMatch(field -> field.getFieldPath().equals(step.getFieldPath())),
          "Step must reference an intake field");
      require(
          stage == OnboardingStage.CREATION
              || !CREATION_FIELDS.get(form.getEntityType().value()).contains(step.getFieldPath()),
          "Schema-required fields must remain at Creation");
      if (creationFields(form.getEntityType().value()).contains(step.getFieldPath())) {
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
      validatePath(form.getEntityType().value(), condition.getFieldPath());
    }
  }

  private static void validatePath(String type, String path) {
    require(path != null && !path.isBlank(), "Select an entity field");
    if (path.startsWith("extension.")) {
      require(
          org.openmetadata.service.TypeRegistry.instance()
                  .getSchema(type, path.substring("extension.".length()))
              != null,
          "Custom property does not exist: " + path);
      return;
    }
    require(
        !Set.of(
                "id",
                "version",
                "entityStatus",
                "updatedAt",
                "updatedBy",
                "deleted",
                "href",
                "changeDescription",
                "incrementalChangeDescription",
                "fullyQualifiedName")
            .contains(path.split("\\.")[0]),
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
    org.openmetadata.service.util.RequestEntityCache.invalidate(
        Entity.WORKFLOW_DEFINITION, step.getWorkflow().getId(), null);
    WorkflowDefinition workflow =
        Entity.getEntity(
            Entity.WORKFLOW_DEFINITION,
            step.getWorkflow().getId(),
            "*",
            Include.NON_DELETED,
            false);
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
                    "userApprovalTask"
                        .equals(JsonUtils.valueToTree(node).path("subType").asText())),
        "Workflow must contain an approval task");
    require(
        workflow.getNodes().stream()
            .noneMatch(
                node ->
                    "setEntityAttributeTask"
                        .equals(JsonUtils.valueToTree(node).path("subType").asText())),
        "Onboarding workflows must record decisions without changing entity status");
    return workflow;
  }

  private static void require(boolean valid, String message) {
    if (!valid) throw new IllegalArgumentException(message);
  }
}
