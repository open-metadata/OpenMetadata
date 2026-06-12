package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.KnowledgePill;
import org.openmetadata.service.llm.LLMCompletionClient;

@ExtendWith(MockitoExtension.class)
class ContextMemoryExtractorTest {

  @Mock private ContextMemoryRepository memoryRepository;
  @Mock private LLMCompletionClient llmClient;

  @Test
  void createsOneMemoryPerExtractedPill() {
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName("report").withExtractedText("text");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T1", "Q1", "A1", "S1", "Faq"),
                new KnowledgePill("T2", "Q2", "A2", "S2", "Note")));

    int created = new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

    assertEquals(2, created);
    ArgumentCaptor<ContextMemory> captor = ArgumentCaptor.forClass(ContextMemory.class);
    verify(memoryRepository, times(2)).create(isNull(), captor.capture());
    ContextMemory first = captor.getAllValues().get(0);
    assertEquals(ContextMemorySourceType.FILE_EXTRACTION, first.getSourceType());
    assertEquals(file.getId(), first.getSourceFile().getId());
    assertEquals("Q1", first.getQuestion());
  }

  @Test
  void dedupesByQuestionAndSkipsInvalid() {
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName("report").withExtractedText("text");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(
            List.of(
                new KnowledgePill("T", "dup", "A", "S", "Note"),
                new KnowledgePill("T", "dup", "A2", "S", "Note"),
                new KnowledgePill("T", null, "A", "S", "Note")));

    int created = new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

    assertEquals(1, created);
    verify(memoryRepository, times(1)).create(isNull(), any());
  }

  @Test
  void deriveDoesNotPersist() {
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName("report").withExtractedText("text");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    List<ContextMemory> memories =
        new ContextMemoryExtractor(memoryRepository, llmClient).derive(file, "text");

    assertEquals(1, memories.size());
    verify(memoryRepository, never()).create(any(), any());
  }

  @Test
  void truncatesLongFileNamesToFitEntityNameLimit() {
    String longName = "f".repeat(256);
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName(longName).withExtractedText("text");
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "Q", "A", "S", "Faq")));

    List<ContextMemory> memories =
        new ContextMemoryExtractor(memoryRepository, llmClient).derive(file, "text");

    String name = memories.getFirst().getName();
    assertTrue(name.length() <= 256, "memory name must fit the entityName limit");
    assertTrue(name.startsWith("f".repeat(ContextMemoryExtractor.MAX_NAME_BASE_LENGTH) + "-"));
  }

  @Test
  void skipsLlmWhenNoText() {
    ContextFile file = new ContextFile().withId(UUID.randomUUID()).withName("report");

    int created = new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

    assertEquals(0, created);
  }

  @Test
  void chunksLongTextIntoMultipleLlmCallsAndDedupesAcrossChunks() {
    String paragraph = "Lorem ipsum dolor sit amet consectetur adipiscing elit. ".repeat(200);
    String text = (paragraph + "\n\n").repeat(30); // ~340k chars => 6 chunks of 60k
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName("report").withExtractedText(text);
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class)))
        .thenReturn(List.of(new KnowledgePill("T", "same question", "A", "S", "Faq")));

    int created = new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

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
    ContextFile file =
        new ContextFile().withId(UUID.randomUUID()).withName("report").withExtractedText(text);
    when(llmClient.completeStructured(any(), any(), eq(KnowledgePill.class))).thenReturn(List.of());

    new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

    verify(llmClient, org.mockito.Mockito.times(ContextMemoryExtractor.MAX_CHUNKS))
        .completeStructured(any(), any(), eq(KnowledgePill.class));
  }
}
