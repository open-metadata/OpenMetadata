package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Collections;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.type.IndexMappingLanguage;
import org.openmetadata.service.search.SearchClusterMetrics;
import org.openmetadata.service.search.SearchRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

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
    int fieldFetchThreads,
    int docBuildThreads,
    long statsIntervalMs,
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
    String slackChannel,
    int timeSeriesMaxDays,
    Map<String, Integer> timeSeriesEntityDays) {

  private static final Logger LOG = LoggerFactory.getLogger(ReindexingConfiguration.class);

  private static final int DEFAULT_BATCH_SIZE = 100;
  private static final int DEFAULT_CONSUMER_THREADS = 1;
  private static final int DEFAULT_PRODUCER_THREADS = 1;
  private static final int DEFAULT_QUEUE_SIZE = 100;
  private static final int DEFAULT_MAX_CONCURRENT_REQUESTS = 100;
  private static final long DEFAULT_PAYLOAD_SIZE = 104857600L;
  private static final int DEFAULT_FIELD_FETCH_THREADS = 0;
  private static final int DEFAULT_DOC_BUILD_THREADS = 0;
  private static final long DEFAULT_STATS_INTERVAL_MS = 0;
  private static final int DEFAULT_MAX_RETRIES = 5;
  private static final int DEFAULT_INITIAL_BACKOFF = 1000;
  private static final int DEFAULT_MAX_BACKOFF = 10000;
  private static final int DEFAULT_TIME_SERIES_MAX_DAYS = 0;

  public static ReindexingConfiguration applyAutoTuning(
      ReindexingConfiguration config, SearchRepository searchRepository, long totalEntities) {
    if (!config.autoTune()) {
      return config;
    }
    SearchClusterMetrics metrics = fetchClusterMetrics(searchRepository, totalEntities);
    if (metrics == null) {
      return config;
    }
    metrics.logRecommendations();
    return ReindexingConfiguration.builder()
        .entities(config.entities())
        .batchSize(metrics.getRecommendedBatchSize())
        .consumerThreads(metrics.getRecommendedConsumerThreads())
        .producerThreads(metrics.getRecommendedProducerThreads())
        .queueSize(metrics.getRecommendedQueueSize())
        .maxConcurrentRequests(metrics.getRecommendedConcurrentRequests())
        .payloadSize(metrics.getMaxPayloadSizeBytes())
        .fieldFetchThreads(metrics.getRecommendedFieldFetchThreads())
        .docBuildThreads(metrics.getRecommendedDocBuildThreads())
        .statsIntervalMs(metrics.getRecommendedStatsIntervalMs())
        .recreateIndex(config.recreateIndex())
        .autoTune(true)
        .useDistributedIndexing(config.useDistributedIndexing())
        .force(config.force())
        .maxRetries(config.maxRetries())
        .initialBackoff(config.initialBackoff())
        .maxBackoff(config.maxBackoff())
        .searchIndexMappingLanguage(config.searchIndexMappingLanguage())
        .afterCursor(config.afterCursor())
        .slackBotToken(config.slackBotToken())
        .slackChannel(config.slackChannel())
        .timeSeriesMaxDays(config.timeSeriesMaxDays())
        .timeSeriesEntityDays(config.timeSeriesEntityDays())
        .build();
  }

  private static SearchClusterMetrics fetchClusterMetrics(
      SearchRepository searchRepository, long totalEntities) {
    try {
      return SearchClusterMetrics.fetchClusterMetrics(
          searchRepository, totalEntities, searchRepository.getMaxDBConnections());
    } catch (Exception e) {
      LOG.warn("Failed to fetch cluster metrics for auto-tuning, using configured values", e);
      return null;
    }
  }

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
        DEFAULT_FIELD_FETCH_THREADS,
        DEFAULT_DOC_BUILD_THREADS,
        DEFAULT_STATS_INTERVAL_MS,
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
        jobData.getSlackChannel(),
        jobData.getTimeSeriesMaxDays() != null
            ? jobData.getTimeSeriesMaxDays()
            : DEFAULT_TIME_SERIES_MAX_DAYS,
        jobData.getTimeSeriesEntityDays() != null
            ? jobData.getTimeSeriesEntityDays()
            : Collections.emptyMap());
  }

  /**
   * Returns the start timestamp for time series date filtering for the given entity type. Uses
   * per-entity override if configured, otherwise falls back to the default timeSeriesMaxDays.
   *
   * @return start timestamp in millis, or -1 if no filtering should be applied (days <= 0)
   */
  public long getTimeSeriesStartTs(String entityType) {
    int days = timeSeriesMaxDays;
    if (timeSeriesEntityDays != null && timeSeriesEntityDays.containsKey(entityType)) {
      days = timeSeriesEntityDays.get(entityType);
    }
    if (days <= 0) {
      return -1;
    }
    return System.currentTimeMillis() - (days * 86_400_000L);
  }

  /**
   * Writes the (possibly auto-tuned) configuration back to the job so it gets persisted in the
   * AppRunRecord.
   */
  public void applyTo(EventPublisherJob jobData) {
    jobData.setBatchSize(batchSize);
    jobData.setConsumerThreads(consumerThreads);
    jobData.setProducerThreads(producerThreads);
    jobData.setQueueSize(queueSize);
    jobData.setMaxConcurrentRequests(maxConcurrentRequests);
    jobData.setPayLoadSize(payloadSize);
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
    private int fieldFetchThreads = DEFAULT_FIELD_FETCH_THREADS;
    private int docBuildThreads = DEFAULT_DOC_BUILD_THREADS;
    private long statsIntervalMs = DEFAULT_STATS_INTERVAL_MS;
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
    private int timeSeriesMaxDays = DEFAULT_TIME_SERIES_MAX_DAYS;
    private Map<String, Integer> timeSeriesEntityDays = Collections.emptyMap();

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

    public Builder fieldFetchThreads(int fieldFetchThreads) {
      this.fieldFetchThreads = fieldFetchThreads;
      return this;
    }

    public Builder docBuildThreads(int docBuildThreads) {
      this.docBuildThreads = docBuildThreads;
      return this;
    }

    public Builder statsIntervalMs(long statsIntervalMs) {
      this.statsIntervalMs = statsIntervalMs;
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

    public Builder timeSeriesMaxDays(int timeSeriesMaxDays) {
      this.timeSeriesMaxDays = timeSeriesMaxDays;
      return this;
    }

    public Builder timeSeriesEntityDays(Map<String, Integer> timeSeriesEntityDays) {
      this.timeSeriesEntityDays = timeSeriesEntityDays;
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
          fieldFetchThreads,
          docBuildThreads,
          statsIntervalMs,
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
          slackChannel,
          timeSeriesMaxDays,
          timeSeriesEntityDays);
    }
  }
}
