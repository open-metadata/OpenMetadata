package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.governance.OnboardingPlaybook;
import org.openmetadata.schema.entity.governance.PlaybookEntityType;
import org.openmetadata.schema.governance.onboarding.OnboardingCheckType;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingGate;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.governance.onboarding.OnboardingStep;
import org.openmetadata.schema.type.EntityReference;

class OnboardingTasksTest {
  @Test
  void changingOrderedCustomValuesInvalidatesTheReviewedSnapshot() {
    var instance = instance();
    var metric =
        new Metric().withName("metric").withExtension(Map.of("sequence", List.of("from", "to")));
    String reviewed = OnboardingFingerprint.of(instance, metric);
    metric.setExtension(Map.of("sequence", List.of("to", "from")));
    assertNotEquals(reviewed, OnboardingFingerprint.of(instance, metric));
  }

  @Test
  void relationshipHydrationAndOrderDoNotInvalidateTheReviewedSnapshot() {
    var first = new EntityReference().withId(UUID.randomUUID()).withType("user").withName("first");
    var second =
        new EntityReference().withId(UUID.randomUUID()).withType("team").withName("second");
    var instance = instance();
    var metric = new Metric().withName("metric").withOwners(List.of(first, second));
    String reviewed = OnboardingFingerprint.of(instance, metric);
    first.setDisplayName("A new display name");
    metric.setOwners(List.of(second, first));
    assertEquals(reviewed, OnboardingFingerprint.of(instance, metric));
  }

  /**
   * The five check types arrived after this code was written, and everything that was not an
   * attribute fell through to the approval path - where a check with no workflow failed with a raw
   * NullPointerException on the asset page. Only an approval consults a workflow.
   */
  @Test
  void everyCheckExceptAnApprovalIsSatisfiedByAValueOnTheAsset() {
    for (OnboardingCheckType type : OnboardingCheckType.values()) {
      var step = new OnboardingStep().withId(type.value()).withType(type).withFieldPath("owners");

      assertEquals(
          type != OnboardingCheckType.APPROVAL,
          OnboardingTasks.isFieldCheck(step),
          type.value()
              + " should "
              + (type == OnboardingCheckType.APPROVAL ? "not " : "")
              + "be a field check");
    }
  }

  private OnboardingInstance instance() {
    return new OnboardingInstance()
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("metric"))
        .withConfiguration(
            new OnboardingPlaybook()
                .withEntityType(PlaybookEntityType.METRIC)
                .withOnboarding(
                    new OnboardingConfiguration()
                        .withEnabled(true)
                        .withGates(
                            List.of(
                                new OnboardingGate()
                                    .withStage("draft")
                                    .withSteps(
                                        List.of(
                                            new OnboardingStep()
                                                .withId("sequence")
                                                .withType(OnboardingCheckType.ATTRIBUTE)
                                                .withFieldPath("extension.sequence")))))));
  }
}
