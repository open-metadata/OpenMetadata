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
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.OwnerResolver;

/**
 * Resolves the first owner's team name through {@link OwnerResolver} and writes it to the
 * snapshot under {@code team}. Owners that cannot be resolved (deleted user, missing id, null
 * owner ref, no teams) degrade gracefully — the {@code team} key is simply absent on that
 * snapshot rather than aborting the entity's enrichment.
 */
public final class OwnerTeamStep implements EnrichmentStep {

  public static final String NAME = "team";

  private final OwnerResolver ownerResolver;

  public OwnerTeamStep(OwnerResolver ownerResolver) {
    this.ownerResolver = ownerResolver;
  }

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    List<EntityReference> owners = target.entity().getOwners();
    if (owners == null || owners.isEmpty()) {
      return;
    }
    ownerResolver
        .resolveTeamName(owners.get(0), target.shape())
        .ifPresent(team -> target.entityMap().put("team", team));
  }
}
