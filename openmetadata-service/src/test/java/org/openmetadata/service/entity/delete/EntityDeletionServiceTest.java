package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.type.EventType.ENTITY_DELETED;
import static org.openmetadata.schema.type.EventType.ENTITY_SOFT_DELETED;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;

class EntityDeletionServiceTest {
  private static final Clock CLOCK = Clock.fixed(Instant.ofEpochMilli(1234), ZoneOffset.UTC);
  private final Table original = new Table().withId(UUID.randomUUID()).withDeleted(false);
  private final Table stored = new Table().withId(original.getId()).withDeleted(false);
  private final List<EntityDeletionService.Request> descendantRequests = new ArrayList<>();
  private boolean locked;
  private boolean purged;
  private boolean relatedRemoved;
  private boolean softRelatedRemoved;
  private boolean failMutation;
  private boolean systemEntity;

  @Test
  void softDeletePreservesAuditResponseAndRelatedChildOrder() {
    final var request = new EntityDeletionService.Request("editor", true, false);
    final var response = service(true).delete(original, request);
    assertEquals(ENTITY_SOFT_DELETED, response.changeType());
    assertEquals(stored, response.entity());
    assertEquals(List.of(request), descendantRequests);
    assertTrue(stored.getDeleted());
    assertEquals("editor", stored.getUpdatedBy());
    assertEquals(1234L, stored.getUpdatedAt());
    assertTrue(softRelatedRemoved);
    assertFalse(purged);
    assertFalse(relatedRemoved);
    assertFalse(locked);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void hardDeleteDiscoversRelatedChildrenBeforePurgingTheirEdges(boolean supportsSoftDelete) {
    final var request = new EntityDeletionService.Request("editor", true, true);
    final var response = service(supportsSoftDelete).delete(original, request);
    assertEquals(ENTITY_DELETED, response.changeType());
    assertEquals(List.of(request), descendantRequests);
    assertTrue(relatedRemoved);
    assertTrue(purged);
    assertFalse(softRelatedRemoved);
    assertFalse(locked);
  }

  @Test
  void unsupportedSoftDeletePreservesDescendantPolicy() {
    final var request = new EntityDeletionService.Request("editor", true, false);
    assertEquals(ENTITY_DELETED, service(false).delete(original, request).changeType());
    assertEquals(List.of(request), descendantRequests);
    assertTrue(purged);
    assertFalse(stored.getDeleted());
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void mutationFailureReleasesTheDeletionScope(boolean hardDelete) {
    failMutation = true;
    final var request = new EntityDeletionService.Request("editor", true, hardDelete);
    assertThrows(IllegalStateException.class, () -> service(true).delete(original, request));
    assertFalse(locked);
    assertFalse(purged);
    assertFalse(softRelatedRemoved);
  }

  @Test
  void systemEntityIsRejectedBeforePreparingOrTraversingChildren() {
    systemEntity = true;
    final var request = new EntityDeletionService.Request("editor", true, true);
    assertThrows(IllegalArgumentException.class, () -> service(true).delete(original, request));
    assertTrue(descendantRequests.isEmpty());
    assertFalse(locked);
    assertFalse(relatedRemoved);
    assertFalse(purged);
  }

  private EntityDeletionService<Table> service(boolean supportsSoftDelete) {
    final var preparation =
        new EntityDeletionService.Preparation<Table>(
            entity -> {
              if (systemEntity) {
                throw new IllegalArgumentException("System entity");
              }
            },
            (entity, actor) -> entity.setDescription(actor),
            entity -> entity.setDisplayName("Hydrated"),
            id -> {
              assertFalse(descendantRequests.isEmpty());
              return stored;
            });
    final var children =
        new EntityDeletionService.Children(
            (id, request) -> descendantRequests.add(request),
            (id, actor) -> {
              assertTrue(stored.getDeleted());
              softRelatedRemoved = true;
            },
            (id, actor) -> {
              assertFalse(purged);
              relatedRemoved = true;
            });
    return new EntityDeletionService<>(
        preparation,
        children,
        new EntityDeletionService.Mutation<>(supportsSoftDelete, this::softDelete, this::purge),
        (entity, request) -> {
          assertEquals("editor", entity.getDescription());
          assertEquals("Hydrated", entity.getDisplayName());
          locked = true;
          return () -> locked = false;
        },
        CLOCK);
  }

  private void softDelete(Table baseline, Table updated) {
    assertEquals(original, baseline);
    assertEquals(stored, updated);
    assertTrue(locked);
    if (failMutation) {
      throw new IllegalStateException("Mutation rolled back");
    }
  }

  private void purge(Table entity) {
    assertEquals(stored, entity);
    assertTrue(locked);
    assertTrue(relatedRemoved);
    if (failMutation) {
      throw new IllegalStateException("Purge rolled back");
    }
    purged = true;
  }
}
