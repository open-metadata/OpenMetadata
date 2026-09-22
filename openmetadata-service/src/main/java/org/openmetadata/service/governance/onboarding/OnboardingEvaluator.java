package org.openmetadata.service.governance.onboarding;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.MissingNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingCondition;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingRequirement;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult;
import org.openmetadata.schema.governance.onboarding.OnboardingStepResult.State;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Evaluates a playbook's checks against an asset. This answers "what is still outstanding at this
 * gate" - it never decides what the asset's status should become. Passing a gate hands off to the
 * gate's workflow (see {@link OnboardingHandoff}), which owns the decision and the status change.
 */
public final class OnboardingEvaluator {
  public static final Set<String> ENTITY_TYPES =
      Set.of("dataProduct", "domain", "glossaryTerm", "metric");

  private static final List<String> PREFIX_MATCHED_FIELDS =
      List.of("tagFQN", "fullyQualifiedName", "name");

  private OnboardingEvaluator() {}

  public static boolean isEnabled(OnboardingPlaybook playbook) {
    return playbook != null
        && playbook.getOnboarding() != null
        && Boolean.TRUE.equals(playbook.getOnboarding().getEnabled());
  }

  public static List<OnboardingStepResult> evaluate(
      OnboardingPlaybook playbook, Object entity, String stage) {
    JsonNode values = JsonUtils.valueToTree(entity);
    return steps(playbook, stage).stream()
        .map(step -> evaluateStep(playbook, step, values).withStage(stage))
        .toList();
  }

  public static List<OnboardingStepResult> evaluateThrough(
      OnboardingPlaybook playbook, Object entity, String stage) {
    OnboardingConfiguration configuration = configurationOf(playbook);
    int target = OnboardingLifecycle.indexOf(configuration, stage);
    return OnboardingLifecycle.stageKeys(configuration).stream()
        .filter(candidate -> OnboardingLifecycle.indexOf(configuration, candidate) <= target)
        .flatMap(candidate -> evaluate(playbook, entity, candidate).stream())
        .toList();
  }

  /**
   * Checks due at a stage. Creation additionally carries the asset type's schema-required fields:
   * the API refuses to create the asset without them whether or not the playbook author listed them.
   */
  public static List<OnboardingStep> steps(OnboardingPlaybook playbook, String stage) {
    List<OnboardingStep> steps = new ArrayList<>();
    OnboardingConfiguration configuration = configurationOf(playbook);
    if (configuration != null) {
      configuration.getGates().stream()
          .filter(gate -> stage.equals(gate.getStage()))
          .forEach(gate -> steps.addAll(gate.getSteps()));
    }
    if (OnboardingLifecycle.isCreation(configuration, stage)) {
      OnboardingConfigurationValidator.creationFields(playbook.getEntityType().value()).stream()
          .sorted()
          .filter(path -> steps.stream().noneMatch(step -> path.equals(step.getFieldPath())))
          .map(
              path ->
                  new OnboardingStep()
                      .withId("creation_" + path)
                      .withType(OnboardingCheckType.ATTRIBUTE)
                      .withRequirement(OnboardingRequirement.BLOCKING)
                      .withFieldPath(path)
                      .withTitle(path))
          .forEach(steps::add);
    }
    return steps;
  }

  /** True when the playbook already asks for this field at some gate - a field is asked for once. */
  public static boolean isScheduled(OnboardingPlaybook playbook, String fieldPath) {
    OnboardingConfiguration configuration = configurationOf(playbook);
    return configuration != null
        && configuration.getGates().stream()
            .flatMap(gate -> gate.getSteps().stream())
            .anyMatch(step -> fieldPath.equals(step.getFieldPath()));
  }

  private static OnboardingStepResult evaluateStep(
      OnboardingPlaybook playbook, OnboardingStep step, JsonNode values) {
    boolean intrinsic =
        step.getFieldPath() != null
            && OnboardingConfigurationValidator.creationFields(playbook.getEntityType().value())
                .contains(step.getFieldPath());
    boolean required = intrinsic || isBlocking(step);
    var result =
        new OnboardingStepResult()
            .withStep(step)
            .withField(describe(step, intrinsic))
            .withRequired(required);
    if (!intrinsic
        && !step.getConditions().stream().allMatch(condition -> matches(values, condition))) {
      return result.withState(State.NOT_APPLICABLE);
    }
    if (step.getType() == OnboardingCheckType.APPROVAL) {
      return result.withState(State.PENDING).withMessage("Workflow approval is required");
    }
    String error = validateValue(valueAt(values, step.getFieldPath()), step);
    return result.withState(error == null ? State.COMPLETE : State.PENDING).withMessage(error);
  }

  /**
   * Display descriptor for the check. The check itself is the source of truth now that the Creation
   * gate replaces the intake form, so this is derived rather than looked up.
   */
  private static IntakeFormField describe(OnboardingStep step, boolean intrinsic) {
    if (step.getFieldPath() == null) return null;
    return new IntakeFormField()
        .withFieldPath(step.getFieldPath())
        .withFieldLabel(step.getTitle() == null ? step.getFieldPath() : step.getTitle())
        .withFieldKind(
            step.getFieldPath().startsWith("extension.")
                ? IntakeFormField.FieldKind.CUSTOM_PROPERTY
                : IntakeFormField.FieldKind.NATIVE)
        .withRequired(intrinsic || isBlocking(step));
  }

  /**
   * The schema documents {@code blocking} as the default, but a {@code $ref} property cannot carry
   * one through code generation, so an author who never touched the field would otherwise publish a
   * gate that holds nothing back.
   */
  public static boolean isBlocking(OnboardingStep step) {
    return step.getRequirement() == null || step.getRequirement() == OnboardingRequirement.BLOCKING;
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
      case STARTS_WITH -> startsWith(value, expected);
    };
  }

  /**
   * Prefix match over text, tags and references. It is how "any PII tag" is expressed: a playbook
   * matches the classification once with {@code PII.} instead of listing every tag under it.
   */
  private static boolean startsWith(JsonNode value, JsonNode expected) {
    if (!expected.isTextual()) return false;
    String prefix = expected.asText();
    if (!value.isArray()) return hasPrefix(value, prefix);
    for (JsonNode item : value) {
      if (hasPrefix(item, prefix)) return true;
    }
    return false;
  }

  private static boolean hasPrefix(JsonNode value, String prefix) {
    if (value.isTextual()) return value.asText().startsWith(prefix);
    return PREFIX_MATCHED_FIELDS.stream()
        .map(value::path)
        .anyMatch(node -> node.isTextual() && node.asText().startsWith(prefix));
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

  /**
   * Stage the asset is in, read from the status its handoff workflow last set. Onboarding does not
   * own this mapping - the playbook declares which status each stage carries.
   */
  public static String stageFor(OnboardingPlaybook playbook, EntityStatus status) {
    return OnboardingLifecycle.stageFor(configurationOf(playbook), status);
  }

  static OnboardingConfiguration configurationOf(OnboardingPlaybook playbook) {
    return playbook == null ? null : playbook.getOnboarding();
  }
}
