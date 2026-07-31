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
import java.util.Set;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/**
 * Emits the {@code tier} key on the snapshot:
 *
 * <ul>
 *   <li>Tier-eligible entity (not a tag / glossaryTerm / dataProduct) with no Tier-prefixed tag
 *       gets {@code tier=NoTier}.
 *   <li>Any entity (including the non-tier-eligible types above) whose tag list contains an
 *       FQN starting with {@code "Tier"} gets that FQN as its tier value — the explicit tag
 *       overrides the NON_TIER default.
 *   <li>Otherwise no {@code tier} key is written.
 * </ul>
 */
public final class TierStep implements EnrichmentStep {

  public static final String NAME = "tier";
  private static final Set<String> NON_TIER_ENTITIES = Set.of("tag", "glossaryTerm", "dataProduct");

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    EntityInterface entity = target.entity();
    String tier = null;
    if (!NON_TIER_ENTITIES.contains(Entity.getEntityTypeFromObject(entity))) {
      tier = "NoTier";
    }
    String tierFromTag = firstTierTag(entity.getTags());
    if (tierFromTag != null) {
      tier = tierFromTag;
    }
    if (tier != null) {
      target.entityMap().put("tier", tier);
    }
  }

  private static String firstTierTag(List<TagLabel> tags) {
    if (tags == null) {
      return null;
    }
    for (TagLabel tag : tags) {
      if (tag == null) {
        continue;
      }
      String fqn = tag.getTagFQN();
      if (fqn != null && fqn.startsWith("Tier")) {
        return fqn;
      }
    }
    return null;
  }
}
