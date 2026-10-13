package org.openmetadata.service.seeding;

import java.util.List;
import java.util.function.Supplier;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;

/** Builds a Health Check step from the problems found with a group of essential artifacts. */
@Slf4j
public final class EssentialSeedsStatus {

  private EssentialSeedsStatus() {}

  public static List<String> describe(EssentialSeedReport report) {
    return Stream.concat(
            report.missing().stream().map(EssentialSeedsStatus::describeMissing),
            report.failures().stream().map(EssentialSeedsStatus::describeFailure))
        .toList();
  }

  // A lookup failure fails this step only, so one card cannot take down the whole status page.
  public static StepValidation toStep(
      String description, String subject, Supplier<List<String>> problems) {
    StepValidation result;
    try {
      result = fromProblems(description, subject, problems.get());
    } catch (RuntimeException e) {
      LOG.error("Could not verify {}", subject, e);
      result =
          new StepValidation()
              .withDescription(description)
              .withPassed(Boolean.FALSE)
              .withMessage("Could not verify " + subject + ".");
    }
    return result;
  }

  // Lines carry type and name only: /system/status is readable by any authenticated user, and
  // seeding or decryption errors can name secret paths and KMS failures.
  private static StepValidation fromProblems(
      String description, String subject, List<String> problems) {
    boolean healthy = problems.isEmpty();
    return new StepValidation()
        .withDescription(description)
        .withPassed(healthy)
        .withMessage(healthy ? "All " + subject + " are healthy." : String.join("\n", problems));
  }

  private static String describeMissing(MissingArtifact missing) {
    return "Missing: " + missing.entityType() + " " + missing.name();
  }

  private static String describeFailure(SeedFailure failure) {
    return "Failed to set up: " + failure.entityType() + " " + failure.item();
  }
}
