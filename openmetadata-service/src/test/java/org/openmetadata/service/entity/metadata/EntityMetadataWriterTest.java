package org.openmetadata.service.entity.metadata;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.USER;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.schema.entity.data.Metric;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.EntityMetadataWriter.Field;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;

class EntityMetadataWriterTest {
  @Test
  void capabilitiesAreAnImmutableSnapshotOfSupportedFields() {
    final Set<String> fields =
        new HashSet<>(Set.of("owners", "domains", "reviewers", "dataProducts", "description"));
    final var schema = EntityMetadataWriter.Schema.fromFields(TABLE, fields);
    fields.clear();
    assertEquals(EnumSet.allOf(Field.class), schema.supported());
    assertThrows(UnsupportedOperationException.class, () -> schema.supported().clear());
    assertTrue(EntityMetadataWriter.Schema.fromFields(TABLE, fields).supported().isEmpty());
  }

  @ParameterizedTest
  @EnumSource(Field.class)
  void singleMetadataRowsRetainTheirDirectionAndType(final Field field) {
    final Fixture fixture = new Fixture(true);
    final EntityReference reference = fixture.reference(USER);
    fixture.writer.store(field, fixture.entity, List.of(reference));
    final EntityRelationshipObject row = fixture.rows.getFirst();
    assertEquals(reference.getId().toString(), row.getFromId());
    assertEquals(fixture.entity.getId().toString(), row.getToId());
    assertEquals(TABLE, row.getToEntity());
    assertEquals(
        field == Field.DOMAINS ? DOMAIN : field == Field.DATA_PRODUCTS ? DATA_PRODUCT : USER,
        row.getFromEntity());
    assertEquals(
        field == Field.OWNERS
            ? Relationship.OWNS.ordinal()
            : field == Field.REVIEWERS
                ? Relationship.REVIEWS.ordinal()
                : Relationship.HAS.ordinal(),
        row.getRelation());
    assertEquals(field == Field.DOMAINS ? 1 : 0, fixture.validations.size());
  }

  @ParameterizedTest
  @EnumSource(Field.class)
  void batchMetadataPersistsOnceForAllEntities(final Field field) {
    final Fixture fixture = new Fixture(true);
    final Metric second = new Metric().withId(UUID.randomUUID());
    final EntityReference first = fixture.reference(USER);
    final EntityReference last = fixture.reference(USER);
    fixture.assign(field, fixture.entity, List.of(first));
    fixture.assign(field, second, List.of(last));
    fixture.writer.storeMany(field, List.of(fixture.entity, second));
    assertEquals(2, fixture.rows.size());
    assertEquals(1, fixture.inserts);
    assertEquals(
        field == Field.DOMAINS ? List.of("lineage", "lineage", "insert") : List.of("insert"),
        fixture.events);
    assertEquals(field == Field.DOMAINS ? 2 : 0, fixture.validations.size());
  }

  @ParameterizedTest
  @EnumSource(Field.class)
  void unsupportedAndEmptyMetadataPreserveTheirShortCircuits(final Field field) {
    final Fixture disabled = new Fixture(false);
    disabled.writer.store(field, null, List.of(disabled.reference(USER)));
    disabled.writer.storeMany(field, null);
    assertTrue(disabled.rows.isEmpty());
    final Fixture fixture = new Fixture(true);
    fixture.writer.store(field, null, null);
    fixture.writer.store(field, null, List.of());
    fixture.writer.storeMany(field, List.of());
    fixture.writer.storeMany(field, List.of(fixture.entity));
    assertEquals(0, fixture.inserts);
    assertTrue(fixture.validations.isEmpty());
  }

  @Test
  void singleDomainLineageFollowsItsRowWriteAndUsesTheOriginalDomainIdentity() {
    final Fixture fixture = new Fixture(true);
    final EntityReference domain = fixture.reference(DOMAIN);
    fixture.writer.store(Field.DOMAINS, fixture.entity, List.of(domain));
    assertEquals(List.of("insert", "lineage"), fixture.events);
    assertEquals(List.of(domain.getId()), fixture.lineageIds);
    assertSame(domain, fixture.validations.getFirst().getFirst());
  }

  @Test
  void batchValidationFailurePreventsAnyRowInsert() {
    final Fixture fixture = new Fixture(true);
    fixture.entity.setDomains(List.of(fixture.reference(DOMAIN)));
    final Metric second =
        new Metric().withId(UUID.randomUUID()).withDomains(List.of(fixture.reference(DOMAIN)));
    fixture.failValidationAt = 2;
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.writer.storeMany(Field.DOMAINS, List.of(fixture.entity, second)));
    assertTrue(fixture.rows.isEmpty());
    assertEquals(List.of("lineage"), fixture.events);
  }

  @Test
  void declaredMetadataRetainsInheritedFlagsAndDuplicateOccurrences() {
    final Fixture fixture = new Fixture(true);
    final EntityReference owner = fixture.reference(USER).withInherited(true);
    fixture.writer.store(Field.OWNERS, fixture.entity, List.of(owner, owner));
    assertEquals(2, fixture.rows.size());
  }

  private static final class Fixture {
    private final Metric entity = new Metric().withId(UUID.randomUUID());
    private final List<EntityRelationshipObject> rows = new ArrayList<>();
    private final List<List<EntityReference>> validations = new ArrayList<>();
    private final List<String> events = new ArrayList<>();
    private final List<UUID> lineageIds = new ArrayList<>();
    private final EntityMetadataWriter writer;
    private int inserts;
    private int failValidationAt;

    private Fixture(final boolean supported) {
      final EntityRelationshipDAO dao =
          mock(
              EntityRelationshipDAO.class,
              call -> {
                switch (call.getMethod().getName()) {
                  case "bulkInsertTo" -> rows.addAll(call.getArgument(0));
                  case "insert" -> rows.add(
                      EntityRelationshipObject.builder()
                          .fromId(call.getArgument(0).toString())
                          .toId(call.getArgument(1).toString())
                          .fromEntity(call.getArgument(2))
                          .toEntity(call.getArgument(3))
                          .relation(call.getArgument(4))
                          .build());
                  default -> throw new AssertionError(call.getMethod().getName());
                }
                inserts++;
                events.add("insert");
                return null;
              });
      final EntityRelationshipWriter relationships =
          new EntityRelationshipWriter(
              () -> dao,
              new EntityRelationshipWriter.Effects(ignored -> {}, ignored -> {}, (type, id) -> {}));
      writer =
          new EntityMetadataWriter(
              new EntityMetadataWriter.Schema(
                  TABLE, supported ? EnumSet.allOf(Field.class) : Set.of()),
              relationships,
              domains -> {
                validations.add(domains);
                if (validations.size() == failValidationAt) {
                  throw new IllegalArgumentException("Invalid domain");
                }
              },
              (id, domain) -> {
                lineageIds.add(id);
                events.add("lineage");
              });
    }

    private EntityReference reference(final String type) {
      return new EntityReference().withType(type).withId(UUID.randomUUID());
    }

    private void assign(
        final Field field, final Metric target, final List<EntityReference> references) {
      switch (field) {
        case OWNERS -> target.setOwners(references);
        case DOMAINS -> target.setDomains(references);
        case REVIEWERS -> target.setReviewers(references);
        case DATA_PRODUCTS -> target.setDataProducts(references);
      }
    }
  }
}
