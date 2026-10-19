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

package org.openmetadata.service.migration.utils.v210;

import static org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.createAndRunIngestionPipeline.CreateIngestionPipelineImpl.AGENT_DISPLAY_NAMES;
import static org.openmetadata.service.resources.services.ingestionpipelines.PipelineBotRedeployScheduler.PENDING_REDEPLOY;

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

/**
 * AutoPilot deployed the agents it created with the ingestion-bot token, whatever their type, so
 * their scheduled runs wrote as ingestion-bot. It now deploys each one as the bot of its type, but
 * the agents it deployed before keep the token they were deployed with until they are deployed
 * again. This marks them for {@code PipelineBotRedeployScheduler}, which redeploys them once the
 * server is up: the pipeline service is often not reachable while migrations run. Soft-deleted
 * agents are marked too, since they keep running on schedule.
 * ADR:2026-10-19-migrations-mark-pipelines-for-redeploy-and-the-server-redeploys-them
 */
@Slf4j
public final class PipelineBotRedeployMigration {

  /** Run once per version through {@code DataMigrationStep}. */
  public static final String STEP_NAME = "autopilot-agents-own-bot";

  private static final int BATCH_SIZE = 1_000;
  private static final String EMPTY_JSON = "{}";

  /** The agent types AutoPilot creates that write as a bot of their own, not ingestion-bot. */
  private static final Set<PipelineType> OWN_BOT_TYPES =
      Set.of(
          PipelineType.USAGE,
          PipelineType.LINEAGE,
          PipelineType.PROFILER,
          PipelineType.AUTO_CLASSIFICATION);

  /**
   * The fields of a stored ingestion pipeline this step reads. Type and provider stay strings: a
   * row stored under a value the enums no longer have (1.2's "Application" pipeline type) must be
   * skipped, not fail the upgrade.
   */
  record Agent(
      UUID id,
      String name,
      String displayName,
      String pipelineType,
      String provider,
      Boolean deployed) {

    boolean ranAsIngestionBot() {
      Optional<PipelineType> type = ownBotType();
      return Boolean.TRUE.equals(deployed) && type.isPresent() && isCreatedByAutoPilot(type.get());
    }

    private Optional<PipelineType> ownBotType() {
      return OWN_BOT_TYPES.stream().filter(type -> type.value().equals(pipelineType)).findFirst();
    }

    // AutoPilot has marked its agents with the AUTOMATION provider since 1.8. The ones 1.7 created
    // are recognised by the display name AutoPilot gives them, which is also how it finds them.
    private boolean isCreatedByAutoPilot(PipelineType type) {
      return ProviderType.AUTOMATION.value().equals(provider)
          || Objects.equals(AGENT_DISPLAY_NAMES.get(type), displayName);
    }
  }

  private PipelineBotRedeployMigration() {}

  public static void markAutoPilotAgentsForRedeploy(CollectionDAO collectionDAO) {
    int marked = 0;
    List<Agent> batch = nextBatch(collectionDAO, "", "");
    while (!batch.isEmpty()) {
      for (Agent agent : batch) {
        if (agent.ranAsIngestionBot()) {
          collectionDAO
              .entityExtensionDAO()
              .insert(agent.id(), PENDING_REDEPLOY, Entity.INGESTION_PIPELINE, EMPTY_JSON);
          marked++;
        }
      }
      Agent last = batch.getLast();
      batch = nextBatch(collectionDAO, last.name(), last.id().toString());
    }
    LOG.info("Marked {} AutoPilot agents to be redeployed as their own bot", marked);
  }

  private static List<Agent> nextBatch(
      CollectionDAO collectionDAO, String afterName, String afterId) {
    return collectionDAO
        .ingestionPipelineDAO()
        .listAfter(new ListFilter(Include.ALL), BATCH_SIZE, afterName, afterId)
        .stream()
        .map(json -> JsonUtils.readValueLenient(json, Agent.class))
        .toList();
  }
}
