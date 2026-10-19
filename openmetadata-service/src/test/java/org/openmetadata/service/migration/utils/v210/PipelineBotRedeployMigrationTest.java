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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.resources.services.ingestionpipelines.PipelineBotRedeployScheduler.PENDING_REDEPLOY;

import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityExtensionDAO;
import org.openmetadata.service.jdbi3.ListFilter;

class PipelineBotRedeployMigrationTest {

  private final Set<UUID> marked = new HashSet<>();

  @Test
  void marksOnlyDeployedAutoPilotAgentsOfTypesWithTheirOwnBot() {
    IngestionPipeline usage =
        stored(PipelineType.USAGE, ProviderType.AUTOMATION, true, "Usage Agent");
    IngestionPipeline lineage =
        stored(PipelineType.LINEAGE, ProviderType.AUTOMATION, true, "Lineage Agent");
    IngestionPipeline profiler =
        stored(PipelineType.PROFILER, ProviderType.AUTOMATION, true, "Profiler Agent");
    IngestionPipeline autoClassification =
        stored(
            PipelineType.AUTO_CLASSIFICATION,
            ProviderType.AUTOMATION,
            true,
            "AutoClassification Agent");
    List<IngestionPipeline> notMarked =
        List.of(
            stored(PipelineType.METADATA, ProviderType.AUTOMATION, true, "Metadata Agent"),
            stored(PipelineType.PROFILER, ProviderType.AUTOMATION, false, "Profiler Agent"),
            stored(PipelineType.PROFILER, ProviderType.USER, true, "Nightly profiler"));

    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(
        collectionDAO(List.of(usage, lineage, profiler, autoClassification), notMarked));

    assertEquals(
        Set.of(usage.getId(), lineage.getId(), profiler.getId(), autoClassification.getId()),
        marked);
  }

  // 1.7 AutoPilot created its agents before it marked them with the AUTOMATION provider.
  @Test
  void marksAgentsAutoPilotCreatedBeforeItSetTheAutomationProvider() {
    IngestionPipeline usage = stored(PipelineType.USAGE, ProviderType.USER, true, "Usage Agent");
    IngestionPipeline noProvider = stored(PipelineType.LINEAGE, null, true, "Lineage Agent");
    List<IngestionPipeline> notMarked =
        List.of(stored(PipelineType.USAGE, ProviderType.USER, true, "Lineage Agent"));

    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(
        collectionDAO(List.of(usage, noProvider), notMarked));

    assertEquals(Set.of(usage.getId(), noProvider.getId()), marked);
  }

  // 1.2 stored the application pipeline type as "Application"; such a row must not fail the
  // upgrade.
  @Test
  void skipsARowStoredUnderAPipelineTypeTheEnumNoLongerHas() {
    IngestionPipeline usage =
        stored(PipelineType.USAGE, ProviderType.AUTOMATION, true, "Usage Agent");
    IngestionPipeline lineage =
        stored(PipelineType.LINEAGE, ProviderType.AUTOMATION, true, "Lineage Agent");
    String legacy =
        "{\"id\":\"%s\",\"name\":\"legacy\",\"pipelineType\":\"Application\",\"deployed\":true}"
            .formatted(UUID.randomUUID());

    PipelineBotRedeployMigration.markAutoPilotAgentsForRedeploy(
        collectionDAO(List.of(legacy, JsonUtils.pojoToJson(usage)), usage, List.of(lineage)));

    assertEquals(Set.of(usage.getId(), lineage.getId()), marked);
  }

  private static IngestionPipeline stored(
      PipelineType pipelineType, ProviderType provider, boolean deployed, String displayName) {
    UUID id = UUID.randomUUID();
    return new IngestionPipeline()
        .withId(id)
        .withName(id.toString())
        .withDisplayName(displayName)
        .withPipelineType(pipelineType)
        .withProvider(provider)
        .withDeployed(deployed)
        .withSourceConfig(new SourceConfig().withConfig(Map.of("type", "Profiler")));
  }

  /**
   * Two pages of stored pipelines, each served only for the cursor of the page before it, then an
   * empty one; the markers land in {@link #marked}.
   */
  private CollectionDAO collectionDAO(
      List<IngestionPipeline> firstPage, List<IngestionPipeline> secondPage) {
    return collectionDAO(toJson(firstPage), firstPage.getLast(), secondPage);
  }

  private CollectionDAO collectionDAO(
      List<String> firstPage, IngestionPipeline lastOfFirst, List<IngestionPipeline> secondPage) {
    CollectionDAO.IngestionPipelineDAO pipelineDAO = mock(CollectionDAO.IngestionPipelineDAO.class);
    when(pipelineDAO.listAfter(any(ListFilter.class), eq(1_000), eq(""), eq("")))
        .thenReturn(firstPage);
    when(pipelineDAO.listAfter(
            any(ListFilter.class),
            eq(1_000),
            eq(lastOfFirst.getName()),
            eq(lastOfFirst.getId().toString())))
        .thenReturn(toJson(secondPage));
    IngestionPipeline lastOfSecond = secondPage.getLast();
    when(pipelineDAO.listAfter(
            any(ListFilter.class),
            eq(1_000),
            eq(lastOfSecond.getName()),
            eq(lastOfSecond.getId().toString())))
        .thenReturn(List.of());

    EntityExtensionDAO extensionDAO = mock(EntityExtensionDAO.class);
    doAnswer(
            invocation -> {
              marked.add(invocation.getArgument(0));
              return null;
            })
        .when(extensionDAO)
        .insert(any(UUID.class), eq(PENDING_REDEPLOY), eq(Entity.INGESTION_PIPELINE), anyString());

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    when(collectionDAO.ingestionPipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.entityExtensionDAO()).thenReturn(extensionDAO);
    return collectionDAO;
  }

  private static List<String> toJson(List<IngestionPipeline> pipelines) {
    return pipelines.stream().map(JsonUtils::pojoToJson).toList();
  }
}
