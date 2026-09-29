/*
 *  Copyright 2024 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.context;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;

import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.SecurityContext;
import java.security.Principal;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.schema.entity.context.MemoryShareConfig;
import org.openmetadata.schema.entity.context.MemorySharedPrincipal;
import org.openmetadata.schema.entity.context.MemoryVisibility;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.security.DefaultAuthorizer;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * Tests user-isolation semantics enforced by {@link ContextMemoryVisibility}. These rules back
 * every GET/LIST endpoint on {@code /v1/contextCenter/memories}, so breaking them means a non-admin
 * user could read another user's PRIVATE memory via the public API.
 */
class ContextMemoryVisibilityTest {

  private static final String ALICE = "alice";
  private static final String BOB = "bob";

  private MockedStatic<Entity> entityStaticMock;

  @BeforeEach
  void setUp() {
    entityStaticMock = Mockito.mockStatic(Entity.class);
    entityStaticMock
        .when(
            () ->
                Entity.getEntityByName(
                    eq(Entity.USER), any(String.class), eq("teams,domains"), any()))
        .thenAnswer(inv -> new User().withName(inv.getArgument(1)));
  }

  @AfterEach
  void tearDown() {
    entityStaticMock.close();
  }

  @Test
  void testPrivateMemory_ownerCanSeeIt() {
    ContextMemory privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);

    assertTrue(ContextMemoryVisibility.isVisibleToUser(privateOwnedByAlice, ALICE, false));
    assertDoesNotThrow(
        () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, ALICE, false));
  }

  @Test
  void testPrivateMemory_nonOwnerCannotSeeIt() {
    ContextMemory privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);

    assertFalse(
        ContextMemoryVisibility.isVisibleToUser(privateOwnedByAlice, BOB, false),
        "bob must not see alice's PRIVATE memory");
    assertThrows(
        ForbiddenException.class,
        () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, BOB, false),
        "enforceVisibility must throw Forbidden when a non-owner requests a PRIVATE memory");
  }

  @Test
  void testPrivateMemory_nonOwnerCannotSeeItEvenWithoutShareConfig() {
    ContextMemory privateOwnedByAlice = memoryOwnedBy(ALICE, null);

    assertFalse(ContextMemoryVisibility.isVisibleToUser(privateOwnedByAlice, BOB, false));
    assertThrows(
        ForbiddenException.class,
        () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, BOB, false));
  }

  @Test
  void testPrivateMemory_adminSeesEverything() {
    ContextMemory privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);

    assertTrue(ContextMemoryVisibility.isVisibleToUser(privateOwnedByAlice, BOB, true));
    assertDoesNotThrow(
        () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, BOB, true));
  }

  @Test
  void testEntityMemory_visibleToEveryone() {
    ContextMemory shared = memoryOwnedBy(ALICE, MemoryVisibility.ENTITY);

    assertTrue(ContextMemoryVisibility.isVisibleToUser(shared, ALICE, false));
    assertTrue(ContextMemoryVisibility.isVisibleToUser(shared, BOB, false));
    assertTrue(ContextMemoryVisibility.isVisibleToUser(shared, "charlie", false));
  }

  @Test
  void testSharedMemory_visibleOnlyToListedPrincipals() {
    ContextMemory shared =
        memoryOwnedBy(ALICE, MemoryVisibility.SHARED)
            .withShareConfig(
                new MemoryShareConfig()
                    .withVisibility(MemoryVisibility.SHARED)
                    .withSharedWith(
                        List.of(new MemorySharedPrincipal().withPrincipal(principalRef(BOB)))));

    assertTrue(
        ContextMemoryVisibility.isVisibleToUser(shared, ALICE, false),
        "owner always sees their memory");
    assertTrue(
        ContextMemoryVisibility.isVisibleToUser(shared, BOB, false),
        "bob is in the sharedWith list");
    assertFalse(
        ContextMemoryVisibility.isVisibleToUser(shared, "charlie", false),
        "charlie is not in the sharedWith list and must not see the memory");
  }

  @Test
  void testFilterByVisibility_stripsOtherUsersPrivateMemories() {
    ContextMemory alicePrivate = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    ContextMemory bobPrivate = memoryOwnedBy(BOB, MemoryVisibility.PRIVATE);
    ContextMemory entityVisible = memoryOwnedBy(BOB, MemoryVisibility.ENTITY);

    List<ContextMemory> visibleToAlice =
        ContextMemoryVisibility.filterByVisibility(
            List.of(alicePrivate, bobPrivate, entityVisible), ALICE, false);

    assertEquals(
        2,
        visibleToAlice.size(),
        "alice must see her own PRIVATE plus the ENTITY-visible memory — never bob's PRIVATE");
    assertTrue(visibleToAlice.contains(alicePrivate));
    assertFalse(
        visibleToAlice.contains(bobPrivate),
        "bob's PRIVATE memory must be filtered out of alice's list");
    assertTrue(visibleToAlice.contains(entityVisible));
  }

  @Test
  void testFilterByVisibility_adminGetsEverything() {
    ContextMemory alicePrivate = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    ContextMemory bobPrivate = memoryOwnedBy(BOB, MemoryVisibility.PRIVATE);

    List<ContextMemory> visibleToAdmin =
        ContextMemoryVisibility.filterByVisibility(
            List.of(alicePrivate, bobPrivate), "admin", true);

    assertEquals(2, visibleToAdmin.size());
  }

  @Test
  void testIsOwnedBy_matchesByNameOrFqn() {
    EntityReference owner =
        new EntityReference()
            .withId(UUID.randomUUID())
            .withType("user")
            .withName(ALICE)
            .withFullyQualifiedName(ALICE);
    ContextMemory memory = new ContextMemory().withOwners(List.of(owner));

    assertTrue(ContextMemoryVisibility.isOwnedBy(memory, ALICE));
    assertFalse(ContextMemoryVisibility.isOwnedBy(memory, BOB));
  }

  @Test
  void testIsOwnedBy_returnsFalseWhenUserNameIsNull() {
    EntityReference owner =
        new EntityReference().withId(UUID.randomUUID()).withType("user").withName(ALICE);
    ContextMemory memory = new ContextMemory().withOwners(List.of(owner));

    assertFalse(ContextMemoryVisibility.isOwnedBy(memory, null));
  }

  @Test
  void testIsOwnedBy_returnsFalseWhenNoOwners() {
    ContextMemory memory = new ContextMemory().withOwners(List.of());

    assertFalse(ContextMemoryVisibility.isOwnedBy(memory, ALICE));
  }

  /**
   * The type-blind overload the entity read paths call: a read tool holds an {@link
   * EntityInterface} and does not know which types carry visibility rules, so it must be able to
   * ask without naming contextMemory.
   */
  @Test
  void testEnforceVisibility_onEntityInterface_deniesAnotherUsersPrivateMemory() {
    EntityInterface privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    SecurityContext bob = securityContextFor(BOB);

    withSubject(
        bob,
        BOB,
        () ->
            assertThrows(
                ForbiddenException.class,
                () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, bob)));
  }

  @Test
  void testEnforceVisibility_onEntityInterface_allowsTheOwnersOwnPrivateMemory() {
    EntityInterface privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    SecurityContext alice = securityContextFor(ALICE);

    withSubject(
        alice,
        ALICE,
        () ->
            assertDoesNotThrow(
                () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, alice)));
  }

  @Test
  void testEnforceVisibility_onEntityInterface_ignoresTypesWithoutVisibilityRules() {
    EntityInterface table = new Table().withName("orders").withFullyQualifiedName("s.d.orders");

    assertDoesNotThrow(
        () -> ContextMemoryVisibility.enforceVisibility(table, securityContextFor(BOB)));
  }

  @Test
  void testEnforceVisibility_onEntityInterface_letsAnAdminReadEveryMemory() {
    EntityInterface privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
    SecurityContext admin = securityContextFor(BOB);

    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(admin))
          .thenReturn(new SubjectContext(new User().withName(BOB).withIsAdmin(true), null, null));

      assertDoesNotThrow(
          () -> ContextMemoryVisibility.enforceVisibility(privateOwnedByAlice, admin));
    }
  }

  @Test
  void testHasVisibilityRules_onlyForContextMemory() {
    assertTrue(ContextMemoryVisibility.hasVisibilityRules(Entity.CONTEXT_MEMORY));
    assertFalse(ContextMemoryVisibility.hasVisibilityRules(Entity.TABLE));
    assertFalse(ContextMemoryVisibility.hasVisibilityRules(null));
  }

  /**
   * Owners is a relationship field, null unless the fetch asked for it. A read path that fetches a
   * memory without owners hands the guard an ownerless memory and denies the owner their own
   * private memory - so the guard states the fields its own decision reads.
   */
  @Test
  void testGuardFields_addsOwnersForMemoriesOnly() {
    assertEquals(
        Entity.FIELD_OWNERS, ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, ""));
    assertEquals(
        Entity.FIELD_OWNERS, ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, null));
    assertEquals("tags,owners", ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "tags"));
    assertEquals(
        "sourceFile,owners",
        ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "sourceFile,owners"));
    assertEquals("*", ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "*"));
    assertEquals("", ContextMemoryVisibility.guardFields(Entity.TABLE, ""));
  }

  private SecurityContext securityContextFor(String userName) {
    Principal principal = Mockito.mock(Principal.class);
    Mockito.when(principal.getName()).thenReturn(userName);
    SecurityContext securityContext = Mockito.mock(SecurityContext.class);
    Mockito.when(securityContext.getUserPrincipal()).thenReturn(principal);
    return securityContext;
  }

  private void withSubject(SecurityContext securityContext, String userName, Runnable assertions) {
    try (MockedStatic<DefaultAuthorizer> authorizer = Mockito.mockStatic(DefaultAuthorizer.class)) {
      authorizer
          .when(() -> DefaultAuthorizer.getSubjectContext(securityContext))
          .thenReturn(new SubjectContext(new User().withName(userName), null, null));
      assertions.run();
    }
  }

  private ContextMemory memoryOwnedBy(String userName, MemoryVisibility visibility) {
    ContextMemory memory =
        new ContextMemory()
            .withId(UUID.randomUUID())
            .withName("mem-" + userName + "-" + UUID.randomUUID().toString().substring(0, 8))
            .withOwners(List.of(principalRef(userName)));
    if (visibility != null) {
      memory.withShareConfig(new MemoryShareConfig().withVisibility(visibility));
    }
    return memory;
  }

  private EntityReference principalRef(String userName) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("user")
        .withName(userName)
        .withFullyQualifiedName(userName);
  }
}
