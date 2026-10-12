package org.openmetadata.service.seeding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;

class EssentialSeedsStatusTest {

  @Test
  void passesWhenThereAreNoProblems() {
    StepValidation step = EssentialSeedsStatus.toStep("desc", "system bots", List::of);
    assertTrue(step.getPassed());
    assertEquals("All system bots are healthy.", step.getMessage());
    assertEquals("desc", step.getDescription());
  }

  @Test
  void failsOnlyThisStepWhenProblemsCannotBeBuilt() {
    StepValidation step =
        EssentialSeedsStatus.toStep(
            "desc",
            "system bots",
            () -> {
              throw new IllegalStateException("connection pool exhausted");
            });
    assertFalse(step.getPassed());
    assertEquals("Could not verify system bots.", step.getMessage());
  }

  @Test
  void listsProblemsOnePerLine() {
    StepValidation step =
        EssentialSeedsStatus.toStep("desc", "system bots", () -> List.of("a", "b"));
    assertFalse(step.getPassed());
    assertEquals("a\nb", step.getMessage());
  }

  @Test
  void describesMissingThenFailuresWithoutErrorText() {
    EssentialSeedReport report =
        new EssentialSeedReport(
            List.of(new MissingArtifact("bot", "AIAutomationApplicationBot")),
            List.of(
                new SeedFailure("user", "automatorapplicationbot", "Encryption key not found.")));
    assertEquals(
        List.of(
            "Missing: bot AIAutomationApplicationBot",
            "Failed to set up: user automatorapplicationbot"),
        EssentialSeedsStatus.describe(report));
  }
}
