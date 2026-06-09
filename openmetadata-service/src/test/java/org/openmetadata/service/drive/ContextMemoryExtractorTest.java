package org.openmetadata.service.drive;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
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
  void skipsLlmWhenNoText() {
    ContextFile file = new ContextFile().withId(UUID.randomUUID()).withName("report");

    int created = new ContextMemoryExtractor(memoryRepository, llmClient).extract(file);

    assertEquals(0, created);
  }
}
