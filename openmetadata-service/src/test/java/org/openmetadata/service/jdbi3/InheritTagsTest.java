package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mockStatic;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.TagPropagation;

/**
 * Read-time tag inheritance: the half of service-to-asset tag propagation that the REST API reports.
 * The search half rides on the existing {@code PropagationDescriptor} cascade, which is only correct
 * because this one makes the API agree with it.
 */
class InheritTagsTest {

  private static final Fields TAG_FIELDS = new Fields(Set.of(Entity.FIELD_TAGS));

  @Test
  void inheritTags_isANoOp_whenPropagationIsDisabled() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(false);
      Table table = table();

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("PII.Sensitive"));

      assertTrue(
          tagFqns(table).isEmpty(),
          "with the setting off, a parent tag must not appear on the asset at all");
    }
  }

  /**
   * Merge, not replace. A parent tag is an addition to whatever the asset carries, unlike domain
   * inheritance where the parent only supplies a value the child lacks.
   */
  @Test
  void inheritTags_mergesParentTagsIntoTheAssetsOwn() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("Tier.Tier1"))));

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("PII.Sensitive"));

      assertEquals(List.of("Tier.Tier1", "PII.Sensitive"), tagFqns(table));
    }
  }

  /** Inherited labels are Derived, which the platform already treats as not user-editable. */
  @Test
  void inheritTags_marksInheritedLabelsAsDerived() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Table table = table();

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("PII.Sensitive"));

      assertEquals(1, table.getTags().size());
      assertEquals(TagLabel.LabelType.DERIVED, table.getTags().get(0).getLabelType());
    }
  }

  /** The parent's own label must not be rewritten to Derived as a side effect of the copy. */
  @Test
  void inheritTags_doesNotMutateTheParentsLabels() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Database parent = parentWithTags("PII.Sensitive");

      EntityRepository.applyInheritedTags(table(), TAG_FIELDS, parent);

      assertEquals(TagLabel.LabelType.MANUAL, parent.getTags().get(0).getLabelType());
    }
  }

  /** An asset that already carries the parent's tag keeps one copy, not two. */
  @Test
  void inheritTags_doesNotDuplicateATagTheAssetAlreadyHas() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("PII.Sensitive"))));

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("PII.Sensitive"));

      assertEquals(List.of("PII.Sensitive"), tagFqns(table));
      assertEquals(
          TagLabel.LabelType.MANUAL,
          table.getTags().get(0).getLabelType(),
          "the asset's own label wins over the inherited copy");
    }
  }

  /** Nothing to inherit must not disturb what the asset already has. */
  @Test
  void inheritTags_leavesTheAssetAloneWhenTheParentHasNoTags() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("Tier.Tier1"))));

      EntityRepository.applyInheritedTags(
          table, TAG_FIELDS, new Database().withId(UUID.randomUUID()));

      assertEquals(List.of("Tier.Tier1"), tagFqns(table));
    }
  }

  /** Only applies when the caller asked for tags; otherwise the field is not loaded at all. */
  @Test
  void inheritTags_isANoOp_whenTagsWereNotRequested() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      Table table = table();

      EntityRepository.applyInheritedTags(
          table, Fields.EMPTY_FIELDS, parentWithTags("PII.Sensitive"));

      assertTrue(tagFqns(table).isEmpty());
    }
  }

  private static Table table() {
    return new Table().withId(UUID.randomUUID()).withName("t");
  }

  private static Database parentWithTags(String... tagFQNs) {
    Database database = new Database().withId(UUID.randomUUID()).withName("db");
    List<TagLabel> tags = new ArrayList<>();
    for (String fqn : tagFQNs) {
      tags.add(manual(fqn));
    }
    database.setTags(tags);
    return database;
  }

  private static TagLabel manual(String fqn) {
    return new TagLabel()
        .withTagFQN(fqn)
        .withSource(TagLabel.TagSource.CLASSIFICATION)
        .withLabelType(TagLabel.LabelType.MANUAL)
        .withState(TagLabel.State.CONFIRMED);
  }

  private static List<String> tagFqns(Table table) {
    return table.getTags() == null
        ? List.of()
        : table.getTags().stream().map(TagLabel::getTagFQN).toList();
  }
}
