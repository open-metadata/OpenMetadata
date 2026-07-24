/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Date;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.OrphanIngestionPipelineCleanup;

/**
 * End-to-end test for {@link OrphanIngestionPipelineCleanup} (the Data Retention cleanup of
 * ingestion pipelines whose container {@code service -> pipeline} CONTAINS row is missing). Verifies
 * that a pipeline with no container is hard-deleted, while a healthy pipeline is left untouched — the
 * cleanup is selective, not a blanket wipe.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ExtendWith(TestNamespaceExtension.class)
public class OrphanIngestionPipelineCleanupIT {

  private static final int BATCH = 10_000;

  @Test
  void missingContainer_deletesPipeline_keepsHealthy(TestNamespace ns) throws Exception {
    IngestionPipeline healthy = createPipeline("healthyPipe_" + ns.uniqueShortId());
    IngestionPipeline broken = createPipeline("brokenPipe_" + ns.uniqueShortId());

    assertEquals(1, pipelineRowCount(broken.getId().toString()), "broken pipeline should exist");
    assertEquals(1, pipelineRowCount(healthy.getId().toString()), "healthy pipeline should exist");

    // Break the broken pipeline: remove its service -> pipeline CONTAINS relationship row (leaving
    // the service intact) — the exact data-drift state the cleanup targets.
    Entity.getCollectionDAO()
        .relationshipDAO()
        .deleteTo(broken.getId(), Entity.INGESTION_PIPELINE, Relationship.CONTAINS.ordinal());

    OrphanIngestionPipelineCleanup.Result result =
        new OrphanIngestionPipelineCleanup(Entity.getCollectionDAO(), false).performCleanup(BATCH);

    assertTrue(result.getOrphansDeleted() >= 1, "the broken pipeline must be counted as an orphan");

    // Broken pipeline is gone; healthy pipeline survives — the cleanup is selective.
    assertEquals(0, pipelineRowCount(broken.getId().toString()), "broken pipeline must be deleted");
    assertEquals(1, pipelineRowCount(healthy.getId().toString()), "healthy pipeline must survive");
  }

  private IngestionPipeline createPipeline(String name) {
    OpenMetadataClient client = SdkClients.adminClient();
    SourceConfig sourceConfig =
        new SourceConfig()
            .withConfig(
                new DatabaseServiceMetadataPipeline()
                    .withMarkDeletedTables(true)
                    .withIncludeViews(true));
    return client
        .ingestionPipelines()
        .create(
            new CreateIngestionPipeline()
                .withName(name)
                .withPipelineType(PipelineType.METADATA)
                .withService(SharedEntities.get().MYSQL_SERVICE.getEntityReference())
                .withSourceConfig(sourceConfig)
                .withAirflowConfig(new AirflowConfig().withStartDate(new Date())));
  }

  private int pipelineRowCount(String id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM ingestion_pipeline_entity WHERE id = :id")
                    .bind("id", id)
                    .mapTo(Integer.class)
                    .one());
  }
}
