package org.openmetadata.service.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.concurrent.Semaphore;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;

/**
 * Generic, concurrency-bounded chat/completion client. Mirrors {@code EmbeddingClient}: a fixed
 * permit pool guards provider rate limits, and {@link #completeStructured} parses the model's JSON
 * array response into typed records (with a single retry on malformed JSON).
 */
@Slf4j
public abstract class LLMCompletionClient {
  static final int DEFAULT_MAX_CONCURRENT_REQUESTS = 5;
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private final Semaphore concurrencyLimiter;

  protected LLMCompletionClient(int maxConcurrentRequests) {
    if (maxConcurrentRequests < 1) {
      throw new IllegalArgumentException(
          "maxConcurrentRequests must be >= 1, but was " + maxConcurrentRequests);
    }
    this.concurrencyLimiter = new Semaphore(maxConcurrentRequests);
  }

  protected abstract String doComplete(String systemPrompt, String userPrompt);

  public abstract String getModelId();

  public final String complete(String systemPrompt, String userPrompt) {
    acquirePermit();
    String result;
    try {
      result = doComplete(systemPrompt, userPrompt);
    } finally {
      concurrencyLimiter.release();
    }
    return result;
  }

  public final <T> List<T> completeStructured(
      String systemPrompt, String userPrompt, Class<T> elementType) {
    List<T> parsed;
    try {
      parsed = parseArray(complete(systemPrompt, userPrompt), elementType);
    } catch (LLMCompletionException firstFailure) {
      LOG.warn("LLM returned unparseable JSON; retrying once", firstFailure);
      parsed = parseArray(complete(systemPrompt, userPrompt), elementType);
    }
    return parsed;
  }

  private void acquirePermit() {
    try {
      concurrencyLimiter.acquire();
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      throw new LLMCompletionException("LLM completion interrupted while waiting for a permit", e);
    }
  }

  private <T> List<T> parseArray(String json, Class<T> elementType) {
    String cleaned = stripCodeFence(json);
    List<T> result;
    try {
      result =
          MAPPER.readValue(
              cleaned, MAPPER.getTypeFactory().constructCollectionType(List.class, elementType));
    } catch (JsonProcessingException e) {
      throw new LLMCompletionException("Failed to parse LLM JSON array response", e);
    }
    return result;
  }

  private String stripCodeFence(String raw) {
    String trimmed = raw == null ? "" : raw.trim();
    String result = trimmed;
    if (trimmed.startsWith("```")) {
      int firstNewline = trimmed.indexOf('\n');
      int lastFence = trimmed.lastIndexOf("```");
      if (firstNewline > 0 && lastFence > firstNewline) {
        result = trimmed.substring(firstNewline + 1, lastFence).trim();
      }
    }
    return result;
  }

  protected static int resolveMaxConcurrent(LLMConfiguration config) {
    int result = DEFAULT_MAX_CONCURRENT_REQUESTS;
    if (config != null
        && config.getMaxConcurrentRequests() != null
        && config.getMaxConcurrentRequests() > 0) {
      result = config.getMaxConcurrentRequests();
    }
    return result;
  }
}
