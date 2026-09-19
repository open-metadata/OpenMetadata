package org.openmetadata.service.governance.onboarding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.governance.onboarding.OnboardingConfiguration;
import org.openmetadata.schema.governance.onboarding.OnboardingStageDefinition;
import org.openmetadata.schema.type.EntityStatus;

class OnboardingLifecycleTest {

  /**
   * status.json defaults every generated EntityStatus to Unprocessed, so a playbook that declares
   * the standard stages by key alone deserialises with Unprocessed on every stage. Those stages must
   * still map the statuses a handoff workflow sets back to the right stage.
   */
  @Test
  void declaredStagesWithoutStatusesStillMapStatusesByKey() {
    var configuration =
        new OnboardingConfiguration()
            .withStages(
                List.of(
                    stage("creation", 0).withEntryStage(true),
                    stage("draft", 1),
                    stage("inReview", 2),
                    stage("approved", 3),
                    stage("published", 4),
                    stage("deprecated", 5).withTerminal(true)));

    assertEquals("inReview", OnboardingLifecycle.stageFor(configuration, EntityStatus.IN_REVIEW));
    assertEquals("approved", OnboardingLifecycle.stageFor(configuration, EntityStatus.APPROVED));
    assertEquals("draft", OnboardingLifecycle.stageFor(configuration, EntityStatus.UNPROCESSED));
    assertEquals("draft", OnboardingLifecycle.stageFor(configuration, null));
  }

  @Test
  void anExplicitStatusWinsOverTheDefaultForTheSameKey() {
    var configuration =
        new OnboardingConfiguration()
            .withStages(
                List.of(
                    stage("creation", 0).withEntryStage(true),
                    stage("draft", 1),
                    stage("inReview", 2).withEntityStatus(EntityStatus.APPROVED)));

    assertEquals("inReview", OnboardingLifecycle.stageFor(configuration, EntityStatus.APPROVED));
    assertNull(
        OnboardingLifecycle.entityStatus(
            stage("custom", 9).withEntityStatus(EntityStatus.UNPROCESSED)));
  }

  private static OnboardingStageDefinition stage(String key, int order) {
    return new OnboardingStageDefinition()
        .withKey(key)
        .withOrder(order)
        .withEntityStatus(EntityStatus.UNPROCESSED);
  }
}
