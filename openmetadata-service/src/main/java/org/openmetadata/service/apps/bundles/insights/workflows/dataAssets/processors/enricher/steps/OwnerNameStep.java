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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.List;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/**
 * Projects a flat {@code ownerName} keyword list onto the snapshot, mirroring the computed field
 * the entity search index sets in {@code SearchIndex.populateCommonFields}. The DI document
 * otherwise carries owners only as the {@code nested} {@code owners} array, which flat
 * {@code query_string} DI filters (e.g. {@code ownerName: *}) cannot reach. Entities with no
 * owners contribute no {@code ownerName} key rather than an empty list, so a
 * {@code query_string} existence filter cleanly excludes unowned assets.
 */
public final class OwnerNameStep implements EnrichmentStep {

  public static final String NAME = "ownerName";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    List<EntityReference> owners = target.entity().getOwners();
    if (nullOrEmpty(owners)) {
      return;
    }
    List<String> ownerNames =
        owners.stream().map(EntityReference::getName).filter(name -> !nullOrEmpty(name)).toList();
    if (!ownerNames.isEmpty()) {
      target.entityMap().put(NAME, ownerNames);
    }
  }
}
