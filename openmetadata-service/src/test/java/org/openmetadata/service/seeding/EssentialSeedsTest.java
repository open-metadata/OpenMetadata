package org.openmetadata.service.seeding;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;

class EssentialSeedsTest {

  private static EssentialSeeds withExisting(Set<String> existingNames) {
    return new EssentialSeeds((entityType, name) -> existingNames.contains(name));
  }

  private static void failWith(RuntimeException error) {
    throw error;
  }

  @AfterEach
  void resetSeedGate() {
    SeedDataGate.getInstance().reset();
  }

  @Test
  void healthyWhenEveryExpectedArtifactExists() {
    EssentialSeeds seeds = withExisting(Set.of("ingestion-bot", "AIAutomationApplicationBot"));
    seeds.register("bot", List.of("ingestion-bot", "AIAutomationApplicationBot"));
    assertTrue(seeds.report().isHealthy());
  }

  @Test
  void reportListsArtifactMissingFromDatabase() {
    EssentialSeeds seeds = withExisting(Set.of("ingestion-bot"));
    seeds.register("bot", List.of("ingestion-bot", "AIAutomationApplicationBot"));
    assertEquals(
        List.of(new MissingArtifact("bot", "AIAutomationApplicationBot")),
        seeds.report().missing());
  }

  @Test
  void seedEachContinuesPastFailures() {
    EssentialSeeds seeds = withExisting(Set.of());
    List<String> seeded = new ArrayList<>();
    seeds.seedEach(
        "bot",
        List.of("a", "bad", "c"),
        name -> name,
        name -> {
          if ("bad".equals(name)) {
            failWith(new IllegalStateException("cannot seed " + name));
          }
          seeded.add(name);
        });
    assertEquals(List.of("a", "c"), seeded);
    assertEquals(
        List.of(new SeedFailure("bot", "bad", "cannot seed bad")), seeds.report().failures());
  }

  @Test
  void failureWithoutMissingArtifactIsStillUnhealthy() {
    EssentialSeeds seeds = withExisting(Set.of("automatorapplicationbot"));
    seeds.register("user", List.of("automatorapplicationbot"));
    seeds.seedEach(
        "user",
        List.of("automatorapplicationbot"),
        name -> name,
        name -> failWith(new IllegalStateException("Encryption key not found.")));
    EssentialSeedReport report = seeds.report();
    assertTrue(report.missing().isEmpty());
    assertFalse(report.isHealthy());
  }

  @Test
  void failureMessageFallsBackToTypeAndIsTruncated() {
    EssentialSeeds seeds = withExisting(Set.of());
    seeds.seedEach("bot", List.of("npe"), n -> n, n -> failWith(new NullPointerException()));
    seeds.seedEach(
        "bot", List.of("long"), n -> n, n -> failWith(new IllegalStateException("x".repeat(1000))));
    List<SeedFailure> failures = seeds.report().failures();
    assertEquals("NullPointerException", failures.get(0).error());
    assertEquals("x".repeat(300) + "...", failures.get(1).error());
  }

  @Test
  void sameFailureSeededTwiceIsRecordedOnce() {
    EssentialSeeds seeds = withExisting(Set.of());
    for (int attempt = 0; attempt < 2; attempt++) {
      seeds.seedEach(
          "skill", List.of("s"), n -> n, n -> failWith(new IllegalStateException("bad skill")));
    }
    assertEquals(List.of(new SeedFailure("skill", "s", "bad skill")), seeds.report().failures());
  }

  @Test
  void registerReplacesNamesForTheSameType() {
    EssentialSeeds seeds = withExisting(Set.of());
    seeds.register("bot", List.of("old"));
    seeds.register("bot", List.of("new"));
    assertEquals(List.of(new MissingArtifact("bot", "new")), seeds.report().missing());
  }

  @Test
  void reportForTypesExcludesOtherTypes() {
    EssentialSeeds seeds = withExisting(Set.of());
    seeds.register("bot", List.of("ingestion-bot"));
    seeds.register("dynamicAgent", List.of("AskCollate"));
    seeds.seedEach(
        "dynamicAgent", List.of("x"), n -> n, n -> failWith(new IllegalStateException("boom")));

    EssentialSeedReport report = seeds.report(Set.of("bot", "user"));

    assertEquals(List.of(new MissingArtifact("bot", "ingestion-bot")), report.missing());
    assertTrue(report.failures().isEmpty());
  }

  @Test
  void expectedNamesReturnsRegisteredNamesOrEmpty() {
    EssentialSeeds seeds = withExisting(Set.of());
    seeds.register("bot", List.of("ingestion-bot", "profiler-bot"));

    assertEquals(List.of("ingestion-bot", "profiler-bot"), seeds.expectedNames("bot"));
    assertEquals(List.of(), seeds.expectedNames("dynamicAgent"));
  }

  @Test
  void resetClearsRegistrationsAndFailures() {
    EssentialSeeds seeds = withExisting(Set.of());
    seeds.register("bot", List.of("a"));
    seeds.seedEach("bot", List.of("a"), n -> n, n -> failWith(new IllegalStateException("x")));
    seeds.reset();
    assertTrue(seeds.report().isHealthy());
  }
}
