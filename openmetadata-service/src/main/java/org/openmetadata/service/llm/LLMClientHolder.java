package org.openmetadata.service.llm;

import org.openmetadata.schema.configuration.LLMConfiguration;

/**
 * Holds the single shared {@link LLMCompletionClient} built from {@code llmConfiguration} at
 * startup, so downstream features (e.g. Context Center pill extraction) need not thread the config
 * through every layer. Falls back to a {@link NoopCompletionClient} when unset or disabled.
 */
public final class LLMClientHolder {
  private static volatile LLMCompletionClient instance;
  private static volatile boolean enabled;
  private static volatile boolean memoryExtractionEnabled;

  private LLMClientHolder() {}

  public static synchronized void initialize(LLMConfiguration config) {
    enabled = config != null && Boolean.TRUE.equals(config.getEnabled());
    memoryExtractionEnabled =
        config != null && Boolean.TRUE.equals(config.getMemoryExtractionEnabled());
    instance = enabled ? LLMCompletionClientFactory.create(config) : new NoopCompletionClient();
  }

  public static LLMCompletionClient get() {
    LLMCompletionClient current = instance;
    if (current == null) {
      current = new NoopCompletionClient();
    }
    return current;
  }

  public static boolean isEnabled() {
    return enabled;
  }

  /**
   * Whether Context Center memory extraction may run. Separate from {@link #isEnabled()} because
   * that switch also turns on embeddings and the other completion features: a deployment that
   * enables LLM features for semantic search does not thereby ask for every upload and article
   * edit to spend model calls deriving pills.
   */
  public static boolean isMemoryExtractionEnabled() {
    return enabled && memoryExtractionEnabled;
  }

  /** Test seam: inject a deterministic completion client (and force-enable) for integration tests. */
  public static synchronized void setForTesting(LLMCompletionClient client) {
    instance = client;
    enabled = client != null;
    memoryExtractionEnabled = client != null;
  }
}
