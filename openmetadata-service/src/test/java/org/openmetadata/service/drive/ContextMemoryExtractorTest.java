package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.KnowledgePill;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;

@ExtendWith(MockitoExtension.class)
class ContextMemoryExtractorTest {

  @Mock private ContextMemoryRepository memoryRepository;
  @Mock private LLMCompletionClient llmClient;

  private static EntityReference fileRef(UUID id, String name) {
    return new EntityReference().withId(id).withName(name).withType(Entity.CONTEXT_FILE);
  }

  private int extract(ContextMemoryExtractor extractor, String text, EntityReference source) {
    return extractor.persist(
        extractor.derive(text, source, ContextMemorySourceType.FILE_EXTRACTION).memories());
  }

  @Test
  void createsOneMemoryPerExtractedPill() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T1", "Q1", "A1", "S1", "Faq"),
                new KnowledgePill("T2", "Q2", "A2", "S2", "Note")));

    int created = extract(new ContextMemoryExtractor(memoryRepository, llmClient), "text", source);

    assertEquals(2, created);
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository, times(2)).create(isNull(), captor.capture());
    ContextMemory first = captor.getAllValues().get(0);
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, first.getSourceType());
    assertEquals(source.getId(), first.getSourceEntity().getId());
    assertEquals("Q1", first.getQuestion());
  }

  @Test
  void dedupesByQuestionAndSkipsInvalid() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T", "dup", "A", "S", "Note"),
                new KnowledgePill("T", "dup", "A2", "S", "Note"),
                new KnowledgePill("T", null, "A", "S", "Note")));

    int created = extract(new ContextMemoryExtractor(memoryRepository, llmClient), "text", source);

    assertEquals(1, created);
    verify(memoryRepository, times(1)).create(isNull(), any());
  }

  @Test
  void deriveDoesNotPersist() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemoryExtractor.DeriveResult result =
        new ContextMemoryExtractor(memoryRepository, llmClient)
            .derive("text", source, ContextMemorySourceType.FILE_EXTRACTION);

    assertEquals(1, result.memories().size());
    assertEquals(1, result.chunksTotal());
    assertEquals(1, result.chunksProcessed());
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void tagsMemoriesWithTheGivenSourceTypeAndEntity() {
    EntityReference pageRef =
        new EntityReference().withId(UUID.randomUUID()).withName("runbook").withType(Entity.PAGE);
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemory memory =
        new ContextMemoryExtractor(memoryRepository, llmClient)
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

    List<ContextMemory> memories =
        new ContextMemoryExtractor(memoryRepository, llmClient)
            .derive("text", source, ContextMemorySourceType.FILE_EXTRACTION)
            .memories();

    String name = memories.getFirst().getName();
    assertTrue(name.length() <= 256, "memory name must fit the entityName limit");
    assertTrue(name.startsWith("f".repeat(ContextMemoryExtractor.MAX_NAME_BASE_LENGTH) + "-"));
  }

  @Test
  void partialChunkFailureStillYieldsPillsAndStats() {
    String paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(200);
    String text = (paragraph + "\n\n").repeat(12); // > 60k chars => several chunks
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenThrow(new LLMCompletionException("provider exploded"))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    ContextMemoryExtractor.DeriveResult result =
        new ContextMemoryExtractor(memoryRepository, llmClient)
            .derive(text, source, ContextMemorySourceType.FILE_EXTRACTION);

    assertEquals(1, result.memories().size(), "pills from surviving chunks must be kept");
    assertTrue(result.chunksTotal() >= 2);
    assertEquals(result.chunksTotal() - 1, result.chunksProcessed());
  }

  @Test
  void allChunksFailingThrows() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenThrow(new LLMCompletionException("provider exploded"));

    ContextMemoryExtractor extractor = new ContextMemoryExtractor(memoryRepository, llmClient);

    assertThrows(
        LLMCompletionException.class,
        () -> extractor.derive("text", source, ContextMemorySourceType.FILE_EXTRACTION));
  }

  @Test
  void skipsLlmWhenNoText() {
    EntityReference source = fileRef(UUID.randomUUID(), "report");

    int created = extract(new ContextMemoryExtractor(memoryRepository, llmClient), null, source);

    assertEquals(0, created);
  }

  @Test
  void chunksLongTextIntoMultipleLlmCallsAndDedupesAcrossChunks() {
    String paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(200);
    String text = (paragraph + "\n\n").repeat(30); // ~340k chars => 6 chunks of 60k
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "same question", "A", "S", "Faq")));

    int created = extract(new ContextMemoryExtractor(memoryRepository, llmClient), text, source);

    int expectedChunks =
        Math.min(
            ContextMemoryExtractor.MAX_CHUNKS,
            (int) Math.ceil((double) text.length() / ContextMemoryExtractor.MAX_PROMPT_CHARS) + 1);
    verify(llmClient, org.mockito.Mockito.atLeast(2))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
    verify(llmClient, org.mockito.Mockito.atMost(expectedChunks))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
    assertEquals(1, created, "identical pills from different chunks must dedupe to one");
  }

  @Test
  void capsChunksForVeryLongText() {
    String text = "word ".repeat(ContextMemoryExtractor.MAX_PROMPT_CHARS * 2); // 600k chars
    EntityReference source = fileRef(UUID.randomUUID(), "report");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class))).thenReturn(List.of());

    new ContextMemoryExtractor(memoryRepository, llmClient)
        .derive(text, source, ContextMemorySourceType.FILE_EXTRACTION);

    verify(llmClient, org.mockito.Mockito.times(ContextMemoryExtractor.MAX_CHUNKS))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
  }
}
