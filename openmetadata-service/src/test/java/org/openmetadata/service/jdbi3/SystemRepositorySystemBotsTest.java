package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.security.BotTokenCheck.TokenProblem;
import org.openmetadata.service.security.BotTokenCheck.UnusableBot;
import org.openmetadata.service.seeding.EssentialSeedReport;
import org.openmetadata.service.seeding.EssentialSeedReport.MissingArtifact;
import org.openmetadata.service.seeding.EssentialSeedReport.SeedFailure;

class SystemRepositorySystemBotsTest {

  @Test
  void listsSeedProblemsThenUnusableTokensWithTheirReason() {
    EssentialSeedReport report =
        new EssentialSeedReport(
            List.of(new MissingArtifact("bot", "AIAutomationApplicationBot")),
            List.of(
                new SeedFailure("user", "automatorapplicationbot", "Encryption key not found.")));
    List<UnusableBot> unusable =
        List.of(
            new UnusableBot("profiler-bot", TokenProblem.REJECTED),
            new UnusableBot("usage-bot", TokenProblem.CANNOT_BE_DECRYPTED));

    assertEquals(
        List.of(
            "Missing: bot AIAutomationApplicationBot",
            "Failed to set up: user automatorapplicationbot",
            "Token not usable: bot profiler-bot (rejected by JWT validation)",
            "Token not usable: bot usage-bot (cannot be decrypted)"),
        SystemRepository.systemBotProblems(report, unusable));
  }

  @Test
  void healthyWhenNothingIsWrong() {
    assertEquals(
        List.of(),
        SystemRepository.systemBotProblems(
            new EssentialSeedReport(List.of(), List.of()), List.of()));
  }

  @Test
  void missingBotIsNotTokenChecked() {
    EssentialSeedReport report =
        new EssentialSeedReport(
            List.of(
                new MissingArtifact("bot", "testsuite-bot"),
                new MissingArtifact("user", "automatorapplicationbot")),
            List.of());

    assertEquals(
        List.of("ingestion-bot"),
        SystemRepository.presentBots(
            List.of("ingestion-bot", "testsuite-bot", "AutomatorApplicationBot"), report));
  }
}
