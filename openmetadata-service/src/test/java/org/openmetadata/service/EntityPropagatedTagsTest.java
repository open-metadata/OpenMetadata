/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.TagLabel.LabelType;
import org.openmetadata.schema.type.TagLabel.TagSource;
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.util.EntityUtil;

/**
 * Covers the read-time projection of a parent's glossary terms onto its fields (table columns, data
 * model columns, API endpoint schema fields).
 */
class EntityPropagatedTagsTest {

  private static TagLabel tag(String fqn, TagSource source, LabelType labelType) {
    return new TagLabel().withTagFQN(fqn).withSource(source).withLabelType(labelType);
  }

  @Test
  void glossaryTermOnParentIsProjectedAsPropagated() {
    List<TagLabel> projected =
        Entity.propagatedParentTags(List.of(tag("g.term", TagSource.GLOSSARY, LabelType.MANUAL)));

    assertEquals(1, projected.size());
    assertEquals("g.term", projected.getFirst().getTagFQN());
    assertEquals(LabelType.PROPAGATED, projected.getFirst().getLabelType());
  }

  @Test
  void projectionDoesNotMutateTheParentsOwnLabel() {
    TagLabel parentLabel = tag("g.term", TagSource.GLOSSARY, LabelType.MANUAL);

    Entity.propagatedParentTags(List.of(parentLabel));

    // Without the defensive copy the parent entity's own tags would flip to PROPAGATED too.
    assertEquals(LabelType.MANUAL, parentLabel.getLabelType());
  }

  @Test
  void classificationAndDerivedParentLabelsAreNotProjected() {
    List<TagLabel> projected =
        Entity.propagatedParentTags(
            List.of(
                tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.MANUAL),
                tag("g.derived", TagSource.GLOSSARY, LabelType.DERIVED)));

    assertTrue(projected.isEmpty());
  }

  @Test
  void emptyAndNullParentTagsProjectNothing() {
    assertTrue(Entity.propagatedParentTags(null).isEmpty());
    assertTrue(Entity.propagatedParentTags(List.of()).isEmpty());
  }

  /**
   * A projected label must never reach {@code tag_usage}. A client that GETs a table (columns now
   * carrying PROPAGATED labels) and PUTs it back would otherwise pin the label in place, so it would
   * survive the parent's term being removed — the phantom tag this change set exists to remove.
   */
  @Test
  void projectedAndRecomputedLabelsAreNotPersistable() {
    assertTrue(
        TagLabelUtil.isSystemGenerated(tag("g.term", TagSource.GLOSSARY, LabelType.PROPAGATED)));
    assertTrue(
        TagLabelUtil.isSystemGenerated(tag("g.term", TagSource.GLOSSARY, LabelType.DERIVED)));
  }

  @Test
  void userAppliedLabelsRemainPersistable() {
    assertFalse(
        TagLabelUtil.isSystemGenerated(tag("g.term", TagSource.GLOSSARY, LabelType.MANUAL)));
    assertFalse(
        TagLabelUtil.isSystemGenerated(
            tag("PII.Sensitive", TagSource.CLASSIFICATION, LabelType.AUTOMATED)));
    assertFalse(TagLabelUtil.isSystemGenerated(null));
  }

  @Test
  void aFieldsOwnLabelWinsOverTheProjectedOne() {
    List<TagLabel> fieldTags =
        new ArrayList<>(List.of(tag("g.term", TagSource.GLOSSARY, LabelType.MANUAL)));
    List<TagLabel> projected =
        Entity.propagatedParentTags(List.of(tag("g.term", TagSource.GLOSSARY, LabelType.MANUAL)));

    EntityUtil.mergeTags(fieldTags, projected);

    assertEquals(1, fieldTags.size());
    assertEquals(LabelType.MANUAL, fieldTags.getFirst().getLabelType());
  }
}
