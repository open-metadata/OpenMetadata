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
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;

/**
 * Contract for the tag/tier-emission step. Pins the issue-29355 fix: the step projects the
 * entity-level {@code tags[]} split by {@link TagLabel.TagSource} into {@code classificationTags}
 * and {@code glossaryTags} FQN lists (mirroring the live index's {@code ParseTags} semantics), in
 * addition to the pre-existing {@code tagSources}/{@code tierSources} count maps it must keep
 * emitting.
 */
class TagAndTierSourcesStepTest {

  private static final String CLASSIFICATION = "classificationTags";
  private static final String GLOSSARY = "glossaryTags";
  private static final String TAG_SOURCES = "tagSources";
  private static final String TIER_SOURCES = "tierSources";

  private final TagAndTierSourcesStep step = new TagAndTierSourcesStep();

  @Test
  void classificationTagsOnly_populateClassificationBucketOnly() {
    EntityInterface entity =
        entityWithTags(
            List.of(classificationTag("PII.Sensitive"), classificationTag("Tier.Tier1")));

    Map<String, Object> snapshot = run(entity);

    assertEquals(List.of("PII.Sensitive", "Tier.Tier1"), snapshot.get(CLASSIFICATION));
    assertEquals(List.of(), snapshot.get(GLOSSARY));
  }

  @Test
  void glossaryTagsOnly_populateGlossaryBucketOnly() {
    EntityInterface entity =
        entityWithTags(List.of(glossaryTag("Business.Customer"), glossaryTag("Business.Revenue")));

    Map<String, Object> snapshot = run(entity);

    assertEquals(List.of(), snapshot.get(CLASSIFICATION));
    assertEquals(List.of("Business.Customer", "Business.Revenue"), snapshot.get(GLOSSARY));
  }

  @Test
  void mixedTags_splitBySource() {
    EntityInterface entity =
        entityWithTags(
            List.of(
                classificationTag("PII.Sensitive"),
                glossaryTag("Business.Customer"),
                classificationTag("Tier.Tier2"),
                glossaryTag("Business.Revenue")));

    Map<String, Object> snapshot = run(entity);

    assertEquals(List.of("PII.Sensitive", "Tier.Tier2"), snapshot.get(CLASSIFICATION));
    assertEquals(List.of("Business.Customer", "Business.Revenue"), snapshot.get(GLOSSARY));
  }

  @Test
  void emptyTags_emitEmptyLists() {
    EntityInterface entity = entityWithTags(List.of());

    Map<String, Object> snapshot = run(entity);

    assertEquals(List.of(), snapshot.get(CLASSIFICATION));
    assertEquals(List.of(), snapshot.get(GLOSSARY));
  }

  @Test
  void nullTags_emitEmptyLists_andDoesNotThrow() {
    EntityInterface entity = entityWithTags(null);

    Map<String, Object> snapshot = run(entity);

    assertEquals(List.of(), snapshot.get(CLASSIFICATION));
    assertEquals(List.of(), snapshot.get(GLOSSARY));
  }

  @Test
  void existingTagAndTierSourceCounts_areStillEmitted() {
    EntityInterface entity =
        entityWithTags(
            List.of(classificationTag("PII.Sensitive"), classificationTag("Tier.Tier1")));

    Map<String, Object> snapshot = run(entity);

    assertInstanceOf(Map.class, snapshot.get(TAG_SOURCES));
    assertInstanceOf(Map.class, snapshot.get(TIER_SOURCES));
    assertTrue(((Map<?, ?>) snapshot.get(TAG_SOURCES)).containsKey("Manual"));
    assertTrue(((Map<?, ?>) snapshot.get(TIER_SOURCES)).containsKey("Manual"));
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

  private static EntityInterface entityWithTags(List<TagLabel> tags) {
    EntityInterface entity = mock(EntityInterface.class);
    when(entity.getTags()).thenReturn(tags);
    return entity;
  }

  private static TagLabel classificationTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }

  private static TagLabel glossaryTag(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.GLOSSARY)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
