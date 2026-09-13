package org.openmetadata.service.entity.read;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.read.EntityRelationshipReader.Selection;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;

/**
 * Supplies relationship rows and references at the database boundary of consumer tests.
 */
public final class EntityRelationshipFixture {

  private EntityRelationshipFixture() {}

  public static void outgoing(
      final EntityPolicy<?> repository,
      final Selection selection,
      final List<EntityReference> references) {
    final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    when(dao.findTo(
            selection.id(),
            selection.type(),
            selection.relationship().ordinal(),
            selection.relatedType()))
        .thenReturn(
            references.stream()
                .map(
                    reference ->
                        EntityRelationshipRecord.builder()
                            .id(reference.getId())
                            .type(reference.getType())
                            .build())
                .toList());
    when(repository.relationships()).thenReturn(reader(selection.type(), dao, references));
  }

  public static void owners(
      final EntityPolicy<?> repository,
      final EntityReference target,
      final List<EntityReference> references) {
    final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    when(dao.findFrom(target.getId(), target.getType(), Relationship.OWNS.ordinal()))
        .thenReturn(
            references.stream()
                .map(
                    reference ->
                        EntityRelationshipRecord.builder()
                            .id(reference.getId())
                            .type(reference.getType())
                            .build())
                .toList());
    final var fields =
        new EntityRelationshipFields(
            new EntityRelationshipFields.Schema(target.getType(), Set.of(Entity.FIELD_OWNERS)),
            reader(target.getType(), dao, references),
            new ReadBundleAccess(target.getType(), () -> null, (field, reason) -> {}),
            () -> {
              throw new AssertionError("Reference owner reads must not use field caches");
            });
    when(repository.relationshipFields()).thenReturn(fields);
  }

  private static EntityRelationshipReader reader(
      final String entityType,
      final EntityRelationshipDAO dao,
      final List<EntityReference> references) {
    return new EntityRelationshipReader(
        entityType,
        () -> dao,
        new EntityRelationshipReader.References(
            (type, id, include) ->
                references.stream()
                    .filter(reference -> id.equals(reference.getId()))
                    .findFirst()
                    .orElseThrow(),
            (records, include) ->
                records.stream()
                    .map(
                        record ->
                            references.stream()
                                .filter(reference -> record.getId().equals(reference.getId()))
                                .findFirst()
                                .orElseThrow())
                    .filter(
                        reference ->
                            include == Include.ALL
                                || Boolean.TRUE.equals(reference.getDeleted())
                                    == (include == Include.DELETED))
                    .sorted(EntityUtil.compareEntityReference)
                    .toList()),
        () -> {
          throw new AssertionError(
              "Outgoing relationship reads must not access the container cache");
        });
  }
}
