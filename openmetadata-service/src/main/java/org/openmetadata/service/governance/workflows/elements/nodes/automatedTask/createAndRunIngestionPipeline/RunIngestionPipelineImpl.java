package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline;

import static org.openmetadata.service.util.EntityUtil.Fields.EMPTY_FIELDS;

import java.util.List;
import java.util.UUID;
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
    int maxRetries = 3;
    int tryNumber = 0;
    long backoffMillis = 15 * 1000;

    while (true) {
      try {
        pipelineServiceClient.runPipeline(
            ingestionPipeline,
            Entity.getEntity(ingestionPipeline.getService(), "", Include.NON_DELETED));
        break;
      } catch (IngestionPipelineDeploymentException ex) {
        tryNumber++;
        if (tryNumber >= maxRetries) {
          throw new RuntimeException("Failed to run pipeline after " + tryNumber + " attempts", ex);
        }
        try {
          Thread.sleep(backoffMillis);
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException("Retry interrupted", ie);
        }
        backoffMillis *= 2;
      }
    }
  }

  public boolean waitForCompletion(
      IngestionPipelineRepository repository,
      IngestionPipeline ingestionPipeline,
      long startTime,
      long timeoutMillis) {
    long backoffMillis = 5 * 1000;
    while (true) {
      if (System.currentTimeMillis() - startTime > timeoutMillis) {
        return false;
      }

      List<PipelineStatus> statuses =
          repository
              .listPipelineStatus(
                  ingestionPipeline.getFullyQualifiedName(), startTime, startTime + timeoutMillis)
              .getData();

      if (statuses.isEmpty()) {
        try {
          Thread.sleep(backoffMillis);
          backoffMillis *= 2;
          continue;
        } catch (InterruptedException ie) {
          Thread.currentThread().interrupt();
          throw new RuntimeException("Retry interrupted", ie);
        }
      }

      PipelineStatus status = statuses.get(statuses.size() - 1);

      if (status.getPipelineState().equals(PipelineStatusType.FAILED)) {
        return false;
      } else if (status.getPipelineState().equals(PipelineStatusType.SUCCESS)
          || status.getPipelineState().equals(PipelineStatusType.PARTIAL_SUCCESS)) {
        return true;
      }
    }
  }
}
