package org.openmetadata.service.governance.onboarding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.governance.onboarding.OnboardingCondition;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult.State;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.IntakeFormUtil;

public final class OnboardingEvaluator {
  public static final List<OnboardingStage> STAGES =
      List.of(
          OnboardingStage.CREATION,
          OnboardingStage.DRAFT,
          OnboardingStage.IN_REVIEW,
          OnboardingStage.APPROVED,
          OnboardingStage.DEPRECATED);
  public static final Set<String> ENTITY_TYPES =
      Set.of("dataProduct", "domain", "glossaryTerm", "metric");

  private OnboardingEvaluator() {}

  public static boolean isEnabled(IntakeForm form) {
    return form != null
        && !Boolean.FALSE.equals(form.getEnabled())
        && form.getOnboarding() != null
        && Boolean.TRUE.equals(form.getOnboarding().getEnabled());
  }

  public static List<OnboardingStepResult> evaluate(
      IntakeForm form, Object entity, OnboardingStage stage) {
    JsonNode values = JsonUtils.valueToTree(entity);
    return steps(form, stage).stream()
        .map(step -> evaluateStep(form, step, values).withStage(stage))
        .toList();
  }

  public static List<OnboardingStepResult> evaluateThrough(
      IntakeForm form, Object entity, OnboardingStage stage) {
    return STAGES.stream()
        .filter(candidate -> candidate.ordinal() <= stage.ordinal())
        .flatMap(candidate -> evaluate(form, entity, candidate).stream())
        .toList();
  }

  public static List<OnboardingStep> steps(IntakeForm form, OnboardingStage stage) {
    List<OnboardingStep> steps = new ArrayList<>();
    if (form.getOnboarding() != null) {
      form.getOnboarding().getGates().stream()
          .filter(gate -> gate.getStage() == stage)
          .forEach(gate -> steps.addAll(gate.getSteps()));
    }
    if (stage == OnboardingStage.CREATION) {
      IntakeFormUtil.getEffectiveFormFields(form).stream()
          .filter(field -> !isScheduled(form, field.getFieldPath()))
          .map(
              field ->
                  new OnboardingStep()
                      .withId("field_" + field.getFieldPath().replace('.', '_'))
                      .withType(OnboardingStep.Type.FIELD)
                      .withFieldPath(field.getFieldPath())
                      .withTitle(field.getFieldLabel()))
          .forEach(steps::add);
      OnboardingConfigurationValidator.creationFields(form.getEntityType().value()).stream()
          .sorted()
          .filter(path -> steps.stream().noneMatch(step -> path.equals(step.getFieldPath())))
          .map(
              path ->
                  new OnboardingStep()
                      .withId("creation_" + path)
                      .withType(OnboardingStep.Type.FIELD)
                      .withFieldPath(path)
                      .withTitle(path))
          .forEach(steps::add);
    }
    return steps;
  }

  public static boolean isScheduled(IntakeForm form, String fieldPath) {
    return form.getOnboarding() != null
        && form.getOnboarding().getGates().stream()
            .flatMap(gate -> gate.getSteps().stream())
            .anyMatch(step -> fieldPath.equals(step.getFieldPath()));
  }

  private static OnboardingStepResult evaluateStep(
      IntakeForm form, OnboardingStep step, JsonNode values) {
    IntakeFormField field =
        IntakeFormUtil.getEffectiveFormFields(form).stream()
            .filter(candidate -> candidate.getFieldPath().equals(step.getFieldPath()))
            .findFirst()
            .orElse(null);
    boolean required =
        step.getType() == OnboardingStep.Type.APPROVAL
            || (field != null && Boolean.TRUE.equals(field.getRequired()));
    boolean intrinsic =
        step.getFieldPath() != null
            && OnboardingConfigurationValidator.creationFields(form.getEntityType().value())
                .contains(step.getFieldPath());
    required |= intrinsic;
    if (field == null && intrinsic) {
      field =
          new IntakeFormField()
              .withFieldPath(step.getFieldPath())
              .withFieldLabel(step.getTitle())
              .withFieldKind(IntakeFormField.FieldKind.NATIVE)
              .withRequired(true);
    }
    var result = new OnboardingStepResult().withStep(step).withField(field).withRequired(required);
    if (!intrinsic
        && !step.getConditions().stream().allMatch(condition -> matches(values, condition))) {
      return result.withState(State.NOT_APPLICABLE);
    }
    if (step.getType() == OnboardingStep.Type.APPROVAL) {
      return result.withState(State.PENDING).withMessage("Workflow approval is required");
    }
    String error = validateValue(valueAt(values, step.getFieldPath()), step);
    return result
        .withState(error == null ? State.COMPLETE : State.PENDING)
        .withMessage(
            error == null
                ? null
                : field != null && field.getErrorMessage() != null
                    ? field.getErrorMessage()
                    : error);
  }

  private static String validateValue(JsonNode value, OnboardingStep step) {
    if (!hasValue(value)) return "A value is required";
    if (step.getRules() == null) return null;
    Integer minimumLength = step.getRules().getMinLength();
    Integer minimumItems = step.getRules().getMinItems();
    if (minimumLength != null
        && (!value.isTextual() || value.asText().trim().length() < minimumLength)) {
      return "At least " + minimumLength + " characters are required";
    }
    if (minimumItems != null && (!value.isArray() || value.size() < minimumItems)) {
      return "At least " + minimumItems + " values are required";
    }
    return null;
  }

  public static JsonNode valueAt(JsonNode values, String path) {
    if (path == null || path.isBlank()) return MissingNode.getInstance();
    JsonNode current = values;
    for (String segment : path.split("\\.")) current = current.path(segment);
    return current;
  }

  public static boolean hasValue(JsonNode value) {
    return value != null
        && !value.isNull()
        && !value.isMissingNode()
        && (!value.isTextual() || !value.asText().isBlank())
        && (!value.isContainerNode() || !value.isEmpty());
  }

  public static boolean matches(JsonNode values, OnboardingCondition condition) {
    JsonNode value = valueAt(values, condition.getFieldPath());
    JsonNode expected = JsonUtils.valueToTree(condition.getValue());
    return switch (condition.getOperator()) {
      case PRESENT -> hasValue(value);
      case EQUALS -> value.equals(expected);
      case CONTAINS -> contains(value, expected);
    };
  }

  private static boolean contains(JsonNode value, JsonNode expected) {
    if (value.isTextual())
      return expected.isTextual() && value.asText().contains(expected.asText());
    if (!value.isArray()) return false;
    for (JsonNode item : value) {
      if (item.equals(expected)
          || item.path("id").equals(expected)
          || item.path("fullyQualifiedName").equals(expected)
          || item.path("tagFQN").equals(expected)) return true;
    }
    return false;
  }

  public static boolean isSatisfied(OnboardingStepResult result) {
    return result.getState() == State.COMPLETE || result.getState() == State.NOT_APPLICABLE;
  }

  public static OnboardingStage stageFor(EntityStatus status) {
    if (status == EntityStatus.IN_REVIEW) return OnboardingStage.IN_REVIEW;
    if (status == EntityStatus.APPROVED) return OnboardingStage.APPROVED;
    if (status == EntityStatus.DEPRECATED) return OnboardingStage.DEPRECATED;
    return OnboardingStage.DRAFT;
  }

  public static EntityStatus nextStatus(OnboardingStage stage) {
    return switch (stage) {
      case CREATION -> EntityStatus.DRAFT;
      case DRAFT -> EntityStatus.IN_REVIEW;
      case IN_REVIEW -> EntityStatus.APPROVED;
      case APPROVED -> EntityStatus.DEPRECATED;
      case DEPRECATED -> null;
    };
  }
}
