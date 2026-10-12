package org.openmetadata.service.seeding;

import java.util.List;

/** System bots and agents that are missing now, and failures setting them up since startup. */
public record EssentialSeedReport(List<MissingArtifact> missing, List<SeedFailure> failures) {

  public record MissingArtifact(String entityType, String name) {}

  public record SeedFailure(String entityType, String item, String error) {}

  public EssentialSeedReport {
    missing = List.copyOf(missing);
    failures = List.copyOf(failures);
  }

  public boolean isHealthy() {
    return missing.isEmpty() && failures.isEmpty();
  }
}
