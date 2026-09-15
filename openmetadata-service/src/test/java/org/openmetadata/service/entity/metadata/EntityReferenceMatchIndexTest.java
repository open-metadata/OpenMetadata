package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.Random;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.function.BiPredicate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;

class EntityReferenceMatchIndexTest {
  private static final String FIELD = "references";

  @Test
  void unchangedThousandReferenceDiffUsesLinearIdentityReads() {
    final AtomicInteger reads = new AtomicInteger();
    final List<EntityReference> original = new ArrayList<>();
    final List<EntityReference> updated = new ArrayList<>();
    for (int i = 0; i < 1000; i++) {
      original.add(countingReference(i, reads));
      updated.add(countingReference(i, reads));
    }
    final ListChange<EntityReference> values = changes(original, updated, entityReferenceMatch);
    final ChangeDescription result = new ChangeDescription();
    assertFalse(EntityChangeRecorder.recordList(result, FIELD, values));
    assertFalse(EntityChangeRecorder.hasChanges(result));
    assertTrue(reads.get() < 20000, "Identity reads: " + reads.get());
  }

  @Test
  void identityIncludesTypeAndIgnoresDisplayMetadata() {
    final EntityReference original = reference(1, Entity.USER);
    final EntityReference renamed = reference(1, Entity.USER).withName("renamed");
    assertMatchesLinear(List.of(original), List.of(renamed), entityReferenceMatch);
    assertMatchesLinear(
        List.of(original), List.of(reference(1, Entity.TEAM)), entityReferenceMatch);
  }

  @Test
  void duplicateAdditionsAndDeletionsRetainPayloadOrder() {
    assertMatchesLinear(
        List.of(reference(2, Entity.TEAM), reference(2, Entity.TEAM), reference(1, Entity.USER)),
        List.of(reference(3, Entity.USER), reference(1, Entity.USER), reference(3, Entity.USER)),
        entityReferenceMatch);
  }

  @Test
  void arbitraryReferencePredicatesKeepTheirMatchingRules() {
    assertMatchesLinear(
        List.of(reference(1, Entity.USER)),
        List.of(reference(2, Entity.TEAM).withName("reference1")),
        (left, right) -> left.getName().equals(right.getName()));
  }

  @Test
  void generatedValidListsHaveTheSameDeltasAsTheLinearMatcher() {
    final Random random = new Random(9751);
    for (int i = 0; i < 100; i++) {
      assertMatchesLinear(randomReferences(random), randomReferences(random), entityReferenceMatch);
    }
  }

  @Test
  void emptySidesKeepTheExistingAddAndDeleteSemantics() {
    final List<EntityReference> values = new ArrayList<>();
    values.add(reference(1, Entity.USER));
    values.add(null);
    assertMatchesLinear(null, values, entityReferenceMatch);
    assertMatchesLinear(values, null, entityReferenceMatch);
    assertMatchesLinear(null, null, entityReferenceMatch);
  }

  @Test
  void malformedReferenceErrorsRemainVisible() {
    final List<EntityReference> valid = List.of(reference(1, Entity.USER));
    assertInvalid(valid, List.of(new EntityReference().withType(Entity.USER)));
    assertInvalid(valid, List.of(new EntityReference().withId(new UUID(0, 1))));
    final List<EntityReference> withNull = new ArrayList<>(valid);
    withNull.add(null);
    assertInvalid(withNull, valid);
    assertInvalid(valid, withNull);
  }

  private static void assertInvalid(
      final List<EntityReference> original, final List<EntityReference> updated) {
    final ListChange<EntityReference> linear = changes(original, updated, entityReferenceMatch);
    assertThrows(
        NullPointerException.class,
        () -> EntityChangeRecorder.recordList(new ChangeDescription(), FIELD, linear, linear));
    assertThrows(
        NullPointerException.class,
        () ->
            EntityChangeRecorder.recordList(
                new ChangeDescription(), FIELD, changes(original, updated, entityReferenceMatch)));
  }

  private static void assertMatchesLinear(
      final List<EntityReference> original,
      final List<EntityReference> updated,
      final BiPredicate<EntityReference, EntityReference> match) {
    final ListChange<EntityReference> linear = changes(original, updated, match);
    final ListChange<EntityReference> indexed = changes(original, updated, match);
    final ChangeDescription expected = new ChangeDescription();
    final ChangeDescription actual = new ChangeDescription();
    assertEquals(
        EntityChangeRecorder.recordList(expected, FIELD, linear, linear),
        EntityChangeRecorder.recordList(actual, FIELD, indexed));
    assertEquals(JsonUtils.pojoToJson(expected), JsonUtils.pojoToJson(actual));
    assertEquals(linear.added(), indexed.added());
    assertEquals(linear.deleted(), indexed.deleted());
  }

  private static ListChange<EntityReference> changes(
      final List<EntityReference> original,
      final List<EntityReference> updated,
      final BiPredicate<EntityReference, EntityReference> match) {
    return new ListChange<>(original, updated, new ArrayList<>(), new ArrayList<>(), match);
  }

  private static List<EntityReference> randomReferences(final Random random) {
    final List<EntityReference> result = new ArrayList<>();
    final int size = random.nextInt(30);
    for (int i = 0; i < size; i++) {
      result.add(reference(random.nextInt(15), random.nextBoolean() ? Entity.USER : Entity.TEAM));
    }
    return result;
  }

  private static EntityReference reference(final int id, final String type) {
    return new EntityReference().withId(new UUID(0, id)).withType(type).withName("reference" + id);
  }

  private static EntityReference countingReference(final int id, final AtomicInteger reads) {
    return new CountingReference(reads).withId(new UUID(0, id)).withType(Entity.USER);
  }

  private static final class CountingReference extends EntityReference {
    private final AtomicInteger reads;

    private CountingReference(final AtomicInteger reads) {
      this.reads = reads;
    }

    @Override
    public UUID getId() {
      reads.incrementAndGet();
      return super.getId();
    }

    @Override
    public String getType() {
      reads.incrementAndGet();
      return super.getType();
    }
  }
}
