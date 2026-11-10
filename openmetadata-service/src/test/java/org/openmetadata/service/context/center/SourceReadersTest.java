package org.openmetadata.service.context.center;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mockStatic;

import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.ContextFile;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;

/** Who may read a restricted file, as the copy rule compares two files' readers. */
class SourceReadersTest {
  private static final EntityReference FILE =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.CONTEXT_FILE).withName("f");
  private static final EntityReference OWNER = principal(Entity.USER, "owner");
  private static final EntityReference TEAM = principal(Entity.TEAM, "team");
  private static final EntityReference NAMED = principal(Entity.USER, "named");

  /** A team owner reads nothing it owns, and a private file's leftover list names nobody. */
  @Test
  void aPrivateFileIsReadByItsUserOwnersAlone() {
    ContextFile stored = file(MemoryVisibility.PRIVATE, NAMED).withOwners(List.of(OWNER, TEAM));

    assertEquals(Set.of(OWNER.getId()), readersOfStored(stored));
  }

  @Test
  void aSharedFileIsReadByItsUserOwnersAndThePrincipalsItNames() {
    ContextFile stored = file(MemoryVisibility.SHARED, NAMED, TEAM).withOwners(List.of(OWNER));

    assertEquals(Set.of(OWNER.getId(), NAMED.getId(), TEAM.getId()), readersOfStored(stored));
  }

  /** The store still holds the file as org-wide, shared with nobody, while the write runs. */
  @Test
  void theFileAWriteSharesDifferentlyIsReadAsTheWriteLeavesIt() {
    ContextFile leftShared = file(MemoryVisibility.SHARED, NAMED).withId(FILE.getId());

    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stored(entities, file(MemoryVisibility.ENTITY));
      SourceReaders readers = new SourceReaders().withSharingOf(leftShared);

      assertFalse(readers.everyoneMayRead(FILE));
      assertEquals(Set.of(NAMED.getId()), readers.readersOf(FILE));
      assertTrue(
          new SourceReaders().everyoneMayRead(FILE), "a lifecycle without it reads the store");
    }
  }

  private static Set<UUID> readersOfStored(ContextFile stored) {
    try (MockedStatic<Entity> entities = mockStatic(Entity.class, CALLS_REAL_METHODS)) {
      stored(entities, stored);
      return new SourceReaders().readersOf(FILE);
    }
  }

  private static void stored(MockedStatic<Entity> entities, ContextFile stored) {
    entities
        .when(
            () ->
                Entity.getEntity(
                    argThat(
                        (EntityReference ref) -> ref != null && FILE.getId().equals(ref.getId())),
                    argThat((String fields) -> fields != null),
                    eq(Include.NON_DELETED)))
        .thenReturn(stored);
  }

  private static ContextFile file(MemoryVisibility visibility, EntityReference... sharedWith) {
    return new ContextFile()
        .withId(FILE.getId())
        .withName(FILE.getName())
        .withShareConfig(
            new MemoryShareConfig()
                .withVisibility(visibility)
                .withSharedWith(
                    List.of(sharedWith).stream()
                        .map(principal -> new MemorySharedPrincipal().withPrincipal(principal))
                        .toList()));
  }

  private static EntityReference principal(String type, String name) {
    return new EntityReference().withId(UUID.randomUUID()).withType(type).withName(name);
  }
}
