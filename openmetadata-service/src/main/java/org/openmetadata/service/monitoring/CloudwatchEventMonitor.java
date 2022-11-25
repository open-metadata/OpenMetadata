package org.openmetadata.service.monitoring;

import java.time.Instant;
import lombok.extern.slf4j.Slf4j;
import org.apache.logging.log4j.util.Strings;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.monitoring.EventMonitorProvider;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudwatch.CloudWatchClient;
import software.amazon.awssdk.services.cloudwatch.model.CloudWatchException;
import software.amazon.awssdk.services.cloudwatch.model.Dimension;
import software.amazon.awssdk.services.cloudwatch.model.MetricDatum;
import software.amazon.awssdk.services.cloudwatch.model.PutMetricDataRequest;
import software.amazon.awssdk.services.cloudwatch.model.StandardUnit;

@Slf4j
public class CloudwatchEventMonitor extends EventMonitor {

  public static final String ACCESS_KEY_ID = "accessKeyId";
  public static final String SECRET_ACCESS_KEY = "secretAccessKey";
  public static final String REGION = "region";

  public static final String INGESTION_PIPELINE_CREATED = "INGESTION_PIPELINE_CREATED";
  public static final String INGESTION_PIPELINE_UPDATED = "INGESTION_PIPELINE_";
  public static final String INGESTION_PIPELINE_DELETED = "INGESTION_PIPELINE_DELETED";
  public static final String NAMESPACE = "INGESTION_PIPELINE";
  public static final String PIPELINE_STATUS = "pipelineStatus";

  private final CloudWatchClient client;

  private static CloudwatchEventMonitor INSTANCE;

  protected CloudwatchEventMonitor(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    super(eventMonitorProvider, config, clusterPrefix);

    if (config != null
        && config.getParameters() != null
        && !Strings.isBlank(config.getParameters().getOrDefault(REGION, ""))) {
      String region = config.getParameters().getOrDefault(REGION, "");
      String accessKeyId = config.getParameters().getOrDefault(ACCESS_KEY_ID, "");
      String secretAccessKey = config.getParameters().getOrDefault(SECRET_ACCESS_KEY, "");
      AwsCredentialsProvider credentialsProvider;
      if (Strings.isBlank(accessKeyId) && Strings.isBlank(secretAccessKey)) {
        credentialsProvider = DefaultCredentialsProvider.create();
      } else {
        credentialsProvider =
            StaticCredentialsProvider.create(AwsBasicCredentials.create(accessKeyId, secretAccessKey));
      }
      this.client =
          CloudWatchClient.builder().region(Region.of(region)).credentialsProvider(credentialsProvider).build();
    } else {
      this.client = CloudWatchClient.create();
    }
  }

  public static CloudwatchEventMonitor getInstance(
      EventMonitorProvider eventMonitorProvider, EventMonitorConfiguration config, String clusterPrefix) {
    if (INSTANCE == null) INSTANCE = new CloudwatchEventMonitor(eventMonitorProvider, config, clusterPrefix);
    return INSTANCE;
  }

  /**
   * We want to control the lifecycle of an Ingestion Pipeline. We will push metrics for: 1. eventType "entityCreated":
   * log when a pipeline was first created. Push the FQN and timestamp 2. eventType "entityUpdated": log when there is a
   * `pipelineStatus` change with the status type 3. eventType "entityDeleted": log when an ingestionPipeline is removed
   *
   * @param event ChangeEvent for an IngestionPipeline
   */
  @Override
  protected void pushMetric(ChangeEvent event) {

    String fqn = event.getEntityFullyQualifiedName();
    IngestionPipeline ingestionPipeline = (IngestionPipeline) event.getEntity();
    String pipelineType = ingestionPipeline.getPipelineType().toString();
    Long timestamp = event.getTimestamp();

    try {
      switch (event.getEventType()) {
        case ENTITY_CREATED:
          logPipelineCreated(fqn, pipelineType, timestamp);
          break;
        case ENTITY_UPDATED:
          logPipelineUpdated(fqn, pipelineType, timestamp, event.getChangeDescription());
          break;
        case ENTITY_DELETED:
        case ENTITY_SOFT_DELETED:
          logPipelineDeleted(fqn, pipelineType, timestamp);
          break;
        default:
          throw new IllegalArgumentException("Invalid EventType " + event.getEventType());
      }
    } catch (IllegalArgumentException | CloudWatchException e) {
      LOG.error("Failed to publish IngestionPipeline Cloudwatch metric due to " + e.getMessage());
    }
  }

  protected void logPipelineCreated(String fqn, String pipelineType, Long timestamp) {
    logPipelineStatus(fqn, pipelineType, timestamp, INGESTION_PIPELINE_CREATED);
  }

  protected void logPipelineDeleted(String fqn, String pipelineType, Long timestamp) {
    logPipelineStatus(fqn, pipelineType, timestamp, INGESTION_PIPELINE_DELETED);
  }

  protected void logPipelineUpdated(
      String fqn, String pipelineType, Long timestamp, ChangeDescription changeDescription) {
    changeDescription
        .getFieldsUpdated()
        .forEach(
            change -> {
              if (change.getName().equals(PIPELINE_STATUS) && change.getNewValue() != null) {
                PipelineStatus pipelineStatus = (PipelineStatus) change.getNewValue();
                logPipelineStatus(
                    fqn, pipelineType, timestamp, getMetricNameByStatus(pipelineStatus.getPipelineState()));
              } else {
                LOG.debug("Ignoring Ingestion Pipeline change type " + change.getName());
              }
            });
  }

  private String getMetricNameByStatus(PipelineStatusType statusType) {
    return INGESTION_PIPELINE_UPDATED + statusType.toString().toUpperCase();
  }

  protected void logPipelineStatus(String fqn, String pipelineType, Long timestamp, String metricName) {
    Dimension dimension = Dimension.builder().name(pipelineType).value(fqn).build();
    Instant instant = Instant.ofEpochMilli(timestamp);

    MetricDatum datum =
        MetricDatum.builder()
            .metricName(metricName)
            .unit(StandardUnit.COUNT)
            .value(1.0)
            .timestamp(instant)
            .dimensions(dimension)
            .build();

    PutMetricDataRequest request =
        PutMetricDataRequest.builder().namespace(buildMetricNamespace(NAMESPACE)).metricData(datum).build();

    client.putMetricData(request);
  }

  @Override
  protected void close() {
    client.close();
  }
}
