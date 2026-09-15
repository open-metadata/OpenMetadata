package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.service.Entity.TABLE;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;

class EntityHardDeletionTest {
  private final Map<UUID, Table> rows = new HashMap<>();
  private final Set<UUID> relationships = new HashSet<>();
  private final Set<UUID> searchDocuments = new HashSet<>();
  private final Set<UUID> additionalChildren = new HashSet<>();
  private final Set<UUID> invalidated = new HashSet<>();
  private final List<Integer> purgedChunks = new ArrayList<>();
  private final List<String> audit = new ArrayList<>();
  private boolean cascadeActive;
  private boolean failPurge;
  private boolean searchCovered;

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void purgesMetadataAndRowsInBoundedChunksBeforePublishing(boolean covered) {
    searchCovered = covered;
    final List<UUID> ids = seed(1001);
    service(500).delete(ids, "editor");
    assertEquals(List.of(500, 500, 1), purgedChunks);
    assertTrue(rows.isEmpty());
    assertTrue(relationships.isEmpty());
    assertTrue(additionalChildren.isEmpty());
    assertEquals(new HashSet<>(ids), invalidated);
    assertEquals(ids.size(), audit.size());
    assertEquals(covered ? new HashSet<>(ids) : Set.of(), searchDocuments);
    assertFalse(cascadeActive);
  }

  @Test
  void failedPurgeReleasesCascadeScopeAndDoesNotPublishDeletion() {
    final List<UUID> ids = seed(2);
    failPurge = true;
    assertThrows(IllegalStateException.class, () -> service(500).delete(ids, "editor"));
    assertFalse(cascadeActive);
    assertEquals(new HashSet<>(ids), rows.keySet());
    assertEquals(new HashSet<>(ids), relationships);
    assertEquals(new HashSet<>(ids), searchDocuments);
    assertTrue(invalidated.isEmpty());
    assertTrue(audit.isEmpty());
    assertTrue(purgedChunks.isEmpty());
  }

  @Test
  void missingOrEmptyIdsDoNotEnterTheCascade() {
    service(500).delete(null, "editor");
    service(500).delete(List.of(), "editor");
    service(500).delete(List.of(UUID.randomUUID()), "editor");
    assertFalse(cascadeActive);
    assertTrue(purgedChunks.isEmpty());
    assertTrue(audit.isEmpty());
  }

  @Test
  void invalidChunkSizeIsRejected() {
    assertThrows(IllegalArgumentException.class, () -> service(0));
    assertThrows(IllegalArgumentException.class, () -> service(-1));
  }

  private EntityHardDeletion<Table> service(int chunkSize) {
    final var preparation =
        new EntityHardDeletion.Preparation<Table>(
            ids -> ids.stream().filter(rows::containsKey).map(rows::get).toList(),
            entities -> {
              assertFalse(cascadeActive);
              cascadeActive = true;
              return () -> cascadeActive = false;
            },
            entities -> entities.forEach(entity -> entity.setDescription("Hydrated")),
            (entity, actor) -> {
              assertEquals("Hydrated", entity.getDescription());
              assertEquals("editor", actor);
            });
    final var cleanup =
        new EntityHardDeletion.Cleanup<Table>(
            (entities, actor) -> assertTrue(cascadeActive),
            (id, actor) -> {
              assertTrue(relationships.contains(id));
              additionalChildren.remove(id);
            },
            this::purge);
    final var completion =
        new EntityHardDeletion.Completion<Table>(
            entities -> entities.forEach(entity -> invalidated.add(entity.getId())),
            entity -> {
              assertFalse(rows.containsKey(entity.getId()));
              assertTrue(invalidated.contains(entity.getId()));
              audit.add(entity.getFullyQualifiedName());
            },
            entity -> searchDocuments.remove(entity.getId()),
            () -> searchCovered);
    final var hierarchy =
        new EntityHierarchy<Table>(
            TABLE,
            () -> mock(EntityRelationshipDAO.class),
            new EntityHierarchy.Registry(
                type -> {
                  throw new AssertionError("Leaf has no children");
                },
                type -> false),
            (parents, children, actor) -> children);
    return new EntityHardDeletion<>(preparation, cleanup, completion, hierarchy, chunkSize);
  }

  private void purge(List<Table> entities) {
    assertTrue(cascadeActive);
    assertTrue(entities.stream().noneMatch(entity -> additionalChildren.contains(entity.getId())));
    if (failPurge) {
      throw new IllegalStateException("Purge rolled back");
    }
    entities.forEach(
        entity -> {
          rows.remove(entity.getId());
          relationships.remove(entity.getId());
        });
    purgedChunks.add(entities.size());
  }

  private List<UUID> seed(int count) {
    final List<UUID> ids = IntStream.range(0, count).mapToObj(index -> UUID.randomUUID()).toList();
    ids.forEach(id -> rows.put(id, new Table().withId(id).withFullyQualifiedName(id.toString())));
    relationships.addAll(ids);
    searchDocuments.addAll(ids);
    additionalChildren.addAll(ids);
    return ids;
  }
}
