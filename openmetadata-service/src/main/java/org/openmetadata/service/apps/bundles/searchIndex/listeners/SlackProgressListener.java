package org.openmetadata.service.apps.bundles.searchIndex.listeners;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingConfiguration;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingJobContext;
import org.openmetadata.service.apps.bundles.searchIndex.ReindexingProgressListener;
import org.openmetadata.service.apps.bundles.searchIndex.SlackWebApiClient;

/**
 * Progress listener that sends notifications to Slack. This listener is optional and only activates
 * when Slack credentials are provided.
 */
@Slf4j
public class SlackProgressListener implements ReindexingProgressListener {

  private static final String AUTO_TUNE = "Auto-tune";
  private static final String ENABLED = "Enabled";
  private static final String DISABLED = "Disabled";
  private static final String BATCH_SIZE = "Batch size";
  private static final String CONSUMER_THREADS = "Consumer threads";
  private static final String PRODUCER_THREADS = "Producer threads";
  private static final String TOTAL_ENTITIES = "Total entities";
  private static final String QUEUE_SIZE = "Queue size";
  private static final String RECREATING_INDICES = "Recreating indices";
  private static final String PAYLOAD_SIZE = "Payload size";
  private static final String CONCURRENT_REQUESTS = "Concurrent requests";

  private final SlackWebApiClient slackClient;
  private String entitiesDisplayString;
  private boolean isSmartReindexing;
  private int totalEntities;

  public SlackProgressListener(String botToken, String channel, String instanceUrl) {
    this.slackClient = new SlackWebApiClient(botToken, channel, instanceUrl);
  }

  @Override
  public void onJobStarted(ReindexingJobContext context) {
    LOG.debug("Slack notification: Job started");
  }

  @Override
  public void onJobConfigured(ReindexingJobContext context, ReindexingConfiguration config) {
    this.entitiesDisplayString = formatEntities(config.entities());
    this.isSmartReindexing = config.isSmartReindexing();
    this.totalEntities = config.entities().size();

    Map<String, String> configDetails = buildConfigDetails(config);
    slackClient.setConfigurationDetails(configDetails);
    slackClient.sendStartNotification(entitiesDisplayString, isSmartReindexing, totalEntities);
  }

  @Override
  public void onIndexRecreationStarted(Set<String> entities) {
    LOG.debug("Slack notification: Index recreation started for {} entities", entities.size());
  }

  @Override
  public void onEntityTypeStarted(String entityType, long totalRecords) {
    LOG.debug(
        "Slack notification: Entity type {} started with {} records", entityType, totalRecords);
  }

  @Override
  public void onProgressUpdate(Stats stats, ReindexingJobContext context) {
    slackClient.sendProgressUpdate(stats);
  }

  @Override
  public void onEntityTypeCompleted(String entityType, StepStats entityStats) {
    LOG.debug("Slack notification: Entity type {} completed", entityType);
  }

  @Override
  public void onError(String entityType, IndexingError error, Stats currentStats) {
    LOG.debug("Slack notification: Error for entity type {}", entityType);
  }

  @Override
  public void onJobCompleted(Stats finalStats, long elapsedMillis) {
    slackClient.sendCompletionNotification(finalStats, elapsedMillis / 1000, false);
  }

  @Override
  public void onJobCompletedWithErrors(Stats finalStats, long elapsedMillis) {
    slackClient.sendCompletionNotification(finalStats, elapsedMillis / 1000, true);
  }

  @Override
  public void onJobFailed(Stats currentStats, Exception error) {
    slackClient.sendErrorNotification(error.getMessage());
  }

  @Override
  public void onJobStopped(Stats currentStats) {
    LOG.info("Slack notification: Job stopped");
  }

  @Override
  public int getPriority() {
    return 50;
  }

  private String formatEntities(Set<String> entities) {
    if (entities == null || entities.isEmpty()) {
      return "None";
    }
    if (entities.contains("all")) {
      return "All";
    }
    return String.join(", ", entities);
  }

  private Map<String, String> buildConfigDetails(ReindexingConfiguration config) {
    Map<String, String> details = new HashMap<>();
    details.put(AUTO_TUNE, config.autoTune() ? ENABLED : DISABLED);
    details.put(BATCH_SIZE, String.valueOf(config.batchSize()));
    details.put(CONSUMER_THREADS, String.valueOf(config.consumerThreads()));
    details.put(PRODUCER_THREADS, String.valueOf(config.producerThreads()));
    details.put(QUEUE_SIZE, String.valueOf(config.queueSize()));
    details.put(TOTAL_ENTITIES, String.valueOf(totalEntities));
    details.put(RECREATING_INDICES, config.recreateIndex() ? "Yes" : "No");
    details.put(PAYLOAD_SIZE, (config.payloadSize() / (1024 * 1024)) + " MB");
    details.put(CONCURRENT_REQUESTS, String.valueOf(config.maxConcurrentRequests()));
    return details;
  }
}
