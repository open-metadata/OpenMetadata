package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Set;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.IndexMappingLanguage;

/**
 * Immutable configuration for a reindexing job. This record encapsulates all the configuration
 * parameters needed for reindexing, extracted from EventPublisherJob.
 */
public record ReindexingConfiguration(
    Set<String> entities,
    int batchSize,
    int consumerThreads,
    int producerThreads,
    int queueSize,
    int maxConcurrentRequests,
    long payloadSize,
    boolean recreateIndex,
    boolean autoTune,
    boolean useDistributedIndexing,
    boolean force,
    int maxRetries,
    int initialBackoff,
    int maxBackoff,
    IndexMappingLanguage searchIndexMappingLanguage,
    String afterCursor,
    String slackBotToken,
    String slackChannel) {

  private static final int DEFAULT_BATCH_SIZE = 100;
  private static final int DEFAULT_CONSUMER_THREADS = 1;
  private static final int DEFAULT_PRODUCER_THREADS = 1;
  private static final int DEFAULT_QUEUE_SIZE = 100;
  private static final int DEFAULT_MAX_CONCURRENT_REQUESTS = 100;
  private static final long DEFAULT_PAYLOAD_SIZE = 104857600L;
  private static final int DEFAULT_MAX_RETRIES = 5;
  private static final int DEFAULT_INITIAL_BACKOFF = 1000;
  private static final int DEFAULT_MAX_BACKOFF = 10000;

  /**
   * Creates a ReindexingConfiguration from an EventPublisherJob.
   *
   * @param jobData The EventPublisherJob containing the configuration
   * @return A new ReindexingConfiguration with values from jobData
   */
  public static ReindexingConfiguration from(EventPublisherJob jobData) {
    return new ReindexingConfiguration(
        jobData.getEntities(),
        jobData.getBatchSize() != null ? jobData.getBatchSize() : DEFAULT_BATCH_SIZE,
        jobData.getConsumerThreads() != null
            ? jobData.getConsumerThreads()
            : DEFAULT_CONSUMER_THREADS,
        jobData.getProducerThreads() != null
            ? jobData.getProducerThreads()
            : DEFAULT_PRODUCER_THREADS,
        jobData.getQueueSize() != null ? jobData.getQueueSize() : DEFAULT_QUEUE_SIZE,
        jobData.getMaxConcurrentRequests() != null
            ? jobData.getMaxConcurrentRequests()
            : DEFAULT_MAX_CONCURRENT_REQUESTS,
        jobData.getPayLoadSize() != null ? jobData.getPayLoadSize() : DEFAULT_PAYLOAD_SIZE,
        Boolean.TRUE.equals(jobData.getRecreateIndex()),
        Boolean.TRUE.equals(jobData.getAutoTune()),
        Boolean.TRUE.equals(jobData.getUseDistributedIndexing()),
        Boolean.TRUE.equals(jobData.getForce()),
        jobData.getMaxRetries() != null ? jobData.getMaxRetries() : DEFAULT_MAX_RETRIES,
        jobData.getInitialBackoff() != null ? jobData.getInitialBackoff() : DEFAULT_INITIAL_BACKOFF,
        jobData.getMaxBackoff() != null ? jobData.getMaxBackoff() : DEFAULT_MAX_BACKOFF,
        jobData.getSearchIndexMappingLanguage(),
        jobData.getAfterCursor(),
        jobData.getSlackBotToken(),
        jobData.getSlackChannel());
  }

  /** Check if Slack notifications are configured */
  public boolean hasSlackConfig() {
    return slackBotToken != null
        && !slackBotToken.isEmpty()
        && slackChannel != null
        && !slackChannel.isEmpty();
  }

  /** Check if this is a subset (smart) reindexing */
  public boolean isSmartReindexing() {
    return entities != null && !entities.contains("all") && entities.size() < 20 && recreateIndex;
  }

  /** Creates a builder for more flexible configuration creation */
  public static Builder builder() {
    return new Builder();
  }

  public static class Builder {
    private Set<String> entities;
    private int batchSize = DEFAULT_BATCH_SIZE;
    private int consumerThreads = DEFAULT_CONSUMER_THREADS;
    private int producerThreads = DEFAULT_PRODUCER_THREADS;
    private int queueSize = DEFAULT_QUEUE_SIZE;
    private int maxConcurrentRequests = DEFAULT_MAX_CONCURRENT_REQUESTS;
    private long payloadSize = DEFAULT_PAYLOAD_SIZE;
    private boolean recreateIndex = false;
    private boolean autoTune = false;
    private boolean useDistributedIndexing = false;
    private boolean force = false;
    private int maxRetries = DEFAULT_MAX_RETRIES;
    private int initialBackoff = DEFAULT_INITIAL_BACKOFF;
    private int maxBackoff = DEFAULT_MAX_BACKOFF;
    private IndexMappingLanguage searchIndexMappingLanguage = IndexMappingLanguage.EN;
    private String afterCursor;
    private String slackBotToken;
    private String slackChannel;

    public Builder entities(Set<String> entities) {
      this.entities = entities;
      return this;
    }

    public Builder batchSize(int batchSize) {
      this.batchSize = batchSize;
      return this;
    }

    public Builder consumerThreads(int consumerThreads) {
      this.consumerThreads = consumerThreads;
      return this;
    }

    public Builder producerThreads(int producerThreads) {
      this.producerThreads = producerThreads;
      return this;
    }

    public Builder queueSize(int queueSize) {
      this.queueSize = queueSize;
      return this;
    }

    public Builder maxConcurrentRequests(int maxConcurrentRequests) {
      this.maxConcurrentRequests = maxConcurrentRequests;
      return this;
    }

    public Builder payloadSize(long payloadSize) {
      this.payloadSize = payloadSize;
      return this;
    }

    public Builder recreateIndex(boolean recreateIndex) {
      this.recreateIndex = recreateIndex;
      return this;
    }

    public Builder autoTune(boolean autoTune) {
      this.autoTune = autoTune;
      return this;
    }

    public Builder useDistributedIndexing(boolean useDistributedIndexing) {
      this.useDistributedIndexing = useDistributedIndexing;
      return this;
    }

    public Builder force(boolean force) {
      this.force = force;
      return this;
    }

    public Builder maxRetries(int maxRetries) {
      this.maxRetries = maxRetries;
      return this;
    }

    public Builder initialBackoff(int initialBackoff) {
      this.initialBackoff = initialBackoff;
      return this;
    }

    public Builder maxBackoff(int maxBackoff) {
      this.maxBackoff = maxBackoff;
      return this;
    }

    public Builder searchIndexMappingLanguage(IndexMappingLanguage language) {
      this.searchIndexMappingLanguage = language;
      return this;
    }

    public Builder afterCursor(String afterCursor) {
      this.afterCursor = afterCursor;
      return this;
    }

    public Builder slackBotToken(String slackBotToken) {
      this.slackBotToken = slackBotToken;
      return this;
    }

    public Builder slackChannel(String slackChannel) {
      this.slackChannel = slackChannel;
      return this;
    }

    public ReindexingConfiguration build() {
      return new ReindexingConfiguration(
          entities,
          batchSize,
          consumerThreads,
          producerThreads,
          queueSize,
          maxConcurrentRequests,
          payloadSize,
          recreateIndex,
          autoTune,
          useDistributedIndexing,
          force,
          maxRetries,
          initialBackoff,
          maxBackoff,
          searchIndexMappingLanguage,
          afterCursor,
          slackBotToken,
          slackChannel);
    }
  }
}
