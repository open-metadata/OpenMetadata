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

import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/**
 * Emits the {@code entityStatus} key on the snapshot, mirroring the live search index
 * ({@code SearchIndex}): the entity's governance status, or {@code Unprocessed} when unset. Without
 * this the field is absent for unset assets, so Data Insights charts cannot filter or group by
 * lifecycle status the way Explore can.
 */
public final class EntityStatusStep implements EnrichmentStep {

  public static final String NAME = "entityStatus";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    EntityStatus status = target.entity().getEntityStatus();
    String value = status != null ? status.value() : EntityStatus.UNPROCESSED.value();
    target.entityMap().put("entityStatus", value);
  }
}
