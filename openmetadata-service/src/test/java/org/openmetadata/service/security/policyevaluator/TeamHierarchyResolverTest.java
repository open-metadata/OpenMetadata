/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.security.policyevaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import org.apache.commons.lang3.tuple.ImmutablePair;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.PolicyRepository;
import org.openmetadata.service.jdbi3.RoleRepository;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.security.policyevaluator.TeamHierarchyResolver.TeamNode;

/**
 * Issue #19778: a user in many teams made every authorization read walk the team hierarchy one
 * {@code Team} entity at a time, so the cost grew with the number of teams the user belonged to.
 * The resolver reads the graph a level at a time, which is what {@link
 * #closureCostFollowsHierarchyDepthNotTeamCount()} pins down.
 */
class TeamHierarchyResolverTest {

  private static final String ORGANIZATION = Entity.ORGANIZATION_NAME;

  private TeamRepository teamRepository;

  @BeforeEach
  void setUp() {
    teamRepository = mock(TeamRepository.class);
    final RoleRepository roleRepository = mock(RoleRepository.class);
    final PolicyRepository policyRepository = mock(PolicyRepository.class);
    Entity.registerEntity(Team.class, Entity.TEAM, teamRepository);
    Entity.registerEntity(Role.class, Entity.ROLE, roleRepository);
    Entity.registerEntity(Policy.class, Entity.POLICY, policyRepository);
    TeamGraphFixture.install();
    TeamGraphFixture.stubReferences(teamRepository, Entity.TEAM);
    TeamGraphFixture.stubReferences(roleRepository, Entity.ROLE);
    TeamGraphFixture.stubReferences(policyRepository, Entity.POLICY);
  }

  @AfterAll
  static void tearDown() {
    TeamHierarchyResolver.invalidateAll();
    Entity.cleanup();
  }

  @Test
  void closureCollectsEveryTeamAboveTheStartingTeams() {
    final Team root = team("root");
    final Team middle = team("middle", root);
    final Team leftLeaf = team("leftLeaf", middle);
    final Team rightLeaf = team("rightLeaf", middle);
    final Team unrelated = team("unrelated");

    final List<UUID> reached =
        List.copyOf(TeamHierarchyResolver.closure(refs(leftLeaf, rightLeaf)).keySet());

    assertEquals(4, reached.size(), "Both leaves plus the two teams above them");
    assertTrue(reached.containsAll(List.of(leftLeaf.getId(), rightLeaf.getId())));
    assertTrue(reached.containsAll(List.of(middle.getId(), root.getId())));
    assertFalse(reached.contains(unrelated.getId()));
  }

  /**
   * The regression this class exists for. Widening a level must cost the same number of reads as a
   * narrow one: the resolver batches per level, so only the depth of the hierarchy shows up in the
   * query count.
   */
  @Test
  void closureCostFollowsHierarchyDepthNotTeamCount() {
    final Team root = team("wideRoot");
    final Team department = team("wideDepartment", root);
    final List<EntityReference> twoGroups = groupsUnder(department, "small", 2);
    final List<EntityReference> fortyGroups = groupsUnder(department, "large", 40);

    final int narrow = coldClosureReads(twoGroups);
    final int wide = coldClosureReads(fortyGroups);

    assertEquals(
        narrow, wide, "Twenty times the teams must not mean twenty times the relationship reads");
  }

  /**
   * The team graph is read on the authorization path of every request, and twice per entity read --
   * inherited roles and inherited domains walk the same ancestry. Resolving it again each time is
   * the other half of #19778.
   */
  @Test
  void resolvedNodesAreReusedUntilInvalidated() {
    final Team root = team("cachedRoot");
    final Team leaf = team("cachedLeaf", root);
    TeamHierarchyResolver.closure(refs(leaf));

    TeamGraphFixture.resetQueryCount();
    TeamHierarchyResolver.closure(refs(leaf));
    TeamHierarchyResolver.rolesForTeams(refs(leaf));
    assertEquals(0, TeamGraphFixture.queryCount(), "A resolved node must not be read again");

    TeamHierarchyResolver.invalidateAll();
    TeamHierarchyResolver.closure(refs(leaf));
    assertTrue(TeamGraphFixture.queryCount() > 0, "Invalidation must send the walk back to the DB");
  }

  /**
   * An invalidation that lands while a read is in flight must not be undone by that read putting
   * its pre-write view back — the stale hierarchy would then serve authorization for the full TTL.
   */
  @Test
  void aReadRacingAnInvalidationDoesNotRepopulateTheCache() {
    final Team leaf = team("racedLeaf", team("racedRoot"));
    TeamGraphFixture.duringNextRead(TeamHierarchyResolver::invalidateAll);

    TeamHierarchyResolver.closure(refs(leaf));

    TeamGraphFixture.resetQueryCount();
    TeamHierarchyResolver.closure(refs(leaf));
    assertTrue(
        TeamGraphFixture.queryCount() > 0,
        "A read overtaken by an invalidation must not leave its view memoized");
  }

  /** Nothing may edit a node in place: every reader of the cache shares the same instance. */
  @Test
  void cachedNodeCollectionsAreImmutable() {
    final Team leaf = team("frozenRoot", List.of(), List.of(role("frozenRole")));
    final TeamNode node = TeamHierarchyResolver.closure(refs(leaf)).get(leaf.getId());

    assertThrows(
        UnsupportedOperationException.class, () -> node.defaultRoles().add(role("intruder")));
    assertThrows(UnsupportedOperationException.class, () -> node.parents().clear());
  }

  /**
   * Callers hang these references on the entity they are building and the serialization path then
   * stamps an href onto each one, so a cached node must never hand out the instance it keeps.
   */
  @Test
  void cachedNodesAreNotSharedWithCallers() {
    final Team leaf = team("detachRoot", List.of(), List.of(role("detachRole")));
    TeamHierarchyResolver.rolesForTeams(refs(leaf)).forEach(ref -> ref.withName("mutated"));

    final List<String> roles =
        TeamHierarchyResolver.rolesForTeams(refs(leaf)).stream()
            .map(EntityReference::getName)
            .toList();

    assertEquals(List.of("detachRole"), roles);
  }

  private static int coldClosureReads(final List<EntityReference> teams) {
    TeamHierarchyResolver.invalidateAll();
    TeamGraphFixture.resetQueryCount();
    TeamHierarchyResolver.closure(teams);
    return TeamGraphFixture.queryCount();
  }

  @Test
  void rolesForTeamsWalksUpwardsNearestFirstAndDeDuplicates() {
    final EntityReference sharedRole = role("shared");
    final Team root = team("roleRoot", List.of(), List.of(sharedRole));
    final Team parent =
        team("roleParent", List.of(root.getEntityReference()), List.of(role("mid")));
    final Team leaf =
        team("roleLeaf", List.of(parent.getEntityReference()), List.of(role("leaf"), sharedRole));

    final List<String> roles =
        TeamHierarchyResolver.rolesForTeams(refs(leaf)).stream()
            .map(EntityReference::getName)
            .toList();

    assertEquals(List.of("leaf", "shared", "mid"), roles);
  }

  @Test
  void aCycleInTheHierarchyTerminates() {
    final Team first = team("cycleFirst");
    final Team second = team("cycleSecond", first);
    TeamGraphFixture.register(second.withParents(List.of(first.getEntityReference())));
    TeamGraphFixture.register(first.withParents(List.of(second.getEntityReference())));

    assertEquals(2, TeamHierarchyResolver.closure(refs(first)).size());
    assertTrue(TeamHierarchyResolver.isInTeam("cycleSecond", first.getEntityReference()));
  }

  @Test
  void isInTeamMatchesTheTeamItselfAndItsAncestors() {
    final Team parent = team("ancestor");
    final Team child = team("descendant", parent);

    assertTrue(TeamHierarchyResolver.isInTeam("descendant", child.getEntityReference()));
    assertTrue(TeamHierarchyResolver.isInTeam("ancestor", child.getEntityReference()));
    assertFalse(TeamHierarchyResolver.isInTeam("descendant", parent.getEntityReference()));
  }

  /** A team with no PARENT_OF row belongs to the organization, as {@code getParents} decides. */
  @Test
  void parentlessTeamsInheritFromTheOrganization() {
    final Team organization = team(ORGANIZATION, List.of(), List.of(role("orgRole")));
    when(teamRepository.getReferenceByName(anyString(), any(Include.class)))
        .thenReturn(organization.getEntityReference());
    TeamHierarchyResolver.invalidateAll();
    final Team topLevel = team("topLevel", List.of(), List.of(role("topRole")));

    final List<String> roles =
        TeamHierarchyResolver.rolesForTeams(refs(topLevel)).stream()
            .map(EntityReference::getName)
            .toList();

    assertEquals(List.of("topRole", "orgRole"), roles);
  }

  private Team team(final String name, final Team... parents) {
    final List<EntityReference> parentRefs = new ArrayList<>();
    for (final Team parent : parents) {
      parentRefs.add(parent.getEntityReference());
    }
    return team(name, parentRefs, List.of());
  }

  private Team team(
      final String name,
      final List<EntityReference> parents,
      final List<EntityReference> defaultRoles) {
    final Team team =
        new Team()
            .withId(UUID.randomUUID())
            .withName(name)
            .withFullyQualifiedName(name)
            .withParents(parents)
            .withDefaultRoles(defaultRoles);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.TEAM, team.getId()), JsonUtils.pojoToJson(team));
    TeamGraphFixture.register(team);
    return team;
  }

  private EntityReference role(final String name) {
    final Role role = new Role().withId(UUID.randomUUID()).withName(name);
    EntityRepository.CACHE_WITH_ID.put(
        new ImmutablePair<>(Entity.ROLE, role.getId()), JsonUtils.pojoToJson(role));
    return role.getEntityReference();
  }

  private List<EntityReference> groupsUnder(
      final Team parent, final String prefix, final int count) {
    final List<EntityReference> groups = new ArrayList<>();
    for (int i = 0; i < count; i++) {
      groups.add(team(prefix + i, parent).getEntityReference());
    }
    return groups;
  }

  private static List<EntityReference> refs(final Team... teams) {
    final List<EntityReference> refs = new ArrayList<>();
    for (final Team team : teams) {
      refs.add(team.getEntityReference());
    }
    return refs;
  }
}
