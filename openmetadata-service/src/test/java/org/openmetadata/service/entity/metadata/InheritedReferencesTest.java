package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.util.EntityUtil.Fields;

class InheritedReferencesTest {
  @Test
  void inheritedValuesAreIndependentOfTheirParentAndSiblings() {
    final var owner = reference();
    final var parent = new Table().withOwners(List.of(owner));
    final var first = new Table();
    final var second = new Table();
    final var fields = new Fields(Set.of(FIELD_OWNERS));
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, first, fields, parent);
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, second, fields, parent);
    first.getOwners().getFirst().setName("mutated");
    assertEquals("original", owner.getName());
    assertEquals("original", second.getOwners().getFirst().getName());
    assertTrue(second.getOwners().getFirst().getInherited());
    assertNull(owner.getInherited());
  }

  @Test
  void localAndUnrequestedValuesRetainTheirOriginalLists() {
    final List<EntityReference> owners = List.of(reference());
    final var child = new Table().withOwners(owners);
    final var parent = new Table().withOwners(List.of(reference()));
    final var requested = new Fields(Set.of(FIELD_OWNERS));
    assertSame(
        owners,
        InheritedReferences.resolve(InheritedReferences.Field.OWNERS, child, requested, parent));
    InheritedReferences.apply(InheritedReferences.Field.OWNERS, child, requested, parent);
    assertSame(owners, child.getOwners());
    assertSame(
        owners,
        InheritedReferences.resolve(
            InheritedReferences.Field.OWNERS, child, Fields.EMPTY_FIELDS, parent));
    assertNull(
        InheritedReferences.resolve(
            InheritedReferences.Field.OWNERS, new Table(), requested, null));
  }

  @Test
  void emptyParentValuesRemainEmpty() {
    final var child = new Table();
    InheritedReferences.apply(
        InheritedReferences.Field.DOMAINS, child, new Fields(Set.of(FIELD_DOMAINS)), new Table());
    assertTrue(child.getDomains().isEmpty());
  }

  @Test
  void reviewersMergeLocalAndInheritedEntriesWithLocalPrecedence() {
    final var local = reference().withInherited(false);
    final var additional = reference();
    final var child = new GlossaryTerm().withReviewers(List.of(local));
    final var parent = new GlossaryTerm().withReviewers(List.of(local, additional));
    InheritedReferences.apply(
        InheritedReferences.Field.REVIEWERS, child, new Fields(Set.of(FIELD_REVIEWERS)), parent);
    assertEquals(2, child.getReviewers().size());
    assertFalse(
        child.getReviewers().stream()
            .filter(ref -> ref.getId().equals(local.getId()))
            .findFirst()
            .orElseThrow()
            .getInherited());
    assertTrue(
        child.getReviewers().stream()
            .filter(ref -> ref.getId().equals(additional.getId()))
            .findFirst()
            .orElseThrow()
            .getInherited());
    assertNull(additional.getInherited());
  }

  private static EntityReference reference() {
    return new EntityReference().withId(UUID.randomUUID()).withType("user").withName("original");
  }
}
