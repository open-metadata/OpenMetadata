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

import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/**
 * If the entity carries an {@code extension} field, copy it into a per-entity-type key (e.g.
 * {@code tableCustomProperty}, {@code dashboardCustomProperty}). The {@code extension} key is
 * intentionally left on the document — custom-property search filters key off it, so removing
 * it would break those filters.
 */
public final class CustomPropertiesStep implements EnrichmentStep {

  public static final String NAME = "customProperties";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    Object customProperties = target.entityMap().get("extension");
    if (customProperties != null) {
      target
          .entityMap()
          .put(String.format("%sCustomProperty", target.context().entityType()), customProperties);
    }
  }
}
