package org.openmetadata.service.entity.delete;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
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
import org.openmetadata.service.exception.EntityNotFoundException;

class EntityDeleteCommandsTest {
  private final Table original = new Table().withId(UUID.randomUUID()).withDeleted(false);
  private final Table stored = new Table().withId(original.getId()).withDeleted(false);
  private final List<String> lookups = new ArrayList<>();
  private final List<Table> published = new ArrayList<>();
  private final List<EntityDeletionService.Request> descendants = new ArrayList<>();
  private boolean missing;
  private boolean failMutation;
  private boolean failPostDelete;
  private boolean mutated;
  private boolean purged;
  private boolean quote;

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void idDeletionReturnsTheCommittedEntityAndPublishesAfterMutation(final boolean hardDelete) {
    final var response = commands().byId("editor", original.getId(), true, hardDelete);
    assertSame(stored, response.entity());
    assertEquals(hardDelete ? ENTITY_DELETED : ENTITY_SOFT_DELETED, response.changeType());
    assertEquals(List.of("id:" + original.getId()), lookups);
    assertEquals(
        List.of(new EntityDeletionService.Request("editor", true, hardDelete)), descendants);
    assertEquals(List.of(stored), published);
    assertEquals(hardDelete, purged);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void nameDeletionRetainsEntityNameNormalization(final boolean quoteName) {
    quote = quoteName;
    commands().byName("editor", "a.b", false, true);
    assertEquals(List.of("name:" + (quoteName ? "\"a.b\"" : "a.b")), lookups);
    assertEquals(List.of(stored), published);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void internalDeletionLeavesPublicationToItsCaller(final boolean byName) {
    quote = true;
    final EntityDeletes<Table> commands = commands();
    final var response =
        byName
            ? commands.internalByName("editor", "raw.name", true, false)
            : commands.internalById("editor", original.getId(), true, false);
    assertSame(stored, response.entity());
    assertEquals(List.of(byName ? "name:raw.name" : "id:" + original.getId()), lookups);
    assertTrue(published.isEmpty());
    assertTrue(mutated);
  }

  @Test
  void optionalMissingNameReturnsTheExistingEmptyDeleteResponse() {
    missing = true;
    quote = true;
    final var response = commands().byNameIfExists("editor", "a.b", true, true);
    assertNull(response.entity());
    assertEquals(ENTITY_DELETED, response.changeType());
    assertEquals(List.of("optional:\"a.b\""), lookups);
    assertTrue(descendants.isEmpty());
    assertTrue(published.isEmpty());
  }

  @Test
  void optionalExistingNameRetainsTheRequiredReloadBeforeDeletion() {
    quote = true;
    commands().byNameIfExists("editor", "a.b", false, true);
    assertEquals(List.of("optional:\"a.b\"", "name:\"a.b\""), lookups);
    assertEquals(List.of(stored), published);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void requiredMissingEntityFailsBeforeMutationOrPublication(final boolean byName) {
    missing = true;
    final var commands = commands();
    assertThrows(
        EntityNotFoundException.class,
        () -> {
          if (byName) {
            commands.byName("editor", "a.b", false, true);
          } else {
            commands.byId("editor", original.getId(), false, true);
          }
        });
    assertFalse(mutated);
    assertTrue(descendants.isEmpty());
    assertTrue(published.isEmpty());
  }

  @Test
  void failedMutationDoesNotPublish() {
    failMutation = true;
    assertThrows(
        IllegalStateException.class,
        () -> commands().byId("editor", original.getId(), false, true));
    assertFalse(mutated);
    assertTrue(published.isEmpty());
  }

  @Test
  void failedPostDeleteRetainsTheExistingPublicationFailureBoundary() {
    failPostDelete = true;
    assertThrows(
        IllegalStateException.class,
        () -> commands().byId("editor", original.getId(), false, true));
    assertTrue(mutated);
    assertTrue(published.isEmpty());
  }

  private EntityDeletes<Table> commands() {
    final var readers =
        new EntityDeleteCommands.Readers<Table>(
            id -> load("id:" + id),
            name -> load("name:" + name),
            name -> {
              lookups.add("optional:" + name);
              return missing ? null : original;
            });
    final var completion =
        new EntityDeleteCommands.Completion<Table>(
            this::complete,
            (entity, hardDelete) -> {
              assertEquals("post-delete complete", entity.getDescription());
              published.add(entity);
            });
    return new EntityDeleteCommands<>(
        readers, name -> quote ? "\"" + name + "\"" : name, deletion(), completion);
  }

  private void complete(final Table entity, final boolean hardDelete) {
    assertTrue(mutated);
    assertSame(stored, entity);
    assertEquals(hardDelete, purged);
    if (failPostDelete) {
      throw new IllegalStateException("post-delete failed");
    }
    entity.setDescription("post-delete complete");
  }

  private Table load(final String key) {
    lookups.add(key);
    if (missing) {
      throw new EntityNotFoundException("missing");
    }
    return original;
  }

  private EntityDeletionService<Table> deletion() {
    final var preparation =
        new EntityDeletionService.Preparation<Table>(
            entity -> {}, (entity, actor) -> {}, entity -> {}, id -> stored);
    final var children =
        new EntityDeletionService.Children(
            (id, request) -> descendants.add(request), (id, actor) -> {}, (id, actor) -> {});
    final var mutation =
        new EntityDeletionService.Mutation<Table>(
            true, (before, after) -> mutate(false), entity -> mutate(true));
    return new EntityDeletionService<>(
        preparation,
        children,
        mutation,
        (entity, request) -> () -> {},
        Clock.fixed(Instant.ofEpochMilli(42), ZoneOffset.UTC));
  }

  private void mutate(final boolean hardDelete) {
    if (failMutation) {
      throw new IllegalStateException("mutation failed");
    }
    mutated = true;
    purged = hardDelete;
  }
}
