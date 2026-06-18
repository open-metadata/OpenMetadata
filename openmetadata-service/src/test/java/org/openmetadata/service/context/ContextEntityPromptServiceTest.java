package org.openmetadata.service.context;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.core.SecurityContext;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;

class ContextEntityPromptServiceTest {

  @Test
  void assembleDeduplicatesEntitiesAndFormatsPrompt() {
    EntityReference fileRef = reference("contextFile", "q3-report");
    EntityReference pageRef = reference("page", "distribution-guidelines");
    ContextEntityPromptService service =
        new ContextEntityPromptService(
            (securityContext, reference) ->
                switch (reference.getType()) {
                  case "contextFile" -> Optional.of(
                      new ResolvedContextEntity(
                          fileRef,
                          "File (PDF)",
                          "Q3 Report",
                          "finance.q3-report",
                          "Quarterly planning document",
                          "Revenue grew materially year over year."));
                  case "page" -> Optional.of(
                      new ResolvedContextEntity(
                          pageRef,
                          "Page",
                          "Distribution Guidelines",
                          "knowledge.distribution-guidelines",
                          null,
                          "Check skewness and percentiles before quoting averages."));
                  default -> Optional.empty();
                });

    ContextPromptInjectionResult result =
        service.assemble(null, List.of(fileRef, fileRef, pageRef));

    assertEquals(2, result.usedEntityRefs().size());
    assertTrue(result.formattedContext().contains("<context_entities>"));
    assertTrue(result.formattedContext().contains("Q3 Report"));
    assertTrue(result.formattedContext().contains("Distribution Guidelines"));
    assertTrue(result.formattedContext().contains("Content:"));
    assertTrue(result.totalTokens() > 0);
  }

  @Test
  void assembleRespectsBudgetByTruncatingLongBodies() {
    EntityReference fileRef = reference("contextFile", "long-file");
    String longBody = "token ".repeat(5000);
    ContextEntityPromptService service =
        new ContextEntityPromptService(
            (securityContext, reference) ->
                Optional.of(
                    new ResolvedContextEntity(
                        fileRef, "File (Text)", "Long File", "drive.long-file", null, longBody)));

    ContextPromptInjectionResult result = service.assemble(null, List.of(fileRef));

    assertFalse(result.formattedContext().isEmpty());
    assertTrue(result.formattedContext().contains("[truncated]"));
    assertTrue(result.totalTokens() <= ContextEntityPromptService.TOTAL_TOKEN_BUDGET);
  }

  @Test
  void assembleReturnsEmptyWhenNothingResolves() {
    EntityReference ref = reference("contextFile", "missing");
    ContextEntityPromptService service =
        new ContextEntityPromptService(
            (SecurityContext sc, EntityReference reference) -> Optional.empty());

    ContextPromptInjectionResult result = service.assemble(null, List.of(ref));

    assertTrue(result.formattedContext().isEmpty());
    assertTrue(result.usedEntityRefs().isEmpty());
    assertEquals(0, result.totalTokens());
  }

  @Test
  void assembleSelectsRelevantChunkForQueryInsteadOfDocumentPrefix() {
    EntityReference fileRef = reference("contextFile", "analytics-playbook");
    String longIntro = "intro ".repeat(1500);
    String relevantSection =
        "When the revenue distribution is skewed, do not rely only on averages. "
            + "Use median, percentiles, and outlier review before making claims.";
    String longTail = "tail ".repeat(1500);
    String longBody = longIntro + "\n\n" + relevantSection + "\n\n" + longTail;

    ContextEntityPromptService service =
        new ContextEntityPromptService(
            (securityContext, reference) ->
                Optional.of(
                    new ResolvedContextEntity(
                        fileRef,
                        "File (PDF)",
                        "Analytics Playbook",
                        "drive.analytics-playbook",
                        null,
                        longBody)));

    ContextPromptInjectionResult result =
        service.assemble(
            null,
            List.of(fileRef),
            "What does the playbook say about skewed revenue distributions and percentiles?");

    assertFalse(result.formattedContext().isEmpty());
    assertTrue(result.formattedContext().contains(relevantSection));
  }

  private EntityReference reference(String type, String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType(type)
        .withName(name)
        .withFullyQualifiedName(type + "." + name)
        .withDisplayName(name);
  }
}
