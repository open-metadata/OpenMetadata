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

  private LLMClientHolder() {}

  public static synchronized void initialize(LLMConfiguration config) {
    enabled = config != null && Boolean.TRUE.equals(config.getEnabled());
    instance = LLMCompletionClientFactory.create(config);
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

  /** Test seam: inject a deterministic completion client (and force-enable) for integration tests. */
  public static synchronized void setForTesting(LLMCompletionClient client) {
    instance = client;
    enabled = client != null;
  }
}
