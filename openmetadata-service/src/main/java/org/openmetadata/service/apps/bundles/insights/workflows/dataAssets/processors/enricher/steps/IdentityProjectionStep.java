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

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/**
 * Writes the entity-type identifier onto the snapshot. Per-version window timestamps live on the
 * {@link
 * org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionedWindow}
 * and are read directly by the materializer — they are intentionally NOT put on the entity map
 * here. Must run first in the pipeline.
 */
public final class IdentityProjectionStep implements EnrichmentStep {

  public static final String NAME = "identity";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    target.entityMap().put(ENTITY_TYPE_KEY, target.context().entityType());
  }
}
