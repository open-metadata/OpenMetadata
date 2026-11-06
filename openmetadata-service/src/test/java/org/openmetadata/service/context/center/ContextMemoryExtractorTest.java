package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemoryScope;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;

@ExtendWith(MockitoExtension.class)
class ContextMemoryExtractorTest {

  @Mock private LLMCompletionClient llmClient;

  private static EntityReference fileRef(UUID id, String name) {
    return new EntityReference().withId(id).withName(name).withType(Entity.CONTEXT_FILE);
  }

  private ContextMemoryExtractor extractor() {
    return new ContextMemoryExtractor(llmClient);
  }

  private List<ContextMemory> derive(String text, EntityReference source) {
    return extractor().derive(text, source, ContextMemorySourceType.FILE_EXTRACTION).memories();
  }

  @Test
  void createsOneMemoryPerExtractedPill() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T1", "Q1", "A1", "S1", "Faq"),
                new KnowledgePill("T2", "Q2", "A2", "S2", "Note")));

    List<ContextMemory> memories = derive("text", source);

    assertEquals(2, memories.size());
    ContextMemory first = memories.getFirst();
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, first.getSourceType());
    assertEquals(source.getId(), first.getSourceEntity().getId());
    assertEquals(source.getId(), first.getPrimaryEntity().getId());
    assertEquals(ContextMemoryScope.ENTITY_SCOPED, first.getMemoryScope());
    assertEquals(MemoryVisibility.ENTITY, first.getShareConfig().getVisibility());
    assertEquals(ContextMemoryStatus.APPROVED, first.getEntityStatus());
    assertEquals("Q1", first.getQuestion());
  }

  @Test
  void dedupesRepeatedFactsAndSkipsInvalid() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T", "dup", "A", "S", "Note"),
                new KnowledgePill("T", " Dup ", "a", "S", "Note"),
                new KnowledgePill("T", null, "A", "S", "Note")));

    assertEquals(1, derive("text", source).size());
  }

  /** Two values the document gives for one fact are a conflict for review, not a silent pick. */
  @Test
  void keepsEveryAnswerTheDocumentGivesToOneQuestion() {
    EntityReference source = fileRef(UUID.randomUUID(), "policy");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("Discount", "Employee discount?", "15% (Sales)", "S", "Faq"),
                new KnowledgePill("Discount", "Employee discount?", "25% (HR)", "S", "Faq")));

    List<ContextMemory> memories = derive("text", source);

    assertEquals(2, memories.size());
    assertEquals("15% (Sales)", memories.get(0).getAnswer());
    assertEquals("25% (HR)", memories.get(1).getAnswer());
  }

  @Test
  void keepsBothPositiveAndNegativeValuesOfOneFact() {
    EntityReference source = fileRef(UUID.randomUUID(), "forecast");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("Growth", "Expected growth?", "−15%", "Downside", "Faq"),
                new KnowledgePill("Growth", "Expected growth?", "+15%", "Upside", "Faq")));

    assertEquals(
        List.of("−15%", "+15%"),
        derive("text", source).stream().map(ContextMemory::getAnswer).toList());
  }

  /** The same fact reworded in two chunks is one pill; only a different number makes a second. */
  @Test
  void aRewordedAnswerIsTheSameFact() {
    EntityReference source = fileRef(UUID.randomUUID(), "policy");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("Refunds", "Refund window?", "30 days", "S", "Faq"),
                new KnowledgePill(
                    "Refunds",
                    "Refund window?",
                    "Refunds are accepted within 30 days",
                    "S",
                    "Faq")));

    assertEquals(1, derive("text", source).size());
  }

  @Test
  void asksTheModelForEveryConflictingValueInsteadOfChoosingOne() {
    EntityReference source = fileRef(UUID.randomUUID(), "policy");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class))).thenReturn(List.of());

    derive("text", source);

    verify(llmClient)
        .completeStructured(
            org.mockito.ArgumentMatchers.contains("never merge them or choose one"),
            any(),
            eq(KnowledgePill.class));
  }

  @Test
  void startsMemoriesInTheStatusItsProviderReviewsThemFrom() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemory memory =
        new ContextMemoryExtractor(llmClient, ContextMemoryStatus.UNPROCESSED)
            .derive("text", source, ContextMemorySourceType.FILE_EXTRACTION)
            .memories()
            .getFirst();

    assertEquals(ContextMemoryStatus.UNPROCESSED, memory.getEntityStatus());
  }

  @Test
  void deriveReturnsMemoriesAndChunkStats() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemoryExtractor.DeriveResult result =
        extractor().derive("text", source, ContextMemorySourceType.FILE_EXTRACTION);

    assertEquals(1, result.memories().size());
    assertEquals(1, result.chunksTotal());
    assertEquals(1, result.chunksProcessed());
  }

  @Test
  void tagsMemoriesWithTheGivenSourceTypeAndEntity() {
    EntityReference pageRef =
        new EntityReference().withId(UUID.randomUUID()).withName("runbook").withType(Entity.PAGE);
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemory memory =
        extractor()
            .derive("text", pageRef, ContextMemorySourceType.PAGE_EXTRACTION)
            .memories()
            .getFirst();

    assertEquals(ContextMemorySourceType.PAGE_EXTRACTION, memory.getSourceType());
    assertEquals(pageRef.getId(), memory.getSourceEntity().getId());
    assertEquals(Entity.PAGE, memory.getSourceEntity().getType());
  }

  @Test
  void truncatesLongSourceNamesToFitEntityNameLimit() {
    String longName = "f".repeat(256);
    EntityReference source = fileRef(UUID.randomUUID(), longName);
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    String name = derive("text", source).getFirst().getName();

    assertTrue(name.length() <= 256, "memory name must fit the entityName limit");
    assertTrue(name.startsWith("f".repeat(ContextMemoryExtractor.MAX_NAME_BASE_LENGTH) + "-"));
  }

  @Test
  void partialChunkFailureDoesNotReturnAnIncompleteSet() {
    String paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(200);
    String text = (paragraph + "\n\n").repeat(12); // > 60k chars => several chunks
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenThrow(new LLMCompletionException("provider exploded"))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    assertThrows(
        LLMCompletionException.class,
        () -> extractor().derive(text, source, ContextMemorySourceType.FILE_EXTRACTION));
  }

  @Test
  void allChunksFailingThrows() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenThrow(new LLMCompletionException("provider exploded"));

    ContextMemoryExtractor extractor = extractor();

    assertThrows(
        LLMCompletionException.class,
        () -> extractor.derive("text", source, ContextMemorySourceType.FILE_EXTRACTION));
  }

  @Test
  void skipsLlmWhenNoText() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");

    assertEquals(0, derive(null, source).size());
  }

  @Test
  void chunksLongTextIntoMultipleLlmCallsAndDedupesAcrossChunks() {
    String paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(200);
    String text = (paragraph + "\n\n").repeat(30); // ~340k chars => 6 chunks of 60k
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "same question", "A", "S", "Faq")));

    List<ContextMemory> memories = derive(text, source);

    int expectedChunks =
        Math.min(
            ContextMemoryExtractor.MAX_CHUNKS,
            (int) Math.ceil((double) text.length() / ContextMemoryExtractor.MAX_PROMPT_CHARS) + 1);
    verify(llmClient, org.mockito.Mockito.atLeast(2))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
    verify(llmClient, org.mockito.Mockito.atMost(expectedChunks))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
    assertEquals(1, memories.size(), "identical pills from different chunks must dedupe to one");
  }

  @Test
  void rejectsSourcesThatExceedTheChunkBudget() {
    String text = "word ".repeat(ContextMemoryExtractor.MAX_PROMPT_CHARS * 2); // 600k chars
    EntityReference source = fileRef(UUID.randomUUID(), "report");

    assertThrows(
        LLMCompletionException.class,
        () -> extractor().derive(text, source, ContextMemorySourceType.FILE_EXTRACTION));
    verify(llmClient, org.mockito.Mockito.never())
        .completeStructured(any(), any(), eq(KnowledgePill.class));
  }

  /** Automatic extraction keeps the rule chat capture follows: no personal data, whatever the source. */
  @Test
  void asksTheModelToLeaveOutPersonalData() {
    EntityReference source = fileRef(UUID.randomUUID(), "escalations");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class))).thenReturn(List.of());

    derive("text", source);

    verify(llmClient)
        .completeStructured(
            org.mockito.ArgumentMatchers.contains("Never extract personal data"),
            any(),
            eq(KnowledgePill.class));
    assertTrue(
        ContextMemoryExtractor.SYSTEM_PROMPT.contains(
            "nor credentials, tokens, keys or connection strings"),
        "secrets are kept out as well as contact details");
  }
}
