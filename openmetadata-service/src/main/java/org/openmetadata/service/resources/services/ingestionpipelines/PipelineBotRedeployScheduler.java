/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.services.ingestionpipelines;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.ServiceEntityInterface;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.clients.pipeline.PipelineServiceClientFactory;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.IngestionPipelineRepository;
import org.openmetadata.service.util.FreshReadScope;

/**
 * Redeploys the ingestion pipelines marked {@value #PENDING_REDEPLOY}, so their scheduled runs
 * authenticate as the bot of their type. The token a run uses is fixed when the pipeline is
 * deployed, so correcting it takes a redeploy, and an upgrade cannot do that itself: the pipeline
 * service is often not up while migrations run. The marker is written by the migration and cleared
 * here once the pipeline is deployed, or found gone; a failed deploy keeps it for the next scan.
 *
 * <p>Every server runs this. Two of them may deploy the same pipeline at once, which is harmless:
 * a deploy writes the same pipeline definition either time.
 * ADR:2026-10-19-migrations-mark-pipelines-for-redeploy-and-the-server-redeploys-them
 */
@Slf4j
public final class PipelineBotRedeployScheduler implements Managed {
  public static final String PENDING_REDEPLOY = "pipelineBotRedeploy.pending";
  private static final Duration INITIAL_DELAY = Duration.ofMinutes(1);
  private static final Duration PERIOD = Duration.ofMinutes(5);
  private static final int BATCH_SIZE = 100;

  private final EntityExtensionDAO extensionDAO;
  private final OpenMetadataApplicationConfig config;
  private final Duration initialDelay;
  private final Duration period;
  private ScheduledExecutorService executor;

  public PipelineBotRedeployScheduler(
      EntityExtensionDAO extensionDAO, OpenMetadataApplicationConfig config) {
    this(extensionDAO, config, INITIAL_DELAY, PERIOD);
  }

  PipelineBotRedeployScheduler(
      EntityExtensionDAO extensionDAO,
      OpenMetadataApplicationConfig config,
      Duration initialDelay,
      Duration period) {
    this.extensionDAO = extensionDAO;
    this.config = config;
    this.initialDelay = initialDelay;
    this.period = period;
  }

  @Override
  public void start() {
    if (isPipelineServiceEnabled()) {
      executor =
          Executors.newSingleThreadScheduledExecutor(
              runnable -> {
                Thread thread = new Thread(runnable, "pipeline-bot-redeploy");
                thread.setDaemon(true);
                return thread;
              });
      executor.scheduleWithFixedDelay(
          this::runSafely, initialDelay.toMillis(), period.toMillis(), TimeUnit.MILLISECONDS);
    }
  }

  @Override
  public void stop() {
    if (executor != null) {
      executor.shutdownNow();
    }
  }

  /**
   * Returns whether any pipeline is still waiting for its redeploy. Reads are fresh: this thread
   * outlives every scan, so a cached copy of a pipeline the user edited since an earlier failed scan
   * would otherwise be deployed over the edit.
   */
  boolean redeployPending() {
    try (FreshReadScope.Handle ignored = FreshReadScope.enter()) {
      if (hasPending() && isPipelineServiceReachable()) {
        redeployAll();
      }
      return hasPending();
    }
  }

  private void redeployAll() {
    List<String> batch = extensionDAO.listExtensionIds(PENDING_REDEPLOY, "", BATCH_SIZE);
    while (!batch.isEmpty()) {
      batch.forEach(id -> redeploy(UUID.fromString(id)));
      batch = extensionDAO.listExtensionIds(PENDING_REDEPLOY, batch.getLast(), BATCH_SIZE);
    }
  }

  private boolean hasPending() {
    return !extensionDAO.listExtensionIds(PENDING_REDEPLOY, "", 1).isEmpty();
  }

  private void runSafely() {
    try {
      if (!redeployPending()) {
        LOG.debug("No ingestion pipeline is waiting for a redeploy as its own bot");
        executor.shutdown();
      }
    } catch (Exception e) {
      LOG.error("Redeploying ingestion pipelines as their own bot failed; retrying later", e);
    }
  }

  private void redeploy(UUID pipelineId) {
    try {
      if (deploy(pipelineId)) {
        extensionDAO.delete(pipelineId, PENDING_REDEPLOY);
      }
    } catch (EntityNotFoundException e) {
      LOG.info("Ingestion pipeline {} or its service was deleted; nothing to redeploy", pipelineId);
      extensionDAO.delete(pipelineId, PENDING_REDEPLOY);
    } catch (Exception e) {
      // One pipeline that cannot be deployed must not strand the ones behind it.
      LOG.warn("Ingestion pipeline {} could not be redeployed; retrying later", pipelineId, e);
    }
  }

  private boolean deploy(UUID pipelineId) {
    IngestionPipelineRepository repository =
        (IngestionPipelineRepository) Entity.getEntityRepository(Entity.INGESTION_PIPELINE);
    // A soft-deleted pipeline keeps running on schedule, so it is redeployed like any other.
    IngestionPipeline pipeline =
        repository.get(
            null, pipelineId, repository.getFields(Entity.FIELD_OWNERS), Include.ALL, false);
    IngestionPipelineSecrets.prepareForPipelineService(config, pipeline);
    ServiceEntityInterface service =
        Entity.getEntity(pipeline.getService(), "ingestionRunner", Include.ALL);
    PipelineServiceClientResponse response = repository.deployIngestionPipeline(pipeline, service);
    boolean deployed = response.getCode() == 200;
    if (deployed) {
      LOG.info(
          "Redeployed ingestion pipeline {} to run as its own bot",
          pipeline.getFullyQualifiedName());
    } else {
      LOG.warn(
          "Redeploying ingestion pipeline {} returned {}: {}; retrying later",
          pipeline.getFullyQualifiedName(),
          response.getCode(),
          response.getReason());
    }
    return deployed;
  }

  private boolean isPipelineServiceEnabled() {
    return config.getPipelineServiceClientConfiguration() != null
        && Boolean.TRUE.equals(config.getPipelineServiceClientConfiguration().getEnabled());
  }

  private static boolean isPipelineServiceReachable() {
    PipelineServiceClientInterface client = PipelineServiceClientFactory.getPipelineServiceClient();
    return client != null && client.getServiceStatus().getCode() == 200;
  }
}
