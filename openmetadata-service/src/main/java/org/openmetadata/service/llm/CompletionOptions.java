package org.openmetadata.service.llm;

/**
 * Optional per-call overrides for a single completion. Any null field falls back to the
 * provider client's configured default (from {@code llmConfiguration}). Use {@link #NONE} to
 * request the configured defaults.
 */
public record CompletionOptions(
    String modelId, Integer maxTokens, Double temperature, Integer timeoutSeconds) {

  public static final CompletionOptions NONE = new CompletionOptions(null, null, null, null);

  public String modelIdOr(String fallback) {
    return modelId != null ? modelId : fallback;
  }

  public int maxTokensOr(int fallback) {
    return maxTokens != null ? maxTokens : fallback;
  }

  public double temperatureOr(double fallback) {
    return temperature != null ? temperature : fallback;
  }

  public int timeoutSecondsOr(int fallback) {
    return timeoutSeconds != null ? timeoutSeconds : fallback;
  }
}
