package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATABASE_SCHEMA;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.USER;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.entity.metadata.InheritedReferences;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.util.EntityUtil.Fields;

class EntityInheritanceReaderTest {
  @Test
  void localMetadataUsesOneRelationshipQueryAndKeepsReferenceFiltering() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = fixture.reference(USER, false);
    final EntityReference domain = fixture.reference(DOMAIN, false);
    fixture.row(owner, Relationship.OWNS);
    fixture.row(fixture.reference(USER, true), Relationship.OWNS);
    fixture.row(domain, Relationship.HAS);
    fixture.row(fixture.reference(USER, false), Relationship.HAS);
    fixture.required = false;
    final Table result = fixture.reader.read(fixture.table.getId(), fixture.fields(), NON_DELETED);
    assertEquals(List.of(owner), result.getOwners());
    assertEquals(List.of(domain), result.getDomains());
    assertEquals(1, fixture.sqlReads);
    assertEquals(
        Set.of(
            Relationship.OWNS.ordinal(),
            Relationship.HAS.ordinal(),
            Relationship.CONTAINS.ordinal()),
        Set.copyOf(fixture.relations));
    assertNull(fixture.parentRead);
    assertEquals(0, fixture.fallbackReads);
  }

  @Test
  void aProjectedParentIsReusedWithoutASeparateReferenceRead() {
    final Fixture fixture = new Fixture();
    fixture.row(
        fixture.parent.getEntityReference().withType(DATABASE_SCHEMA), Relationship.CONTAINS);
    final Table result = fixture.reader.read(fixture.table.getId(), fixture.fields(), NON_DELETED);
    assertEquals(
        fixture.parent.getOwners().getFirst().getId(), result.getOwners().getFirst().getId());
    assertTrue(result.getOwners().getFirst().getInherited());
    assertTrue(result.getDomains().getFirst().getInherited());
    assertEquals(
        new ParentRead(DATABASE_SCHEMA, fixture.parent.getId(), "owners,domains", ALL),
        fixture.parentRead);
    assertEquals(0, fixture.fallbackReads);
    assertEquals(1, fixture.sqlReads);
  }

  @Test
  void missingParentRowsCompleteInheritanceWithoutRepeatingTheLookup() {
    final Fixture fixture = new Fixture();
    fixture.fallback = fixture.parent.getEntityReference().withType(DATABASE_SCHEMA);
    final Table result = fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals(List.of(), result.getOwners());
    assertEquals(List.of(), result.getDomains());
    assertNull(fixture.parentRead);
    assertEquals(0, fixture.fallbackReads);
    assertEquals(1, fixture.sqlReads);
  }

  @Test
  void firstParentSelectionRetainsMalformedFirstRowFallback() {
    final Fixture fixture = new Fixture();
    fixture.rows.add(
        EntityRelationshipObject.builder()
            .relation(Relationship.CONTAINS.ordinal())
            .fromEntity("")
            .fromId("")
            .build());
    fixture.row(
        fixture.parent.getEntityReference().withType(DATABASE_SCHEMA), Relationship.CONTAINS);
    fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals(1, fixture.fallbackReads);
    assertNull(fixture.parentRead);
    fixture.fallback = fixture.parent.getEntityReference().withType(DATABASE_SCHEMA);
    final Table inherited = fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertTrue(inherited.getOwners().getFirst().getInherited());
    assertTrue(inherited.getDomains().getFirst().getInherited());
    assertEquals(2, fixture.fallbackReads);
    fixture.rows.removeFirst();
    fixture.row(fixture.reference(DATABASE_SCHEMA, false), Relationship.CONTAINS);
    fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals(fixture.parent.getId(), fixture.parentRead.id());
  }

  @Test
  void emptyFieldsStillTraverseForEntitySpecificInheritance() {
    final Fixture fixture = new Fixture();
    fixture.row(
        fixture.parent.getEntityReference().withType(DATABASE_SCHEMA), Relationship.CONTAINS);
    fixture.inheritable = "owners,domains,retentionPeriod";
    fixture.reader.read(fixture.table.getId(), Fields.EMPTY_FIELDS, NON_DELETED);
    assertEquals(fixture.inheritable, fixture.parentRead.fields());
    assertEquals(List.of(Relationship.CONTAINS.ordinal()), fixture.relations);
    assertEquals(1, fixture.sqlReads);
  }

  @Test
  void unsupportedLocalFieldsDoNotAddRelationshipPredicates() {
    final Fixture fixture = new Fixture(false);
    fixture.required = false;
    fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals(List.of(Relationship.CONTAINS.ordinal()), fixture.relations);
    assertEquals(List.of(), fixture.table.getOwners());
    assertEquals(List.of(), fixture.table.getDomains());
  }

  @Test
  void fieldProjectionKeepsWhitespaceNormalizationAndFallbackToDeclaredFields() {
    final Fixture fixture = new Fixture();
    fixture.row(
        fixture.parent.getEntityReference().withType(DATABASE_SCHEMA), Relationship.CONTAINS);
    fixture.inheritable = " owners, ,domains,retentionPeriod ";
    fixture.reader.read(fixture.table.getId(), new Fields(Set.of(FIELD_OWNERS)), ALL);
    assertEquals("owners", fixture.parentRead.fields());
    fixture.reader.read(fixture.table.getId(), new Fields(Set.of("description")), ALL);
    assertEquals(fixture.inheritable, fixture.parentRead.fields());
    fixture.inheritable = " ";
    fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals("", fixture.parentRead.fields());
    fixture.inheritable = null;
    fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL);
    assertEquals("", fixture.parentRead.fields());
  }

  @Test
  void invalidParentIdsAndMissingParentEntitiesKeepTheirFailures() {
    final Fixture fixture = new Fixture();
    fixture.rows.add(
        EntityRelationshipObject.builder()
            .relation(Relationship.CONTAINS.ordinal())
            .fromEntity(DATABASE_SCHEMA)
            .fromId("invalid")
            .build());
    assertThrows(
        IllegalArgumentException.class,
        () -> fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL));
    fixture.rows.clear();
    fixture.row(
        fixture.parent.getEntityReference().withType(DATABASE_SCHEMA), Relationship.CONTAINS);
    fixture.rejectParent = true;
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.reader.read(fixture.table.getId(), fixture.fields(), ALL));
  }

  @Test
  void nullFieldsStillFailAfterTheCanonicalAndRelationshipReads() {
    final Fixture fixture = new Fixture();
    assertThrows(
        NullPointerException.class, () -> fixture.reader.read(fixture.table.getId(), null, ALL));
    assertEquals(1, fixture.sqlReads);
    assertEquals(List.of(Relationship.CONTAINS.ordinal()), fixture.relations);
  }

  private record ParentRead(String type, UUID id, String fields, Include include) {}

  private static final class Fixture {
    private final Table table = new Table().withId(UUID.randomUUID());
    private final DatabaseSchema parent =
        new DatabaseSchema()
            .withId(UUID.randomUUID())
            .withOwners(List.of(new EntityReference().withId(UUID.randomUUID()).withType(USER)))
            .withDomains(List.of(new EntityReference().withId(UUID.randomUUID()).withType(DOMAIN)));
    private final List<EntityRelationshipObject> rows = new ArrayList<>();
    private final Map<UUID, EntityReference> references = new HashMap<>();
    private final EntityInheritanceReader<Table> reader;
    private boolean required = true;
    private boolean rejectParent;
    private String inheritable = "owners,domains";
    private List<Integer> relations;
    private ParentRead parentRead;
    private EntityReference fallback;
    private int sqlReads;
    private int fallbackReads;

    private Fixture() {
      this(true);
    }

    private Fixture(final boolean supported) {
      final EntityRelationshipDAO dao =
          mock(
              EntityRelationshipDAO.class,
              call -> {
                assertEquals("findToRelationshipsForEntity", call.getMethod().getName());
                assertEquals(table.getId(), call.getArgument(0));
                assertEquals(TABLE, call.getArgument(1));
                assertEquals(ALL, call.getArgument(3));
                relations = call.getArgument(2);
                sqlReads++;
                return rows;
              });
      reader =
          new EntityInheritanceReader<>(
              new EntityInheritanceReader.Capabilities(TABLE, supported, supported),
              () -> dao,
              new EntityInheritanceReader.Lookup<>(
                  (id, include) -> {
                    assertEquals(table.getId(), id);
                    return table;
                  },
                  (rows, include) -> {
                    assertEquals(NON_DELETED, include);
                    return rows.stream()
                        .map(row -> references.get(row.getId()))
                        .filter(reference -> !Boolean.TRUE.equals(reference.getDeleted()))
                        .toList();
                  },
                  id -> {
                    fallbackReads++;
                    return fallback;
                  },
                  (type, id, fields, include) -> {
                    if (rejectParent) {
                      throw new EntityNotFoundException("Missing parent");
                    }
                    parentRead = new ParentRead(type, id, fields, include);
                    return parent;
                  }),
              new EntityInheritanceReader.Policy<>(
                  (entity, fields) -> required,
                  () -> inheritable,
                  (entity, fields, parent) -> {
                    InheritedReferences.apply(
                        InheritedReferences.Field.OWNERS, entity, fields, parent);
                    InheritedReferences.apply(
                        InheritedReferences.Field.DOMAINS, entity, fields, parent);
                  }));
    }

    private Fields fields() {
      return new Fields(Set.of(FIELD_OWNERS, FIELD_DOMAINS));
    }

    private EntityReference reference(final String type, final boolean deleted) {
      final EntityReference reference =
          new EntityReference().withId(UUID.randomUUID()).withType(type).withDeleted(deleted);
      references.put(reference.getId(), reference);
      return reference;
    }

    private void row(final EntityReference reference, final Relationship relation) {
      rows.add(
          EntityRelationshipObject.builder()
              .fromId(reference.getId().toString())
              .fromEntity(reference.getType())
              .toId(table.getId().toString())
              .toEntity(TABLE)
              .relation(relation.ordinal())
              .build());
    }
  }
}
