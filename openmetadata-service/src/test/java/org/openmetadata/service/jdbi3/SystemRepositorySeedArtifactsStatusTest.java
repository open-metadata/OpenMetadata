package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.seeding.EssentialSeedReport;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;

class SystemRepositorySeedArtifactsStatusTest {

  @Test
  void passesWhenHealthy() {
    StepValidation step =
        SystemRepository.buildSeedArtifactsStepValidation(
            new EssentialSeedReport(List.of(), List.of()));
    assertTrue(step.getPassed());
    assertEquals("All system bots and agents are present.", step.getMessage());
  }

  @Test
  void failsOnlyThisStepWhenTheReportCannotBeBuilt() {
    StepValidation step =
        SystemRepository.seedArtifactsValidation(
            () -> {
              throw new IllegalStateException("connection pool exhausted");
            });
    assertFalse(step.getPassed());
    assertEquals("Could not verify system bots and agents.", step.getMessage());
  }

  @Test
  void listsMissingThenFailuresWithoutErrorText() {
    EssentialSeedReport report =
        new EssentialSeedReport(
            List.of(new MissingArtifact("bot", "AIAutomationApplicationBot")),
            List.of(
                new SeedFailure("user", "automatorapplicationbot", "Encryption key not found.")));
    StepValidation step = SystemRepository.buildSeedArtifactsStepValidation(report);
    assertFalse(step.getPassed());
    assertEquals(
        """
        Missing: bot AIAutomationApplicationBot
        Failed to set up: user automatorapplicationbot""",
        step.getMessage());
  }
}
