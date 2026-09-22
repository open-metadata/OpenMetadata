/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;

/**
 * Contract for the entity-status step: emit the entity's governance status, defaulting to
 * {@code Unprocessed} when unset, mirroring the live search index so Data Insights can filter and
 * group by lifecycle status the same way Explore does.
 */
class EntityStatusStepTest {

  private final EntityStatusStep step = new EntityStatusStep();

  @Test
  void setStatus_emitsStatusValue() {
    Map<String, Object> snapshot = run(entityWithStatus(EntityStatus.DRAFT));
    assertEquals("Draft", snapshot.get("entityStatus"));
  }

  @Test
  void approvedStatus_emitsApproved() {
    Map<String, Object> snapshot = run(entityWithStatus(EntityStatus.APPROVED));
    assertEquals("Approved", snapshot.get("entityStatus"));
  }

  @Test
  void nullStatus_defaultsToUnprocessed() {
    Map<String, Object> snapshot = run(entityWithStatus(null));
    assertEquals("Unprocessed", snapshot.get("entityStatus"));
  }

  private Map<String, Object> run(EntityInterface entity) {
    Map<String, Object> entityMap = new HashMap<>();
    EnrichmentTarget target =
        new EnrichmentTarget(
            entity,
            entityMap,
            Map.of(),
            0L,
            0L,
            new EnrichmentContext("table", List.of(), 0L, 0L),
            VersionShape.LATEST_HYDRATED);
    step.apply(target);
    return entityMap;
  }

  private static EntityInterface entityWithStatus(EntityStatus status) {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getEntityStatus()).thenReturn(status);
    return entity;
  }
}
