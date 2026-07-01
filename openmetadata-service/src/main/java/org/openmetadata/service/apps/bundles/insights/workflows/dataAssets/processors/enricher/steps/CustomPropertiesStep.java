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

import java.util.List;
import java.util.Map;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * If the entity carries an {@code extension} field, project it into the two DI-queryable shapes the
 * live data-asset index also exposes:
 *
 * <ul>
 *   <li>a per-entity-type twin (e.g. {@code tableCustomProperty}, {@code dashboardCustomProperty}),
 *       dynamically mapped so each sub-field is term-queryable — this is what Group By charts use;
 *   <li>{@code customPropertiesTyped}, the typed {@code nested} structure produced by {@link
 *       SearchIndexUtils#buildTypedCustomProperties}. The advanced-search builder emits custom-property
 *       filters as {@code nested} queries against this path, so without it those saved filters match
 *       nothing in the DI snapshot and the whole chart collapses to 0. Only written when the builder
 *       yields at least one entry — mirroring the live index, an extension that produces no typed
 *       entries adds no empty {@code nested} array.
 * </ul>
 *
 * <p>The raw {@code extension} key is intentionally left on the document — custom-property search
 * filters key off it, so removing it would break those filters.
 */
public final class CustomPropertiesStep implements EnrichmentStep {

  public static final String NAME = "customProperties";

  private static final String CUSTOM_PROPERTY_TWIN_SUFFIX = "CustomProperty";
  private static final String CUSTOM_PROPERTIES_TYPED_KEY = "customPropertiesTyped";
  private static final String EXTENSION_KEY = "extension";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    Object customProperties = target.entityMap().get(EXTENSION_KEY);
    if (customProperties != null) {
      String entityType = target.context().entityType();
      target.entityMap().put(entityType + CUSTOM_PROPERTY_TWIN_SUFFIX, customProperties);
      List<Map<String, Object>> typedProperties =
          SearchIndexUtils.buildTypedCustomProperties(customProperties, entityType);
      if (!typedProperties.isEmpty()) {
        target.entityMap().put(CUSTOM_PROPERTIES_TYPED_KEY, typedProperties);
      }
    }
  }
}
