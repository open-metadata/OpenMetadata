package org.openmetadata.service.drive;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.ContextMemorySourceType;
import org.openmetadata.schema.entity.context.ContextMemoryStatus;
import org.openmetadata.schema.entity.context.ContextMemoryType;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.KnowledgePill;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Turns a processed {@link ContextFile}'s extracted text into reusable {@link ContextMemory}
 * knowledge pills via an {@link LLMCompletionClient}. Created memories are linked back to the file
 * ({@code sourceFile}) and tagged {@code sourceType=FileExtraction}; the standard create path
 * embeds and indexes them.
 */
@Slf4j
public class ContextMemoryExtractor {
  static final int MAX_PROMPT_CHARS = 60_000;
  static final String SYSTEM_PROMPT =
      "You extract reusable company knowledge from a document as a JSON array. Each element is an "
          + "object with keys: title, question, answer, summary, memoryType (one of Faq, Note, "
          + "Runbook, UseCase, Preference). Capture durable facts, definitions, policies, and "
          + "how-to guidance. Return ONLY the JSON array, no prose.";

  private final ContextMemoryRepository memoryRepository;
  private final LLMCompletionClient llmClient;

  public ContextMemoryExtractor(
      ContextMemoryRepository memoryRepository, LLMCompletionClient llmClient) {
    this.memoryRepository = memoryRepository;
    this.llmClient = llmClient;
  }

  public int extract(ContextFile file) {
    List<KnowledgePill> pills = dedupe(callLlm(file.getExtractedText()));
    EntityReference fileRef = file.getEntityReference();
    for (KnowledgePill pill : pills) {
      memoryRepository.create(null, toMemory(pill, fileRef));
    }
    LOG.info("Extracted {} knowledge pills from file {}", pills.size(), file.getId());
    return pills.size();
  }

  private List<KnowledgePill> callLlm(String text) {
    List<KnowledgePill> result = new ArrayList<>();
    if (text != null && !text.isBlank()) {
      String prompt = text.length() > MAX_PROMPT_CHARS ? text.substring(0, MAX_PROMPT_CHARS) : text;
      result = llmClient.completeStructured(SYSTEM_PROMPT, prompt, KnowledgePill.class);
    }
    return result;
  }

  private List<KnowledgePill> dedupe(List<KnowledgePill> pills) {
    Map<String, KnowledgePill> byQuestion = new LinkedHashMap<>();
    for (KnowledgePill pill : pills) {
      if (isValid(pill)) {
        byQuestion.putIfAbsent(pill.question().trim().toLowerCase(Locale.ROOT), pill);
      }
    }
    return new ArrayList<>(byQuestion.values());
  }

  private boolean isValid(KnowledgePill pill) {
    return pill != null
        && pill.question() != null
        && !pill.question().isBlank()
        && pill.answer() != null
        && !pill.answer().isBlank();
  }

  private ContextMemory toMemory(KnowledgePill pill, EntityReference fileRef) {
    String name = fileRef.getName() + "-" + UUID.randomUUID();
    return new ContextMemory()
        .withId(UUID.randomUUID())
        .withName(name)
        .withFullyQualifiedName(FullyQualifiedName.build(name))
        .withTitle(pill.title())
        .withQuestion(pill.question())
        .withAnswer(pill.answer())
        .withSummary(pill.summary())
        .withMemoryType(parseType(pill.memoryType()))
        .withStatus(ContextMemoryStatus.ACTIVE)
        .withSourceType(ContextMemorySourceType.FILE_EXTRACTION)
        .withSourceFile(fileRef)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED))
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withUpdatedAt(System.currentTimeMillis());
  }

  private ContextMemoryType parseType(String raw) {
    ContextMemoryType result = ContextMemoryType.NOTE;
    if (raw != null) {
      for (ContextMemoryType type : ContextMemoryType.values()) {
        if (type.value().equalsIgnoreCase(raw.trim())) {
          result = type;
        }
      }
    }
    return result;
  }
}
