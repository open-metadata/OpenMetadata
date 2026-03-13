package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.function.Supplier;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.exception.IngestionPipelineDeploymentException;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.OpenMetadataConnectionBuilder;

@Slf4j
public class RunIngestionPipelineImpl {
  public static final String SUCCESS = "SUCCESS";
  public static final String FAILED = "FAILED";
  public static final String RUNNING = "RUNNING";
  public static final String WAIT_FOR_PIPELINE_COMPLETION = "waitForPipelineCompletion";

  static long pollingIntervalMillis = 30 * 1_000L;
  static long runRetryIntervalMillis = 15 * 1_000L;

  private final PipelineServiceClientInterface pipelineServiceClient;

  public RunIngestionPipelineImpl(PipelineServiceClientInterface pipelineServiceClient) {
    this.pipelineServiceClient = pipelineServiceClient;
  }

  public boolean execute(UUID ingestionPipelineId, boolean waitForCompletion, long timeoutSeconds) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);

    IngestionPipeline ingestionPipeline = getIngestionPipeline(repository, ingestionPipelineId);
    return runIngestionPipeline(repository, ingestionPipeline, waitForCompletion, timeoutSeconds);
  }

  private IngestionPipeline getIngestionPipeline(
      IngestionPipelineRepository repository, UUID ingestionPipelineId) {
    OpenMetadataApplicationConfig config = repository.getOpenMetadataApplicationConfig();

    IngestionPipeline ingestionPipeline = repository.get(null, ingestionPipelineId, EMPTY_FIELDS);
    ingestionPipeline.setOpenMetadataServerConnection(
        new OpenMetadataConnectionBuilder(config).build());

    return ingestionPipeline;
  }

  private boolean runIngestionPipeline(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      boolean waitForCompletion,
      long timeoutSeconds) {
    boolean wasSuccessful = true;
    long startTime = System.currentTimeMillis();
    long timeoutMillis = timeoutSeconds * 1000;

    LOG.info(
        "[GovernanceWorkflows] '{}' running for '{}'",
        ingestionPipeline.getDisplayName(),
        ingestionPipeline.getService().getName());
    runIngestionPipeline(ingestionPipeline);

    if (waitForCompletion) {
      wasSuccessful = waitForCompletion(repository, ingestionPipeline, startTime, timeoutMillis);

      if (!wasSuccessful) {
        LOG.warn(
            "[GovernanceWorkflows] '{}' failed for '{}'",
            ingestionPipeline.getDisplayName(),
            ingestionPipeline.getService().getName());
      }
    }
    return wasSuccessful;
  }

  private void runIngestionPipeline(IngestionPipeline ingestionPipeline) {
    RetryConfig retryConfig =
        RetryConfig.custom()
            .maxAttempts(3)
            .waitDuration(Duration.ofMillis(runRetryIntervalMillis))
            .retryOnException(ex -> ex instanceof IngestionPipelineDeploymentException)
            .build();

    Retry retry = Retry.of("runIngestionPipeline", retryConfig);

    try {
      retry.executeRunnable(
          () ->
              pipelineServiceClient.runPipeline(
                  ingestionPipeline,
                  Entity.getEntity(
                      ingestionPipeline.getService(), "ingestionRunner", Include.NON_DELETED)));
    } catch (Exception ex) {
      throw new RuntimeException("Failed to run pipeline after retries: " + ex.getMessage(), ex);
    }
  }

  public boolean waitForCompletion(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      long startTime,
      long timeoutMillis) {

    RetryConfig retryConfig =
        RetryConfig.<String>custom()
            .maxAttempts(Integer.MAX_VALUE)
            .waitDuration(Duration.ofMillis(pollingIntervalMillis))
            .retryOnResult(RUNNING::equals)
            .retryOnException(ex -> true)
            .failAfterMaxAttempts(false)
            .build();

    Retry retry = Retry.of(WAIT_FOR_PIPELINE_COMPLETION, retryConfig);

    Supplier<String> completionChecker =
        () -> {
          if (System.currentTimeMillis() - startTime > timeoutMillis) {
            return "TIMEOUT";
          }

          List<PipelineStatus> statuses =
              repository
                  .listPipelineStatus(
                      ingestionPipeline.getFullyQualifiedName(),
                      startTime,
                      startTime + timeoutMillis)
                  .getData();

          if (statuses.isEmpty()) {
            return RUNNING;
          }

          PipelineStatus status = statuses.getLast();

          if (status.getPipelineState().equals(PipelineStatusType.FAILED)) {
            return FAILED;
          } else if (status.getPipelineState().equals(PipelineStatusType.SUCCESS)
              || status.getPipelineState().equals(PipelineStatusType.PARTIAL_SUCCESS)) {
            return SUCCESS;
          }

          return RUNNING;
        };

    String result = retry.executeSupplier(completionChecker);
    return SUCCESS.equals(result);
  }
}
