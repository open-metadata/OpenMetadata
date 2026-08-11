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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;

/**
 * Contract for the tier-emission step: default {@code "NoTier"} on tier-eligible entities,
 * override from any tag whose FQN starts with {@code "Tier"}, no key emitted for
 * tag/glossaryTerm/dataProduct unless they explicitly carry a Tier-prefixed tag.
 */
class TierStepTest {

  private final TierStep step = new TierStep();

  @Test
  void tierEligibleEntity_noTierTag_emitsNoTierDefault() {
    EntityInterface entity = entityWithTags(List.of());
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("NoTier", snapshot.get("tier"));
  }

  @Test
  void tierEligibleEntity_withTierTag_emitsTagFqn() {
    EntityInterface entity = entityWithTags(List.of(tag("Tier.Tier2")));
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("Tier.Tier2", snapshot.get("tier"));
  }

  @Test
  void tierEligibleEntity_firstTierTagWins() {
    EntityInterface entity =
        entityWithTags(List.of(tag("PII.Sensitive"), tag("Tier.Tier3"), tag("Tier.Tier1")));
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("Tier.Tier3", snapshot.get("tier"));
  }

  @Test
  void nonTierEntity_noTierTag_emitsNothing() {
    EntityInterface entity = entityWithTags(List.of(tag("Domain.Sales")));
    Map<String, Object> snapshot = run(entity, "tag");
    assertFalse(snapshot.containsKey("tier"));
  }

  @Test
  void nonTierEntity_withTierTag_emitsTagFqn() {
    // Even a NON_TIER_ENTITIES type, if explicitly tagged with Tier.*, still gets the tier
    // emitted.
    EntityInterface entity = entityWithTags(List.of(tag("Tier.Tier4")));
    Map<String, Object> snapshot = run(entity, "glossaryTerm");
    assertEquals("Tier.Tier4", snapshot.get("tier"));
  }

  @Test
  void tierEligibleEntity_nullTagsList_emitsNoTierDefault() {
    EntityInterface entity = entityWithTags(null);
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("NoTier", snapshot.get("tier"));
  }

  @Test
  void tierEligibleEntity_tagsWithNullEntries_skipsThemGracefully() {
    // Defensive against malformed deserialization. The step must not NPE on a null TagLabel.
    List<TagLabel> tags = new ArrayList<>();
    tags.add(null);
    tags.add(tag("Tier.Tier2"));
    tags.add(null);
    EntityInterface entity = entityWithTags(tags);
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("Tier.Tier2", snapshot.get("tier"));
  }

  @Test
  void tagWithNullFqn_doesNotMatchTierPrefix() {
    EntityInterface entity = entityWithTags(List.of(new TagLabel())); // tagFQN null
    Map<String, Object> snapshot = run(entity, "table");
    assertEquals("NoTier", snapshot.get("tier"));
  }

  // ─────────────── helpers ───────────────

  private Map<String, Object> run(EntityInterface entity, String entityType) {
    try (MockedStatic<Entity> entityMock = mockStatic(Entity.class)) {
      entityMock.when(() -> Entity.getEntityTypeFromObject(any())).thenReturn(entityType);

      Map<String, Object> entityMap = new HashMap<>();
      EnrichmentTarget target =
          new EnrichmentTarget(
              entity,
              entityMap,
              Map.of(),
              0L,
              0L,
              new EnrichmentContext(entityType, List.of(), 0L, 0L),
              VersionShape.LATEST_HYDRATED);
      step.apply(target);
      return entityMap;
    }
  }

  private static EntityInterface entityWithTags(List<TagLabel> tags) {
    EntityInterface entity = org.mockito.Mockito.mock(EntityInterface.class);
    when(entity.getTags()).thenReturn(tags);
    return entity;
  }

  private static TagLabel tag(String fqn) {
    return new TagLabel().withTagFQN(fqn);
  }
}
