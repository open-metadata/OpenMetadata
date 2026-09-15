package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.METRIC;
import static org.openmetadata.service.Entity.TEAM;
import static org.openmetadata.service.Entity.USER;
import static org.openmetadata.service.util.EntityUtil.entityReferenceMatch;

import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import java.util.function.BiPredicate;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.write.EntityChangeRecorder;
import org.openmetadata.service.entity.write.EntityChangeRecorder.ListChange;
import org.openmetadata.service.security.AuthorizationException;

class EntityGovernanceUpdatesTest {
  @Test
  void unsupportedFieldsHaveNoValidationPersistenceOrApprovalEffects() {
    final Fixture fixture = new Fixture(false);
    fixture.original.setEntityStatus(EntityStatus.IN_REVIEW);
    fixture.updated.setEntityStatus(EntityStatus.APPROVED);
    fixture.updated.setDataProducts(List.of(reference(2, DATA_PRODUCT)));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    fixture.updates.updateExperts(fixture, fixture.original, fixture.updated);
    fixture.updates.updateReviewers(fixture, fixture.original, fixture.updated);
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false);
    assertEquals(0, fixture.referenceReads);
    assertEquals(0, fixture.store.writes);
    assertTrue(fixture.lineage.isEmpty());
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
  }

  @Test
  void botPutStillValidatesIncomingDataProductsBeforePreservingHumanValues() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.original.setDataProducts(List.of(reference(1, DATA_PRODUCT)));
    final EntityReference incoming = reference(2, DATA_PRODUCT).withName("unvalidated");
    fixture.updated.setDataProducts(List.of(incoming));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertSame(fixture.original.getDataProducts(), fixture.updated.getDataProducts());
    assertEquals("reference2", incoming.getName());
    assertEquals(1, fixture.referenceReads);
    assertTrue(fixture.lineage.isEmpty());
    assertEquals(0, fixture.store.writes);
    fixture.rejectReferences = true;
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated));
  }

  @Test
  void dataProductsRequireADomainAfterValidation() {
    final Fixture fixture = new Fixture();
    fixture.updated.setDataProducts(List.of(reference(2, DATA_PRODUCT)));
    assertEquals(
        "Domain cannot be empty when data products are provided.",
        assertThrows(
                IllegalArgumentException.class,
                () ->
                    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated))
            .getMessage());
    assertEquals(1, fixture.referenceReads);
    assertEquals(0, fixture.store.writes);
    assertTrue(fixture.lineage.isEmpty());
  }

  @Test
  void botPatchCanReplaceDataProductsAndKeepsLineageReplacementOrder() {
    final Fixture fixture = new Fixture();
    fixture.bot = true;
    fixture.put = false;
    fixture
        .original
        .withDataProducts(List.of(reference(1, DATA_PRODUCT)))
        .withDomains(List.of(reference(9, DOMAIN)));
    fixture
        .updated
        .withDataProducts(new ArrayList<>(List.of(reference(2, DATA_PRODUCT))))
        .withDomains(List.of(reference(9, DOMAIN)));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertEquals(1, fixture.store.rows.size());
    assertEquals(new UUID(0, 2).toString(), fixture.store.rows.getFirst().getFromId());
    assertEquals(fixture.original.getId().toString(), fixture.store.rows.getFirst().getToId());
    assertEquals(Relationship.HAS.ordinal(), fixture.store.rows.getFirst().getRelation());
    assertEquals(List.of("remove:1", "add:2"), fixture.lineage);
    assertEquals(1, fixture.changes.getFieldsAdded().size());
    assertEquals(1, fixture.changes.getFieldsDeleted().size());
  }

  @Test
  void removingALocalDomainRecordsTheExistingWholeDataProductChange() {
    final Fixture fixture = new Fixture();
    fixture
        .original
        .withDomains(List.of(reference(9, DOMAIN)))
        .withDataProducts(List.of(reference(1, DATA_PRODUCT)));
    fixture
        .updated
        .withDomains(List.of(reference(8, DOMAIN)))
        .withDataProducts(new ArrayList<>(List.of(reference(2, DATA_PRODUCT))));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertEquals(FIELD_DATA_PRODUCTS, fixture.changes.getFieldsUpdated().getFirst().getName());
    assertEquals(List.of("remove:1", "add:2"), fixture.lineage);
  }

  @Test
  void inheritedDomainsAndReferenceTypeChangesDoNotCountAsRemovedLocalDomains() {
    final Fixture fixture = new Fixture();
    fixture
        .original
        .withDomains(List.of(reference(9, DOMAIN).withInherited(true), reference(8, DOMAIN)))
        .withDataProducts(List.of(reference(1, DATA_PRODUCT)));
    fixture
        .updated
        .withDomains(List.of(reference(8, TEAM)))
        .withDataProducts(List.of(reference(2, DATA_PRODUCT)));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertTrue(fixture.changes.getFieldsUpdated().isEmpty());
    assertEquals(1, fixture.changes.getFieldsAdded().size());
  }

  @Test
  void unchangedDataProductsRetainLineageRepairEvenWhenTheFieldIsUnselected() {
    final Fixture fixture = new Fixture();
    fixture.selected = false;
    fixture
        .original
        .withDomains(List.of(reference(9, DOMAIN)))
        .withDataProducts(List.of(reference(1, DATA_PRODUCT)));
    fixture
        .updated
        .withDomains(List.of(reference(8, DOMAIN)))
        .withDataProducts(List.of(reference(1, DATA_PRODUCT)));
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertEquals(0, fixture.store.writes);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    assertEquals(List.of("remove:1", "add:1"), fixture.lineage);
  }

  @Test
  void emptyDataProductsAndMalformedDomainsPreserveExistingOutcomes() {
    final Fixture fixture = new Fixture();
    fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated);
    assertEquals(0, fixture.referenceReads);
    assertEquals(List.of("remove:", "add:"), fixture.lineage);
    final List<EntityReference> invalid = new ArrayList<>();
    invalid.add(null);
    fixture.original.setDomains(invalid);
    assertThrows(
        NullPointerException.class,
        () -> fixture.updates.updateDataProducts(fixture, fixture.original, fixture.updated));
  }

  @Test
  void expertsFilterInheritedValuesAndPersistOutgoingCanonicalUsers() {
    final Fixture fixture = new Fixture(DATA_PRODUCT, true);
    final DataProduct original = new DataProduct().withId(fixture.original.getId());
    final DataProduct updated = new DataProduct().withId(fixture.updated.getId());
    final EntityReference inherited = reference(1, USER).withInherited(true);
    final EntityReference local = reference(2, USER).withName("input");
    updated.setExperts(List.of(inherited, local));
    fixture.updates.updateExperts(fixture, original, updated);
    assertEquals(List.of(local), updated.getExperts());
    assertEquals("reference2", local.getName());
    assertEquals(1, fixture.referenceReads);
    assertEquals(DATA_PRODUCT, fixture.store.rows.getFirst().getFromEntity());
    assertEquals(USER, fixture.store.rows.getFirst().getToEntity());
    assertEquals(FIELD_EXPERTS, fixture.changes.getFieldsAdded().getFirst().getName());
    updated.getExperts().clear();
    assertTrue(updated.getExperts().isEmpty());
  }

  @Test
  void reviewersUseIncomingActualTypesAndReturnOnlyLocalValues() {
    final Fixture fixture = new Fixture();
    final EntityReference local = reference(2, TEAM);
    fixture.updated.setReviewers(List.of(reference(1, USER).withInherited(true), local));
    fixture.updates.updateReviewers(fixture, fixture.original, fixture.updated);
    assertEquals(List.of(local), fixture.updated.getReviewers());
    assertEquals(TEAM, fixture.store.rows.getFirst().getFromEntity());
    assertEquals(METRIC, fixture.store.rows.getFirst().getToEntity());
    assertEquals(Relationship.REVIEWS.ordinal(), fixture.store.rows.getFirst().getRelation());
    assertEquals(FIELD_REVIEWERS, fixture.changes.getFieldsAdded().getFirst().getName());
  }

  @Test
  void invalidReviewersFailBeforePersistenceAndDoNotReplaceTheInputProjection() {
    final Fixture fixture = new Fixture();
    final List<EntityReference> input = List.of(reference(1, USER), reference(2, TEAM));
    fixture.updated.setReviewers(input);
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.updates.updateReviewers(fixture, fixture.original, fixture.updated));
    assertSame(input, fixture.updated.getReviewers());
    assertEquals(0, fixture.store.writes);
  }

  @Test
  void approvingOrRejectingReviewRequiresAnExistingReviewerBeforeRecording() {
    final Fixture fixture = new Fixture();
    fixture
        .original
        .withEntityStatus(EntityStatus.IN_REVIEW)
        .withReviewers(List.of(reference(1, USER)));
    fixture.updated.withEntityStatus(EntityStatus.APPROVED).withUpdatedBy("other");
    assertThrows(
        AuthorizationException.class,
        () -> fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false));
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    fixture.updated.withEntityStatus(EntityStatus.REJECTED).withUpdatedBy("reference1");
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false);
    assertEquals(
        EntityStatus.REJECTED, fixture.changes.getFieldsUpdated().getFirst().getNewValue());
  }

  @Test
  void consolidationOtherTransitionsAndEqualStatusBypassReviewerAuthorization() {
    final Fixture fixture = new Fixture();
    fixture
        .original
        .withEntityStatus(EntityStatus.IN_REVIEW)
        .withReviewers(List.of(reference(1, USER)));
    fixture.updated.withEntityStatus(EntityStatus.IN_REVIEW).withUpdatedBy("other");
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false);
    assertFalse(EntityChangeRecorder.hasChanges(fixture.changes));
    fixture.updated.setEntityStatus(EntityStatus.APPROVED);
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, true);
    fixture.updated.setEntityStatus(EntityStatus.DRAFT);
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false);
    fixture.original.setEntityStatus(EntityStatus.DRAFT);
    fixture.updated.setEntityStatus(EntityStatus.APPROVED);
    fixture.updates.updateStatus(fixture, fixture.original, fixture.updated, false);
    assertEquals(3, fixture.changes.getFieldsUpdated().size());
  }

  private static EntityReference reference(final int id, final String type) {
    return new EntityReference()
        .withId(new UUID(0, id))
        .withType(type)
        .withName("reference" + id)
        .withFullyQualifiedName("reference" + id);
  }

  private static final class Fixture implements EntityGovernanceUpdates.Session {
    private final Metric original = new Metric().withId(new UUID(0, 100));
    private final Metric updated = new Metric().withId(new UUID(0, 100));
    private final RelationshipStoreFixture store = new RelationshipStoreFixture();
    private final ChangeDescription changes = new ChangeDescription();
    private final List<String> lineage = new ArrayList<>();
    private final EntityGovernanceUpdates updates;
    private boolean put = true;
    private boolean bot;
    private boolean selected = true;
    private boolean rejectReferences;
    private int referenceReads;

    private Fixture() {
      this(true);
    }

    private Fixture(final boolean supported) {
      this(METRIC, supported);
    }

    private Fixture(final String type, final boolean supported) {
      final EntityReferenceValidator validator =
          new EntityReferenceValidator(
              new EntityReferenceValidator.References(
                  (referenceType, id, include) -> {
                    referenceReads++;
                    if (rejectReferences) {
                      throw new IllegalArgumentException("missing reference");
                    }
                    return reference((int) id.getLeastSignificantBits(), referenceType);
                  },
                  (referenceType, name, include) -> {
                    throw new AssertionError(name);
                  },
                  id -> {
                    throw new AssertionError(id);
                  }));
      updates =
          new EntityGovernanceUpdates(
              new EntityGovernanceUpdates.Capabilities(
                  type, supported, supported, supported, supported),
              new EntityGovernanceUpdates.Validation(
                  values -> validator.dataProducts(values, true),
                  validator::users,
                  validator::reviewers),
              new EntityRelationshipUpdates(() -> store.dao, store.writer()),
              new EntityGovernanceUpdates.Lineage(
                  (id, entityType, refs) -> lineage.add(describe("remove", refs)),
                  (id, entityType, refs) -> lineage.add(describe("add", refs))),
              new EntityReviewerPolicy(name -> List.of())::check);
    }

    private String describe(final String operation, final List<EntityReference> references) {
      return operation
          + ":"
          + String.join(
              ",",
              references.stream()
                  .map(reference -> Long.toString(reference.getId().getLeastSignificantBits()))
                  .toList());
    }

    @Override
    public boolean isPut() {
      return put;
    }

    @Override
    public boolean updatedByBot() {
      return bot;
    }

    @Override
    public <K> boolean recordChange(final String field, final K original, final K updated) {
      return recordChange(field, original, updated, false, Objects::equals);
    }

    @Override
    public <K> boolean recordChange(
        final String field,
        final K original,
        final K updated,
        final boolean json,
        final BiPredicate<K, K> match) {
      final boolean differs = selected && EntityChangeRecorder.differs(original, updated, match);
      if (differs) {
        EntityChangeRecorder.recordValue(changes, field, original, updated, json);
      }
      return differs;
    }

    @Override
    public boolean recordReferenceChange(
        final String field, final EntityReference original, final EntityReference updated) {
      return recordChange(field, original, updated, true, entityReferenceMatch);
    }

    @Override
    public boolean recordReferenceChanges(
        final String field, final ListChange<EntityReference> values) {
      return selected && EntityChangeRecorder.recordList(changes, field, values);
    }
  }
}
