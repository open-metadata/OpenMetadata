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
package org.openmetadata.service.apps.bundles.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.rdf.RdfWriteMode;

class RdfIndexingRunContextTest {
  @Test
  void relationshipIsolationHasItsOwnPersistedFailureBudget() {
    final EventPublisherJob job =
        JsonUtils.readValue(
            "{\"relationshipIsolationMaxFailures\":7,\"maxRetries\":9}", EventPublisherJob.class);
    final EventPublisherJob restored =
        JsonUtils.readValue(JsonUtils.pojoToJson(job), EventPublisherJob.class);
    assertEquals(7, RdfIndexingRunContext.forJob(restored).relationshipIsolationMaxFailures());
    assertEquals(9, restored.getMaxRetries());
  }

  @Test
  void httpRetrySettingsDoNotChangeTheRelationshipIsolationBudget() {
    assertEquals(
        3,
        RdfIndexingRunContext.forJob(new EventPublisherJob().withMaxRetries(0))
            .relationshipIsolationMaxFailures());
  }

  @Test
  void distributedTargetAndBudgetSurviveSerializationWithoutFollowingLaterConfigChanges() {
    final EventPublisherJob job =
        new EventPublisherJob()
            .withRecreateIndex(true)
            .withBlueGreenRebuild(true)
            .withRdfBuildDataset("catalog_a")
            .withRdfRebuildId("run-1")
            .withPayLoadSize(2048L);
    final EventPublisherJob restored =
        org.openmetadata.schema.utils.JsonUtils.readValue(
            org.openmetadata.schema.utils.JsonUtils.pojoToJson(job), EventPublisherJob.class);
    final RdfIndexingRunContext context = RdfIndexingRunContext.forJob(restored);
    restored.setRdfBuildDataset("catalog_b");
    restored.setPayLoadSize(8192L);
    assertEquals(
        new RdfIndexingRunContext.StorageTarget("catalog_a", "run-1", 2048),
        context.storageTarget());
    assertEquals(
        context.storageTarget(),
        context.withJobIdentity(java.util.UUID.randomUUID(), "pod-2").storageTarget());
  }

  @Test
  void aWorkerCannotDeriveAnUnrecordedBuildTarget() {
    org.junit.jupiter.api.Assertions.assertThrows(
        IllegalStateException.class,
        () ->
            RdfIndexingRunContext.forJob(
                new EventPublisherJob().withRecreateIndex(true).withBlueGreenRebuild(true)));
  }

  @Test
  void recreateJobUsesInsertOnly() {
    EventPublisherJob job =
        new EventPublisherJob().withRecreateIndex(true).withEntities(Set.of("table", "dashboard"));

    RdfIndexingRunContext context = RdfIndexingRunContext.forJob(job);

    assertEquals(RdfWriteMode.INSERT_ONLY, context.writeMode());
    assertEquals(Set.of("table", "dashboard"), context.entityTypesInRun());
  }

  @Test
  void falseNullAndMissingJobsReconcile() {
    assertEquals(
        RdfWriteMode.RECONCILE,
        RdfIndexingRunContext.forJob(new EventPublisherJob().withRecreateIndex(false)).writeMode());
    assertEquals(
        RdfWriteMode.RECONCILE, RdfIndexingRunContext.forJob(new EventPublisherJob()).writeMode());
    assertEquals(RdfWriteMode.RECONCILE, RdfIndexingRunContext.forJob(null).writeMode());
  }
}
