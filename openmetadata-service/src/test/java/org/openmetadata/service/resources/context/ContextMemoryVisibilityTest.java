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
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.IntStream;
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
  private static final EntityReference ANCHOR =
      new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE).withName("orders");

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
  void testPublicMemory_visibleToEveryoneWithoutAsset() {
    ContextMemory publicMemory = memoryOwnedBy(ALICE, MemoryVisibility.PUBLIC);

    assertTrue(ContextMemoryVisibility.isVisibleToUser(publicMemory, BOB, false));
    assertTrue(ContextMemoryVisibility.isVisibleToUser(publicMemory, "charlie", false));
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
  void testAnchoredEntityMemory_visibleOnlyToReadersOfTheAnchor() {
    ContextMemory anchored =
        memoryOwnedBy(ALICE, MemoryVisibility.ENTITY).withPrimaryEntity(ANCHOR);
    ContextMemoryVisibility.AnchorAccess onlyBobReadsIt =
        (userName, anchor) -> BOB.equals(userName) && ANCHOR.getId().equals(anchor.getId());

    assertTrue(ContextMemoryVisibility.isVisibleToUser(anchored, BOB, false, onlyBobReadsIt));
    assertFalse(
        ContextMemoryVisibility.isVisibleToUser(anchored, "charlie", false, onlyBobReadsIt));
  }

  @Test
  void testAnchoredEntityMemory_ownerAndAdminSkipTheAnchorCheck() {
    ContextMemory anchored =
        memoryOwnedBy(ALICE, MemoryVisibility.ENTITY).withPrimaryEntity(ANCHOR);
    ContextMemoryVisibility.AnchorAccess nobodyReadsIt = (userName, anchor) -> false;

    assertTrue(ContextMemoryVisibility.isVisibleToUser(anchored, ALICE, false, nobodyReadsIt));
    assertTrue(ContextMemoryVisibility.isVisibleToUser(anchored, BOB, true, nobodyReadsIt));
  }

  @Test
  void testUnanchoredEntityMemory_neverConsultsTheAnchorCheck() {
    ContextMemory orgWide = memoryOwnedBy(ALICE, MemoryVisibility.ENTITY);
    ContextMemoryVisibility.AnchorAccess mustNotBeCalled =
        (userName, anchor) -> {
          throw new AssertionError("an unanchored Entity memory is org-wide");
        };

    assertTrue(ContextMemoryVisibility.isVisibleToUser(orgWide, "charlie", false, mustNotBeCalled));
  }

  @Test
  void testAnchorAccess_neverOpensAPrivateMemory() {
    ContextMemory privateAnchored =
        memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE).withPrimaryEntity(ANCHOR);
    ContextMemoryVisibility.AnchorAccess everyoneReadsIt = (userName, anchor) -> true;

    assertFalse(
        ContextMemoryVisibility.isVisibleToUser(privateAnchored, BOB, false, everyoneReadsIt));
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
  void testFilterByVisibility_checksEachAnchorOncePerPage() {
    ContextMemory first = memoryOwnedBy(ALICE, MemoryVisibility.ENTITY).withPrimaryEntity(ANCHOR);
    ContextMemory second = memoryOwnedBy(ALICE, MemoryVisibility.ENTITY).withPrimaryEntity(ANCHOR);
    AtomicInteger checks = new AtomicInteger();
    ContextMemoryVisibility.AnchorAccess denied =
        (userName, anchor) -> {
          checks.incrementAndGet();
          return false;
        };

    List<ContextMemory> visible =
        ContextMemoryVisibility.filterByVisibility(List.of(first, second), BOB, false, denied);

    assertTrue(visible.isEmpty());
    assertEquals(1, checks.get());
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
    EntityInterface<?> privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
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
    EntityInterface<?> privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
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
    EntityInterface<?> table = new Table().withName("orders").withFullyQualifiedName("s.d.orders");

    assertDoesNotThrow(
        () -> ContextMemoryVisibility.enforceVisibility(table, securityContextFor(BOB)));
  }

  @Test
  void testEnforceVisibility_onEntityInterface_letsAnAdminReadEveryMemory() {
    EntityInterface<?> privateOwnedByAlice = memoryOwnedBy(ALICE, MemoryVisibility.PRIVATE);
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

  /** The guard fetches the relationship fields used for the visibility decision. */
  @Test
  void testGuardFields_addsTheDecisionFieldsForMemoriesOnly() {
    assertEquals(
        "owners,primaryEntity", ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, ""));
    assertEquals(
        "owners,primaryEntity", ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, null));
    assertEquals(
        "tags,owners,primaryEntity",
        ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "tags"));
    assertEquals(
        "sourceFile,owners,primaryEntity",
        ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "sourceFile,owners"));
    assertEquals(
        "primaryEntity,owners",
        ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "primaryEntity"));
    assertEquals("*", ContextMemoryVisibility.guardFields(Entity.CONTEXT_MEMORY, "*"));
    assertEquals("", ContextMemoryVisibility.guardFields(Entity.TABLE, ""));
  }

  @Test
  void readableAnchorIds_keepsTheAnchorsTheCallerMayRead() {
    EntityReference hidden =
        new EntityReference().withId(UUID.randomUUID()).withType(Entity.TABLE).withName("salaries");

    Set<String> readable =
        ContextMemoryVisibility.readableAnchorIds(
            BOB,
            List.of(ANCHOR.getId().toString(), hidden.getId().toString()),
            candidates -> List.of(ANCHOR, hidden),
            (userName, anchor) -> BOB.equals(userName) && ANCHOR.equals(anchor));

    assertEquals(Set.of(ANCHOR.getId().toString()), readable);
  }

  @Test
  void readableAnchorIds_anIdThatAnchorsNoMemoryIsNeverReadable() {
    Set<String> readable =
        ContextMemoryVisibility.readableAnchorIds(
            BOB, List.of(ANCHOR.getId().toString()), candidates -> List.of(), (u, a) -> true);

    assertTrue(readable.isEmpty());
  }

  @Test
  void readableAnchorIds_anAnonymousCallerReadsNoAnchorAndLooksNothingUp() {
    Set<String> readable =
        ContextMemoryVisibility.readableAnchorIds(
            null,
            List.of(ANCHOR.getId().toString()),
            candidates -> {
              throw new AssertionError("an anonymous caller must not reach the database");
            },
            (u, a) -> true);

    assertTrue(readable.isEmpty());
  }

  @Test
  void readableAnchorIds_looksUpAtMostTheCapOfAnchors() {
    List<String> pinned =
        IntStream.range(0, 3 * ContextMemoryVisibility.MAX_PINNED_ANCHORS)
            .mapToObj(i -> UUID.randomUUID().toString())
            .toList();
    AtomicInteger lookedUp = new AtomicInteger();

    ContextMemoryVisibility.readableAnchorIds(
        BOB,
        pinned,
        candidates -> {
          lookedUp.set(candidates.size());
          return List.of();
        },
        (u, a) -> true);

    assertEquals(ContextMemoryVisibility.MAX_PINNED_ANCHORS, lookedUp.get());
  }

  @Test
  void pinnedAnchors_dropsWhatIsNotAnEntityIdAndRepeats() {
    String id = ANCHOR.getId().toString();

    List<UUID> candidates =
        ContextMemoryVisibility.pinnedAnchors(
            Arrays.asList("not-a-uuid", "", null, " " + id.toUpperCase(Locale.ROOT) + " ", id));

    assertEquals(List.of(ANCHOR.getId()), candidates);
    assertTrue(ContextMemoryVisibility.pinnedAnchors(null).isEmpty());
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
