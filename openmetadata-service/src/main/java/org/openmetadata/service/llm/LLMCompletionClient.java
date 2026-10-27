package org.openmetadata.service.llm;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.Semaphore;
import java.util.regex.Pattern;
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
  private static final String JSON_RETRY_INSTRUCTION =
      "\n\nThe previous response was not valid for the requested JSON format. "
          + "Repeat the task and return ONLY the requested JSON array, with no prose or markdown. "
          + "Keep the fields and decision rules specified above; do not substitute an explanation.";

  // Mirrors CAIP's BaseBuilder.SAMPLING_PARAM_REJECTORS: these models fail the whole call when a
  // request carries `temperature` (Bedrock: "`temperature` is deprecated for this model.").
  // Hyphenated entries match as substrings so `sonnet-5` covers `sonnet-5-5` but not `sonnet-4-5`;
  // bare ones (`o1`, `o3`) must equal a whole id segment so `gpt-4o-mini` is not caught.
  // ADR:2026-10-20-temperature-is-sent-only-to-models-that-accept-it
  private static final List<String> SAMPLING_PARAM_REJECTORS =
      List.of(
          "opus-4-7",
          "opus-4-8",
          "opus-5",
          "sonnet-5",
          "haiku-5",
          "fable-5",
          "mythos-5",
          "o1",
          "o3",
          "o4-mini",
          "gpt-5.6",
          "gpt-6");
  private static final Pattern MODEL_ID_SEPARATOR = Pattern.compile("[^a-z0-9]+");

  private final Semaphore concurrencyLimiter;

  protected LLMCompletionClient(int maxConcurrentRequests) {
    if (maxConcurrentRequests < 1) {
      throw new IllegalArgumentException(
          "maxConcurrentRequests must be >= 1, but was " + maxConcurrentRequests);
    }
    this.concurrencyLimiter = new Semaphore(maxConcurrentRequests);
  }

  protected abstract CompletionResult doComplete(
      String systemPrompt, String userPrompt, CompletionOptions options);

  public abstract String getModelId();

  public final CompletionResult complete(String systemPrompt, String userPrompt) {
    return complete(systemPrompt, userPrompt, CompletionOptions.NONE);
  }

  public final CompletionResult complete(
      String systemPrompt, String userPrompt, CompletionOptions options) {
    acquirePermit();
    CompletionResult result;
    try {
      result = doComplete(systemPrompt, userPrompt, options);
    } finally {
      concurrencyLimiter.release();
    }
    return result;
  }

  public final <T> List<T> completeStructured(
      String systemPrompt, String userPrompt, Class<T> elementType) {
    List<T> parsed;
    try {
      parsed = parseArray(complete(systemPrompt, userPrompt).text(), elementType);
    } catch (LLMCompletionException firstFailure) {
      LOG.warn("LLM returned unparseable JSON; retrying once", firstFailure);
      String retryPrompt =
          firstFailure.getCause() instanceof JsonProcessingException
              ? systemPrompt + JSON_RETRY_INSTRUCTION
              : systemPrompt;
      parsed = parseArray(complete(retryPrompt, userPrompt).text(), elementType);
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
          MAPPER
              .readerFor(MAPPER.getTypeFactory().constructCollectionType(List.class, elementType))
              .with(DeserializationFeature.ACCEPT_SINGLE_VALUE_AS_ARRAY)
              .readValue(cleaned);
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

  static boolean supportsTemperature(String modelId) {
    boolean supported = true;
    if (modelId != null) {
      String id = modelId.toLowerCase(Locale.ROOT);
      List<String> segments = List.of(MODEL_ID_SEPARATOR.split(id));
      supported =
          SAMPLING_PARAM_REJECTORS.stream()
              .noneMatch(
                  rejector ->
                      rejector.indexOf('-') >= 0
                          ? id.contains(rejector)
                          : segments.contains(rejector));
    }
    return supported;
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
