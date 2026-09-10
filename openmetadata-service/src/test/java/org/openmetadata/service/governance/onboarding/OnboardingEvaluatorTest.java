package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.governance.onboarding.OnboardingStage;
import org.openmetadata.schema.utils.JsonUtils;

class OnboardingEvaluatorTest {
  private static final IntakeForm FORM =
      JsonUtils.readValue(
          """
      {"name":"metric","entityType":"metric","enabled":true,
       "formFields":[{"fieldPath":"displayName","fieldLabel":"Display name","fieldKind":"native","required":true},
                     {"fieldPath":"extension.purpose","fieldLabel":"Purpose","fieldKind":"customProperty","required":true}],
       "onboarding":{"enabled":true,"gates":[{"stage":"Draft","steps":[
         {"id":"purpose","type":"field","fieldPath":"extension.purpose","rules":{"minLength":10}}
       ]}]}}
      """,
          IntakeForm.class);

  @Test
  void creationDoesNotRequireFieldsScheduledForDraft() {
    var results =
        OnboardingEvaluator.evaluate(
            FORM, Map.of("name", "orders", "displayName", "Orders"), OnboardingStage.CREATION);
    assertTrue(results.stream().allMatch(OnboardingEvaluator::isSatisfied));
  }

  @Test
  void draftGateEvaluatesTheStoredCustomPropertyRule() {
    var missing =
        OnboardingEvaluator.evaluate(FORM, Map.of("displayName", "Orders"), OnboardingStage.DRAFT);
    assertTrue(
        missing.stream()
            .anyMatch(result -> result.getRequired() && !OnboardingEvaluator.isSatisfied(result)));
    var complete =
        OnboardingEvaluator.evaluate(
            FORM,
            Map.of(
                "displayName",
                "Orders",
                "extension",
                Map.of("purpose", "Measures fulfilled orders")),
            OnboardingStage.DRAFT);
    assertTrue(complete.stream().allMatch(OnboardingEvaluator::isSatisfied));
  }

  @Test
  void zeroAndFalseAreMeaningfulValues() {
    assertTrue(OnboardingEvaluator.hasValue(JsonUtils.valueToTree(0)));
    assertTrue(OnboardingEvaluator.hasValue(JsonUtils.valueToTree(false)));
    assertFalse(OnboardingEvaluator.hasValue(JsonUtils.valueToTree("  ")));
    assertFalse(OnboardingEvaluator.hasValue(JsonUtils.valueToTree(List.of())));
  }

  @Test
  void absentStepAssignmentDefaultsToCreation() {
    var results = OnboardingEvaluator.evaluate(FORM, Map.of(), OnboardingStage.CREATION);
    assertEquals(2, results.size());
    assertEquals("displayName", results.getFirst().getStep().getFieldPath());
    assertFalse(OnboardingEvaluator.isSatisfied(results.getFirst()));
  }

  @Test
  void conditionsMatchHydratedTagsDomainsAndTypedCustomValues() {
    var entity =
        JsonUtils.valueToTree(
            Map.of(
                "tags",
                List.of(Map.of("tagFQN", "PII.Sensitive")),
                "domains",
                List.of(Map.of("id", "domain-id", "fullyQualifiedName", "Finance")),
                "extension",
                Map.of("regulated", false)));
    for (String condition :
        List.of(
            "{\"fieldPath\":\"tags\",\"operator\":\"contains\",\"value\":\"PII.Sensitive\"}",
            "{\"fieldPath\":\"domains\",\"operator\":\"contains\",\"value\":\"domain-id\"}",
            "{\"fieldPath\":\"domains\",\"operator\":\"contains\",\"value\":\"Finance\"}",
            "{\"fieldPath\":\"extension.regulated\",\"operator\":\"equals\",\"value\":false}")) {
      assertTrue(
          OnboardingEvaluator.matches(
              entity,
              JsonUtils.readValue(
                  condition,
                  org.openmetadata.schema.governance.onboarding.OnboardingCondition.class)));
    }
    assertFalse(
        OnboardingEvaluator.matches(
            entity,
            JsonUtils.readValue(
                "{\"fieldPath\":\"domains\",\"operator\":\"contains\",\"value\":\"Marketing\"}",
                org.openmetadata.schema.governance.onboarding.OnboardingCondition.class)));
  }
}
