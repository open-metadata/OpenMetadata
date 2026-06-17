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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContextMemoryRepository;
import org.openmetadata.service.llm.KnowledgePill;
import org.openmetadata.service.llm.LLMCompletionClient;
import org.openmetadata.service.llm.LLMCompletionException;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Turns a Context Center source's extracted text into reusable {@link ContextMemory} knowledge
 * pills via an {@link LLMCompletionClient}. The source can be any entity (a ContextFile, a Page,
 * ...); created memories are linked back to it via {@code sourceEntity} and tagged with the
 * supplied {@link ContextMemorySourceType}. The standard create path embeds and indexes them.
 */
@Slf4j
public class ContextMemoryExtractor {
  static final int MAX_PROMPT_CHARS = 60_000;
  static final int MAX_CHUNKS = 8;
  static final int MAX_NAME_BASE_LENGTH = 200;
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

  /** Result of an LLM derive pass, carrying chunk-level stats for the source's extractionStats. */
  public record DeriveResult(List<ContextMemory> memories, int chunksTotal, int chunksProcessed) {}

  /**
   * Derives memories from {@code text} without persisting anything. Long documents are processed in
   * paragraph-aligned chunks, one LLM call per chunk, with pills deduplicated across chunks. Chunk
   * failures are tolerated as long as at least one chunk succeeds — the stats in the result expose
   * partial coverage; if every chunk fails the run fails. Kept side-effect free so callers can
   * reconcile the source's previous pills only after the LLM pass succeeded. Each derived memory is
   * linked to {@code sourceRef} and tagged {@code sourceType}.
   */
  public DeriveResult derive(
      String text, EntityReference sourceRef, ContextMemorySourceType sourceType) {
    ChunkPlan plan = chunkText(text, sourceRef);
    List<KnowledgePill> collected = new ArrayList<>();
    int processed = 0;
    RuntimeException firstFailure = null;
    for (String chunk : plan.chunks()) {
      try {
        collected.addAll(callLlm(chunk));
        processed++;
      } catch (RuntimeException e) {
        LOG.warn(
            "Knowledge pill extraction failed for a chunk of {} {}",
            sourceRef.getType(),
            sourceRef.getId(),
            e);
        firstFailure = firstFailure == null ? e : firstFailure;
      }
    }
    if (processed == 0 && firstFailure != null) {
      throw new LLMCompletionException(
          "All " + plan.chunks().size() + " chunks failed knowledge pill extraction", firstFailure);
    }
    List<ContextMemory> memories = new ArrayList<>();
    for (KnowledgePill pill : dedupe(collected)) {
      memories.add(toMemory(pill, sourceRef, sourceType));
    }
    return new DeriveResult(memories, plan.totalChunks(), processed);
  }

  public int persist(List<ContextMemory> memories) {
    for (ContextMemory memory : memories) {
      memoryRepository.create(null, memory);
    }
    LOG.info("Persisted {} knowledge pills", memories.size());
    return memories.size();
  }

  /** The chunks submitted to the LLM plus the count the document would need without the cap. */
  private record ChunkPlan(List<String> chunks, int totalChunks) {}

  private ChunkPlan chunkText(String text, EntityReference sourceRef) {
    List<String> chunks = new ArrayList<>();
    int skippedChunks = 0;
    if (text != null && !text.isBlank()) {
      int position = 0;
      while (position < text.length() && chunks.size() < MAX_CHUNKS) {
        int end = chunkEnd(text, position);
        chunks.add(text.substring(position, end));
        position = end;
      }
      if (position < text.length()) {
        int remaining = text.length() - position;
        skippedChunks = (remaining + MAX_PROMPT_CHARS - 1) / MAX_PROMPT_CHARS;
        LOG.warn(
            "{} {} text exceeds {} chunks of {} chars; skipping the remaining {} chars",
            sourceRef.getType(),
            sourceRef.getId(),
            MAX_CHUNKS,
            MAX_PROMPT_CHARS,
            remaining);
      }
    }
    return new ChunkPlan(chunks, chunks.size() + skippedChunks);
  }

  /** Ends the chunk at the last paragraph (or line, or word) boundary inside the size budget. */
  private int chunkEnd(String text, int start) {
    int result = Math.min(start + MAX_PROMPT_CHARS, text.length());
    if (result < text.length()) {
      int boundary = lastBoundaryBefore(text, start, result);
      if (boundary > start) {
        result = boundary;
      }
    }
    return result;
  }

  private int lastBoundaryBefore(String text, int start, int limit) {
    int minAcceptable = start + MAX_PROMPT_CHARS / 2;
    int boundary = text.lastIndexOf("\n\n", limit);
    if (boundary <= minAcceptable) {
      boundary = text.lastIndexOf('\n', limit);
    }
    if (boundary <= minAcceptable) {
      boundary = text.lastIndexOf(' ', limit);
    }
    return boundary > minAcceptable ? boundary + 1 : -1;
  }

  private List<KnowledgePill> callLlm(String text) {
    List<KnowledgePill> result = new ArrayList<>();
    if (text != null && !text.isBlank()) {
      result = llmClient.completeStructured(SYSTEM_PROMPT, text, KnowledgePill.class);
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

  private ContextMemory toMemory(
      KnowledgePill pill, EntityReference sourceRef, ContextMemorySourceType sourceType) {
    String name = memoryName(sourceRef);
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
        .withSourceType(sourceType)
        .withSourceEntity(sourceRef)
        .withShareConfig(new MemoryShareConfig().withVisibility(MemoryVisibility.SHARED))
        .withUpdatedBy(Entity.ADMIN_USER_NAME)
        .withUpdatedAt(System.currentTimeMillis());
  }

  /** Keeps the generated memory name within the 256-char entityName limit (UUID suffix included). */
  private String memoryName(EntityReference sourceRef) {
    String base = sourceRef.getName();
    if (base.length() > MAX_NAME_BASE_LENGTH) {
      base = base.substring(0, MAX_NAME_BASE_LENGTH);
    }
    return base + "-" + UUID.randomUUID();
  }

  private ContextMemoryType parseType(String raw) {
    ContextMemoryType result = ContextMemoryType.NOTE;
    if (raw != null) {
      for (ContextMemoryType type : ContextMemoryType.values()) {
        if (type.value().equalsIgnoreCase(raw.trim())) {
          result = type;
          break;
        }
      }
    }
    return result;
  }
}
