package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

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
import org.openmetadata.service.resources.tags.TagLabelUtil;
import org.openmetadata.service.search.PropagationDescriptor;
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

  /**
   * Under a mutually exclusive classification an entity may hold only one tag. Inheritance runs on
   * the read path, where {@code checkMutuallyExclusive} does not, so without a guard a table tagged
   * {@code Tier.Tier2} beneath a database tagged {@code Tier.Tier1} reports both -- a combination
   * the write path rejects outright. The asset's own choice is the more specific one and wins.
   */
  @Test
  void inheritTags_doesNotAddATagExcludedByTheAssetsOwnChoice() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class);
        MockedStatic<TagLabelUtil> tagLabels = mockStatic(TagLabelUtil.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      tagLabels.when(() -> TagLabelUtil.mutuallyExclusive(any())).thenReturn(true);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("Tier.Tier2"))));

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("Tier.Tier1"));

      assertEquals(
          List.of("Tier.Tier2"),
          tagFqns(table),
          "the asset keeps its own tier and does not also inherit the parent's");
    }
  }

  /** A different classification is not excluded by the asset's tier, so it still propagates. */
  @Test
  void inheritTags_stillAddsATagFromAnUnrelatedClassification() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class);
        MockedStatic<TagLabelUtil> tagLabels = mockStatic(TagLabelUtil.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      tagLabels.when(() -> TagLabelUtil.mutuallyExclusive(any())).thenReturn(true);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("Tier.Tier2"))));

      EntityRepository.applyInheritedTags(table, TAG_FIELDS, parentWithTags("PII.Sensitive"));

      assertEquals(List.of("Tier.Tier2", "PII.Sensitive"), tagFqns(table));
    }
  }

  /**
   * A non-exclusive classification keeps merge semantics: two Environment values on one asset are
   * allowed, so the parent's still arrives.
   */
  @Test
  void inheritTags_mergesSiblingsOfANonExclusiveClassification() {
    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class);
        MockedStatic<TagLabelUtil> tagLabels = mockStatic(TagLabelUtil.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(true);
      tagLabels.when(() -> TagLabelUtil.mutuallyExclusive(any())).thenReturn(false);
      Table table = table();
      table.setTags(new ArrayList<>(List.of(manual("Environment.Staging"))));

      EntityRepository.applyInheritedTags(
          table, TAG_FIELDS, parentWithTags("Environment.Development"));

      assertEquals(List.of("Environment.Staging", "Environment.Development"), tagFqns(table));
    }
  }

  /**
   * The search cascade must be gated on the same setting as the read-time inheritance. It carries a
   * parent's OWN tags into child documents, so leaving it ungated would write tags into Explore
   * that {@code GET /{entity}/{id}} does not report while propagation is off.
   */
  @Test
  void searchPropagationDescriptors_carryTags_onlyWhilePropagationIsEnabled() {
    DatabaseRepository repository = mock(DatabaseRepository.class);
    when(repository.getSearchPropagationDescriptors()).thenCallRealMethod();

    try (MockedStatic<TagPropagation> propagation = mockStatic(TagPropagation.class)) {
      propagation.when(TagPropagation::isEnabled).thenReturn(false);

      assertFalse(
          propagatesField(repository.getSearchPropagationDescriptors(), Entity.FIELD_TAGS),
          "with propagation off the cascade must not carry tags into child documents");

      propagation.when(TagPropagation::isEnabled).thenReturn(true);

      assertTrue(
          propagatesField(repository.getSearchPropagationDescriptors(), Entity.FIELD_TAGS),
          "with propagation on the cascade keeps search in step with the API");
    }
  }

  /**
   * {@code TableRepository} and {@code DatabaseSchemaRepository} load their parent themselves rather
   * than going through {@code setInheritedFields}, choosing the projection from what inheritance
   * actually needs. Omitting {@code tags} there loads a parent with none, so the merge has nothing
   * to copy and propagation silently does nothing on the read path.
   */
  @Test
  void inheritanceParentFields_asksTheParentForTagsOnlyWhenTagsAreNeeded() {
    assertEquals(
        "owners,domains,retentionPeriod,tags",
        EntityRepository.inheritanceParentFields(true, true, true));
    assertEquals("tags", EntityRepository.inheritanceParentFields(false, false, true));
    assertEquals("owners,domains", EntityRepository.inheritanceParentFields(true, false, false));
    assertEquals("retentionPeriod", EntityRepository.inheritanceParentFields(false, true, false));
  }

  /**
   * Read-time inheritance is only safe on the write path because inherited labels are stamped
   * {@code DERIVED} and the write path throws that label class away before it validates.
   *
   * <p>PATCH loads its original through {@code getByName}, which applies inheritance, and the patch
   * is then applied on top -- so an inherited {@code Tier.Tier1} does reach {@code prepareInternal}
   * alongside a caller's {@code Tier.Tier2}. What stops that being rejected as mutually exclusive
   * is {@code validateTags} calling {@link TagLabelUtil#addDerivedTags} first, which filters
   * {@code DERIVED} out before {@code checkMutuallyExclusive} sees the list. {@code applyTags}
   * skips {@code DERIVED} for the same reason, which is why nothing inherited is persisted.
   *
   * <p>This test exists because that safety is not local to the inheritance code: stamping
   * inherited labels anything other than {@code DERIVED}, or validating before the filter, would
   * start rejecting writes over tags the caller never applied.
   */
  @Test
  void addDerivedTags_dropsInheritedLabelsBeforeExclusivityIsChecked() {
    List<TagLabel> fromInheritance =
        List.of(manual("Tier.Tier2"), derived("Tier.Tier1"), derived("PII.Sensitive"));

    List<String> survived =
        TagLabelUtil.addDerivedTags(fromInheritance).stream().map(TagLabel::getTagFQN).toList();

    assertEquals(
        List.of("Tier.Tier2"),
        survived,
        "an inherited label must not reach the mutually-exclusive check as a caller's tag");
  }

  private static TagLabel derived(String fqn) {
    return manual(fqn).withLabelType(TagLabel.LabelType.DERIVED);
  }

  private static boolean propagatesField(
      List<PropagationDescriptor> descriptors, String fieldName) {
    return descriptors.stream().anyMatch(d -> fieldName.equals(d.fieldName()));
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
