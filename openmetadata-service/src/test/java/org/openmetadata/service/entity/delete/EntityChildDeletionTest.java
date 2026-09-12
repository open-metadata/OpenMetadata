package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

class EntityChildDeletionTest {
  private static final String ACTOR = "editor";
  private final UUID parent = UUID.randomUUID();
  private final UUID shared = UUID.randomUUID();
  private final UUID owned = UUID.randomUUID();
  private final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
  private final List<UUID> storedChildren = new ArrayList<>(List.of(shared, owned));
  private List<EntityRelationshipRecord> children = List.of(child(shared), child(owned));
  private int reads;
  private int preparations;
  private int deletions;
  private boolean failPreparation;
  private boolean observedHardDelete;

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void aNonRecursiveDeleteRejectsChildrenBeforePreparingOrDeleting(boolean hardDelete) {
    final var service = service();
    final var error =
        assertThrows(
            IllegalArgumentException.class,
            () ->
                service.delete(
                    parent, new EntityDeletionService.Request(ACTOR, false, hardDelete)));
    assertEquals(CatalogExceptionMessage.entityIsNotEmpty(DASHBOARD), error.getMessage());
    assertEquals(List.of(shared, owned), storedChildren);
    assertEquals(1, reads);
    assertEquals(0, preparations);
    assertEquals(0, deletions);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void anEmptyParentDoesNotPrepareOrDispatchEvenWithoutRecursiveDelete(boolean hardDelete) {
    children = List.of();
    service().delete(parent, new EntityDeletionService.Request(ACTOR, false, hardDelete));
    assertEquals(1, reads);
    assertEquals(0, preparations);
    assertEquals(0, deletions);
    assertEquals(List.of(shared, owned), storedChildren);
  }

  @Test
  void recursiveSoftDeletePassesTheOriginalChildrenToTheEntityPolicy() {
    service().delete(parent, new EntityDeletionService.Request(ACTOR, true, false));
    assertTrue(storedChildren.isEmpty());
    assertEquals(1, reads);
    assertEquals(0, preparations);
    assertEquals(1, deletions);
    assertEquals(false, observedHardDelete);
  }

  @Test
  void recursiveHardDeletePreservesSharedChildrenRemovedByPreparation() {
    service().delete(parent, new EntityDeletionService.Request(ACTOR, true, true));
    assertEquals(List.of(shared), storedChildren);
    assertEquals(1, reads);
    assertEquals(1, preparations);
    assertEquals(1, deletions);
    assertTrue(observedHardDelete);
  }

  @Test
  void preparationCanPreserveEveryChildWithoutDispatchingAnEmptyDelete() {
    children = List.of(child(shared));
    service().delete(parent, new EntityDeletionService.Request(ACTOR, true, true));
    assertEquals(List.of(shared, owned), storedChildren);
    assertEquals(1, reads);
    assertEquals(1, preparations);
    assertEquals(0, deletions);
  }

  @Test
  void failedPreparationDoesNotDeleteAnyChildren() {
    failPreparation = true;
    assertThrows(
        IllegalStateException.class,
        () -> service().delete(parent, new EntityDeletionService.Request(ACTOR, true, true)));
    assertEquals(List.of(shared, owned), storedChildren);
    assertEquals(1, reads);
    assertEquals(1, preparations);
    assertEquals(0, deletions);
  }

  private EntityChildDeletion service() {
    when(dao.findTo(
            parent,
            DASHBOARD,
            List.of(Relationship.CONTAINS.ordinal(), Relationship.PARENT_OF.ordinal())))
        .thenAnswer(
            invocation -> {
              reads++;
              return children;
            });
    return new EntityChildDeletion(
        DASHBOARD, () -> dao, new EntityChildDeletion.Hooks(this::prepare, this::delete));
  }

  private List<EntityRelationshipRecord> prepare(
      UUID id, List<EntityRelationshipRecord> records, String actor) {
    assertEquals(parent, id);
    assertEquals(ACTOR, actor);
    assertEquals(children, records);
    preparations++;
    if (failPreparation) throw new IllegalStateException("preparation failed");
    return records.stream().filter(record -> !shared.equals(record.getId())).toList();
  }

  private void delete(List<EntityRelationshipRecord> records, boolean hardDelete, String actor) {
    assertEquals(ACTOR, actor);
    deletions++;
    observedHardDelete = hardDelete;
    records.forEach(record -> storedChildren.remove(record.getId()));
  }

  private EntityRelationshipRecord child(UUID id) {
    return EntityRelationshipRecord.builder().type(CHART).id(id).build();
  }
}
