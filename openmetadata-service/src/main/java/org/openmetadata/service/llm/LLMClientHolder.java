package org.openmetadata.service.llm;

import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.configuration.LLMConfiguration;

/**
 * Holds the single shared {@link LLMCompletionClient} built from {@code llmConfiguration} at
 * startup, so downstream features (e.g. Context Center pill extraction) need not thread the config
 * through every layer. Falls back to a {@link NoopCompletionClient} when unset, disabled, or when
 * the provider configuration cannot build a client.
 */
@Slf4j
public final class LLMClientHolder {
  private static volatile LLMCompletionClient instance;
  private static volatile boolean enabled;
  private static volatile boolean memoryExtractionEnabled;
  private static volatile String unavailableReason;

  private LLMClientHolder() {}

  public static synchronized void initialize(LLMConfiguration config) {
    unavailableReason = null;
    final boolean requested = config != null && Boolean.TRUE.equals(config.getEnabled());
    final Optional<LLMCompletionClient> client = requested ? buildClient(config) : Optional.empty();
    enabled = client.isPresent();
    memoryExtractionEnabled =
        config != null && Boolean.TRUE.equals(config.getMemoryExtractionEnabled());
    instance = client.orElseGet(NoopCompletionClient::new);
  }

  /**
   * LLM features are optional, so a provider configuration that cannot build a client (e.g. Bedrock
   * without a region, OpenAI without an API key) disables them instead of failing server startup.
   */
  private static Optional<LLMCompletionClient> buildClient(LLMConfiguration config) {
    Optional<LLMCompletionClient> client = Optional.empty();
    try {
      client = Optional.of(LLMCompletionClientFactory.create(config));
    } catch (IllegalArgumentException e) {
      unavailableReason = e.getMessage();
      LOG.error(
          "LLM features are disabled: the {} completion client could not be built: {}",
          config.getProvider(),
          e.getMessage());
    }
    return client;
  }

  /** Why LLM was requested but its client could not be built, for the system status page. */
  public static Optional<String> getUnavailableReason() {
    return Optional.ofNullable(unavailableReason);
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
    unavailableReason = null;
  }
}
