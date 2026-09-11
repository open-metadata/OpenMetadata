package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.governance.CreateIntakeForm.TargetEntityType;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.governance.IntakeForm;
import org.openmetadata.schema.entity.governance.IntakeFormField;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingInstance;
import org.openmetadata.schema.type.EntityReference;

class OnboardingTasksTest {
  @Test
  void changingOrderedCustomValuesInvalidatesTheReviewedSnapshot() {
    var instance = instance();
    var metric =
        new Metric().withName("metric").withExtension(Map.of("sequence", List.of("from", "to")));
    String reviewed = OnboardingTasks.fingerprint(instance, metric);
    metric.setExtension(Map.of("sequence", List.of("to", "from")));
    assertNotEquals(reviewed, OnboardingTasks.fingerprint(instance, metric));
  }

  @Test
  void relationshipHydrationAndOrderDoNotInvalidateTheReviewedSnapshot() {
    var first = new EntityReference().withId(UUID.randomUUID()).withType("user").withName("first");
    var second =
        new EntityReference().withId(UUID.randomUUID()).withType("team").withName("second");
    var instance = instance();
    var metric = new Metric().withName("metric").withOwners(List.of(first, second));
    String reviewed = OnboardingTasks.fingerprint(instance, metric);
    first.setDisplayName("A new display name");
    metric.setOwners(List.of(second, first));
    assertEquals(reviewed, OnboardingTasks.fingerprint(instance, metric));
  }

  private OnboardingInstance instance() {
    return new OnboardingInstance()
        .withEntity(new EntityReference().withId(UUID.randomUUID()).withType("metric"))
        .withConfiguration(
            new IntakeForm()
                .withEntityType(TargetEntityType.METRIC)
                .withFormFields(
                    List.of(
                        new IntakeFormField()
                            .withFieldPath("extension.sequence")
                            .withFieldKind(IntakeFormField.FieldKind.CUSTOM_PROPERTY)))
                .withOnboarding(
                    new OnboardingConfiguration().withEnabled(true).withGates(List.of())));
  }
}
