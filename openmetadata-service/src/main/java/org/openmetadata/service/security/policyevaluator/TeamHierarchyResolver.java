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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;

/**
 * Reads the part of the team graph authorization depends on -- ancestry, default roles, directly
 * attached policies and domains -- with a fixed number of queries per level of the hierarchy.
 *
 * <p>Loading a {@code Team} entity per node is the wrong tool for this walk. Asking for {@code
 * defaultRoles} makes {@code TeamRepository.setFields} compute {@code inheritedRoles}, which walks
 * that team's ancestors with the same field set, each of which computes {@code inheritedRoles}
 * again: the walk re-enters itself once per level, and every entity load issues its own queries for
 * {@code defaultRoles}, {@code defaultPersona}, {@code parents}, {@code policies} and {@code
 * domains}. Multiplied by the number of teams a user belongs to, that is the fan-out reported in
 * issue #19778, where a member of 100 groups waits minutes for pages an ordinary user gets in under
 * a second.
 *
 * <p>This resolver reads {@code entity_relationship} directly and visits each team exactly once, so
 * the query count follows the depth of the hierarchy rather than the number of teams in it.
 */
@Slf4j
public final class TeamHierarchyResolver {

  /** The team facts authorization needs. Anything else is a field the walk must not pay for. */
  public record TeamNode(
      UUID id,
      String name,
      List<EntityReference> parents,
      List<EntityReference> defaultRoles,
      List<EntityReference> policies) {}

  /**
   * A team with no {@code PARENT_OF} row is a child of the organization, matching {@code
   * TeamRepository.getParents}. Resolved lazily because the organization is created during
   * bootstrap, after the first repositories exist.
   */
  private static volatile EntityReference organization;

  private TeamHierarchyResolver() {}

  /**
   * Every team reachable from {@code teams} by walking parents, keyed by id and including the
   * starting teams themselves.
   */
  public static Map<UUID, TeamNode> closure(final Collection<EntityReference> teams) {
    final Map<UUID, TeamNode> resolved = new LinkedHashMap<>();
    Set<UUID> frontier = idsOf(teams);
    while (!frontier.isEmpty()) {
      final Map<UUID, TeamNode> level = loadNodes(frontier);
      resolved.putAll(level);
      frontier = unresolvedParents(level, resolved);
    }
    return resolved;
  }

  /**
   * Default roles of {@code teams} and of every team above them, nearest first and de-duplicated.
   * The order matches the depth-first walk this replaced, so {@code inheritedRoles} is unchanged.
   */
  public static List<EntityReference> rolesForTeams(final Collection<EntityReference> teams) {
    return rolesForTeams(teams, closure(teams));
  }

  /**
   * Same, against a hierarchy already resolved by {@link #closure}. Callers holding several
   * subjects -- a page of users, say -- resolve the union of their teams once and then split the
   * roles out per subject, instead of paying for one walk each.
   */
  public static List<EntityReference> rolesForTeams(
      final Collection<EntityReference> teams, final Map<UUID, TeamNode> nodes) {
    final List<EntityReference> roles = new ArrayList<>();
    final Set<UUID> visited = new HashSet<>();
    final Deque<EntityReference> stack = new ArrayDeque<>();
    pushInReverse(stack, teams);
    while (!stack.isEmpty()) {
      final TeamNode node = nodes.get(stack.pop().getId());
      if (node != null && visited.add(node.id())) {
        roles.addAll(node.defaultRoles());
        pushInReverse(stack, node.parents());
      }
    }
    return roles.stream().distinct().toList();
  }

  /** True if {@code team} is {@code parentTeam} or sits anywhere under it. */
  public static boolean isInTeam(final String parentTeam, final EntityReference team) {
    return teamNamesInHierarchy(Collections.singletonList(team)).contains(parentTeam);
  }

  /** Names of {@code teams} and of every team above them. */
  public static Set<String> teamNamesInHierarchy(final Collection<EntityReference> teams) {
    final Set<String> names = new HashSet<>();
    closure(teams).values().forEach(node -> names.add(node.name()));
    return names;
  }

  /**
   * Domains attached to {@code teams} or to any team above them, which is what a member of those
   * teams inherits. One query for the whole hierarchy instead of one team read per team per level.
   */
  public static List<EntityReference> domainsForTeams(final Collection<EntityReference> teams) {
    final Set<UUID> teamIds = closure(teams).keySet();
    if (teamIds.isEmpty()) {
      return List.of();
    }
    final Map<UUID, List<UUID>> domainIds =
        groupByTo(
            relationshipDAO()
                .findFromBatch(asStrings(teamIds), Relationship.HAS.ordinal(), Entity.DOMAIN));
    return List.copyOf(resolveRefs(Entity.DOMAIN, flatten(domainIds)).values());
  }

  /** Drops the memoized organization reference; the entity registry is reset between test runs. */
  public static void invalidate() {
    organization = null;
  }

  /** Reads the parents, default roles and policies of every team in {@code ids}. */
  private static Map<UUID, TeamNode> loadNodes(final Set<UUID> ids) {
    final List<String> idStrings = asStrings(ids);
    final CollectionDAO.EntityRelationshipDAO dao = relationshipDAO();
    final Map<UUID, List<UUID>> parentIds =
        groupByTo(dao.findFromBatch(idStrings, Relationship.PARENT_OF.ordinal(), Entity.TEAM));
    final Map<UUID, List<UUID>> roleIds =
        groupByFrom(
            dao.findToBatch(idStrings, Relationship.HAS.ordinal(), Entity.TEAM, Entity.ROLE));
    final Map<UUID, List<UUID>> policyIds =
        groupByFrom(
            dao.findToBatch(idStrings, Relationship.HAS.ordinal(), Entity.TEAM, Entity.POLICY));
    return buildNodes(ids, parentIds, roleIds, policyIds);
  }

  private static Map<UUID, TeamNode> buildNodes(
      final Set<UUID> ids,
      final Map<UUID, List<UUID>> parentIds,
      final Map<UUID, List<UUID>> roleIds,
      final Map<UUID, List<UUID>> policyIds) {
    final Set<UUID> teamIds = new LinkedHashSet<>(ids);
    parentIds.values().forEach(teamIds::addAll);
    final Map<UUID, EntityReference> teamRefs = resolveRefs(Entity.TEAM, teamIds);
    final Map<UUID, EntityReference> roleRefs = resolveRefs(Entity.ROLE, flatten(roleIds));
    final Map<UUID, EntityReference> policyRefs = resolveRefs(Entity.POLICY, flatten(policyIds));

    final Map<UUID, TeamNode> nodes = new LinkedHashMap<>();
    for (final UUID id : ids) {
      final EntityReference self = teamRefs.get(id);
      // A membership row can outlive its team; end that branch rather than failing the whole walk.
      if (self != null) {
        nodes.put(
            id,
            new TeamNode(
                id,
                self.getName(),
                parentsOf(self, parentIds.get(id), teamRefs),
                refsFor(roleIds.get(id), roleRefs),
                refsFor(policyIds.get(id), policyRefs)));
      }
    }
    return nodes;
  }

  private static List<EntityReference> parentsOf(
      final EntityReference self,
      final List<UUID> parentIds,
      final Map<UUID, EntityReference> teamRefs) {
    final List<EntityReference> parents = refsFor(parentIds, teamRefs);
    if (!parents.isEmpty()) {
      return parents;
    }
    final EntityReference org = organization();
    return org == null || org.getId().equals(self.getId()) ? List.of() : List.of(org);
  }

  private static Set<UUID> unresolvedParents(
      final Map<UUID, TeamNode> level, final Map<UUID, TeamNode> resolved) {
    final Set<UUID> next = new LinkedHashSet<>();
    for (final TeamNode node : level.values()) {
      for (final EntityReference parent : node.parents()) {
        if (!resolved.containsKey(parent.getId())) {
          next.add(parent.getId());
        }
      }
    }
    return next;
  }

  /**
   * Resolves references in one batched lookup per type and drops the deleted ones, mirroring the
   * {@code NON_DELETED} filtering the per-entity reads did. Ids that no longer exist are simply
   * absent from the result.
   */
  private static Map<UUID, EntityReference> resolveRefs(
      final String entityType, final Collection<UUID> ids) {
    if (ids.isEmpty()) {
      return Map.of();
    }
    final Map<UUID, EntityReference> refs = new HashMap<>();
    for (final EntityReference ref :
        Entity.getEntityReferencesByIds(entityType, List.copyOf(ids), Include.ALL)) {
      if (!Boolean.TRUE.equals(ref.getDeleted())) {
        refs.put(ref.getId(), ref);
      }
    }
    return refs;
  }

  private static EntityReference organization() {
    if (organization == null) {
      try {
        organization =
            Entity.getEntityReferenceByName(Entity.TEAM, Entity.ORGANIZATION_NAME, Include.ALL);
      } catch (EntityNotFoundException e) {
        LOG.debug("Organization team is not available yet", e);
      }
    }
    return organization;
  }

  private static CollectionDAO.EntityRelationshipDAO relationshipDAO() {
    return Entity.getCollectionDAO().relationshipDAO();
  }

  private static Map<UUID, List<UUID>> groupByTo(
      final List<CollectionDAO.EntityRelationshipObject> records) {
    final Map<UUID, List<UUID>> grouped = new HashMap<>();
    for (final CollectionDAO.EntityRelationshipObject record : records) {
      grouped
          .computeIfAbsent(UUID.fromString(record.getToId()), k -> new ArrayList<>())
          .add(UUID.fromString(record.getFromId()));
    }
    return grouped;
  }

  private static Map<UUID, List<UUID>> groupByFrom(
      final List<CollectionDAO.EntityRelationshipObject> records) {
    final Map<UUID, List<UUID>> grouped = new HashMap<>();
    for (final CollectionDAO.EntityRelationshipObject record : records) {
      grouped
          .computeIfAbsent(UUID.fromString(record.getFromId()), k -> new ArrayList<>())
          .add(UUID.fromString(record.getToId()));
    }
    return grouped;
  }

  private static Set<UUID> idsOf(final Collection<EntityReference> refs) {
    final Set<UUID> ids = new LinkedHashSet<>();
    for (final EntityReference ref : nullSafe(refs)) {
      if (ref != null && ref.getId() != null) {
        ids.add(ref.getId());
      }
    }
    return ids;
  }

  private static Set<UUID> flatten(final Map<UUID, List<UUID>> grouped) {
    final Set<UUID> ids = new LinkedHashSet<>();
    grouped.values().forEach(ids::addAll);
    return ids;
  }

  private static List<String> asStrings(final Collection<UUID> ids) {
    return ids.stream().map(UUID::toString).toList();
  }

  private static List<EntityReference> refsFor(
      final List<UUID> ids, final Map<UUID, EntityReference> refsById) {
    final List<EntityReference> refs = new ArrayList<>();
    for (final UUID id : ids == null ? List.<UUID>of() : ids) {
      final EntityReference ref = refsById.get(id);
      if (ref != null) {
        refs.add(ref);
      }
    }
    return refs;
  }

  private static Collection<EntityReference> nullSafe(final Collection<EntityReference> refs) {
    return refs == null ? List.of() : refs;
  }

  private static void pushInReverse(
      final Deque<EntityReference> stack, final Collection<EntityReference> teams) {
    final List<EntityReference> ordered = new ArrayList<>(nullSafe(teams));
    for (int i = ordered.size() - 1; i >= 0; i--) {
      final EntityReference team = ordered.get(i);
      if (team != null && team.getId() != null) {
        stack.push(team);
      }
    }
  }
}
