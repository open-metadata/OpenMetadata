package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.utils.JsonUtils;

class OnboardingEvaluatorTest {
  private static final OnboardingPlaybook FORM =
      JsonUtils.readValue(
          """
      {"name":"metricPlaybook","entityType":"metric",
       "onboarding":{"enabled":true,"gates":[
         {"stage":"creation","steps":[
           {"id":"displayName","type":"attribute","requirement":"blocking","fieldPath":"displayName","title":"Display name"}
         ]},
         {"stage":"draft","steps":[
           {"id":"purpose","type":"attribute","requirement":"blocking","fieldPath":"extension.purpose","rules":{"minLength":10}}
         ]}]}}
      """,
          OnboardingPlaybook.class);

  @Test
  void creationDoesNotRequireFieldsScheduledForDraft() {
    var results =
        OnboardingEvaluator.evaluate(
            FORM, Map.of("name", "orders", "displayName", "Orders"), OnboardingLifecycle.CREATION);
    assertTrue(results.stream().allMatch(OnboardingEvaluator::isSatisfied));
  }

  @Test
  void draftGateEvaluatesTheStoredCustomPropertyRule() {
    var missing =
        OnboardingEvaluator.evaluate(
            FORM, Map.of("displayName", "Orders"), OnboardingLifecycle.DRAFT);
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
            OnboardingLifecycle.DRAFT);
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
    var results = OnboardingEvaluator.evaluate(FORM, Map.of(), OnboardingLifecycle.CREATION);
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

  /**
   * "PII tags present" is a statement about a classification, not about one tag. Without a prefix
   * match a playbook would have to list every tag under PII and would silently miss new ones.
   */
  @Test
  void aPrefixMatchesAWholeTagClassificationWithoutMatchingASimilarlyNamedOne() {
    var tagged = JsonUtils.valueToTree(Map.of("tags", List.of(Map.of("tagFQN", "PII.Sensitive"))));
    var similar = JsonUtils.valueToTree(Map.of("tags", List.of(Map.of("tagFQN", "NonPII.Public"))));

    assertTrue(OnboardingEvaluator.matches(tagged, startsWith("tags", "PII.")));
    assertFalse(OnboardingEvaluator.matches(similar, startsWith("tags", "PII.")));
  }

  @Test
  void aPrefixMatchesText() {
    var entity = JsonUtils.valueToTree(Map.of("name", "finance_orders"));

    assertTrue(OnboardingEvaluator.matches(entity, startsWith("name", "finance_")));
    assertFalse(OnboardingEvaluator.matches(entity, startsWith("name", "marketing_")));
  }

  @Test
  void aCheckWithNoStatedRequirementBlocksTheGate() {
    var step =
        JsonUtils.readValue(
            "{\"id\":\"terms\",\"type\":\"attribute\",\"fieldPath\":\"description\"}",
            org.openmetadata.schema.governance.onboarding.OnboardingStep.class);

    assertTrue(OnboardingEvaluator.isBlocking(step));
  }

  private org.openmetadata.schema.governance.onboarding.OnboardingCondition startsWith(
      String fieldPath, String value) {
    return JsonUtils.readValue(
        String.format(
            "{\"fieldPath\":\"%s\",\"operator\":\"startsWith\",\"value\":\"%s\"}",
            fieldPath, value),
        org.openmetadata.schema.governance.onboarding.OnboardingCondition.class);
  }
}
