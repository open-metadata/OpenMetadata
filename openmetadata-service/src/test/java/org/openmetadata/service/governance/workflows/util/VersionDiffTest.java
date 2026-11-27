/*
 *  Copyright 2026 Collate
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
package org.openmetadata.service.governance.workflows.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.type.Votes;
import org.openmetadata.service.governance.workflows.util.ChangePreviewUtils.FieldDiff;

class VersionDiffTest {
  private static final UUID TERM_ID = UUID.randomUUID();

  @Test
  void between_aFieldShowsItsOldAndNewValue() {
    ChangeDescription change =
        VersionDiff.between(
            term(0.1).withDescription("Original"), term(0.5).withDescription("Edited"));

    assertEquals(
        Map.of("description", new FieldDiff(List.of("Edited"), List.of("Original"))),
        ChangePreviewUtils.buildChangeMap(change));
    assertEquals(0.1, change.getPreviousVersion());
  }

  @Test
  void between_aListShowsTheElementsItGainedAndLost() {
    ChangeDescription change =
        VersionDiff.between(
            term(0.1).withTags(List.of(tag("PII.Sensitive"))).withSynonyms(List.of("Old")),
            term(0.5).withTags(List.of(tag("Tier.Tier1"))).withSynonyms(List.of("Old", "Alias")));

    assertEquals(
        Map.of(
            "tags", new FieldDiff(List.of("Tier.Tier1"), List.of("PII.Sensitive")),
            "synonyms", new FieldDiff(List.of("Alias"), List.of())),
        ChangePreviewUtils.buildChangeMap(change));
  }

  // The fold names an extension property by itself, so the comparison does too.
  @Test
  void between_anExtensionPropertyIsNamedByItself() {
    ChangeDescription change =
        VersionDiff.between(
            term(0.1).withExtension(Map.of("steward", "Data team", "kept", "same")),
            term(0.5).withExtension(Map.of("steward", "Platform team", "kept", "same")));

    assertEquals(
        Map.of("extension.steward", new FieldDiff(List.of("Platform team"), List.of("Data team"))),
        ChangePreviewUtils.buildChangeMap(change));
  }

  // What every write moves, what a rename derives, what a follow or vote changes without a new
  // version, and tags the term only derives are not edits a reviewer approves.
  @Test
  void between_bookkeepingFollowsVotesAndDerivedTagsAreNotChanges() {
    GlossaryTerm before = term(0.1).withUpdatedBy("author").withUpdatedAt(1L);
    GlossaryTerm after =
        term(0.5)
            .withUpdatedBy("governance-bot")
            .withUpdatedAt(2L)
            .withFullyQualifiedName("glossary.renamed")
            .withVotes(new Votes().withUpVotes(1))
            .withTags(List.of(tag("Derived.Tag").withLabelType(TagLabel.LabelType.DERIVED)))
            .withChangeDescription(
                new ChangeDescription()
                    .withFieldsUpdated(List.of(new FieldChange().withName("description"))));

    assertTrue(ChangePreviewUtils.hasNoChanges(VersionDiff.between(before, after)));
  }

  @Test
  void between_inheritedReferencesInTheHistoricalVersionAreNotRemovals() {
    GlossaryTerm before =
        term(0.1)
            .withDescription("Original")
            .withOwners(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType("team")
                        .withInherited(true)))
            .withReviewers(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType("user")
                        .withInherited(true)))
            .withDomains(
                List.of(
                    new EntityReference()
                        .withId(UUID.randomUUID())
                        .withType("domain")
                        .withInherited(true)));
    GlossaryTerm after = term(0.5).withDescription("Edited");

    assertEquals(
        Map.of("description", new FieldDiff(List.of("Edited"), List.of("Original"))),
        ChangePreviewUtils.buildChangeMap(VersionDiff.between(before, after)));
  }

  @Test
  void between_aNewFollowerIsNotAChange() {
    Metric before = new Metric().withId(TERM_ID).withName("metric").withVersion(0.1);
    Metric after =
        new Metric()
            .withId(TERM_ID)
            .withName("metric")
            .withVersion(0.2)
            .withFollowers(
                List.of(new EntityReference().withId(UUID.randomUUID()).withType("user")));

    assertTrue(ChangePreviewUtils.hasNoChanges(VersionDiff.between(before, after)));
  }

  private static GlossaryTerm term(double version) {
    return new GlossaryTerm()
        .withId(TERM_ID)
        .withName("term")
        .withFullyQualifiedName("glossary.term")
        .withVersion(version);
  }

  private static TagLabel tag(String tagFqn) {
    return new TagLabel()
        .withTagFQN(tagFqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL);
  }
}
