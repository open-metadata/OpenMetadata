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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.Invalidatable;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * Cache for user policies to improve authorization performance. Caches the compiled policies for
 * each user including policies from direct roles and team hierarchy.
 */
@Slf4j
public class SubjectCache {
  private static final String USER_FIELDS = "roles,teams,isAdmin,profile,domains";
  private static final String USER_CONTEXT_FIELDS =
      "roles,teams,isAdmin,profile,domains,personas,defaultPersona";

  static class UserPoliciesContext {
    final List<PolicyContext> policies;
    final List<UUID> teamsVisited;
    final TeamHierarchySummary hierarchy;

    UserPoliciesContext(
        List<PolicyContext> policies, List<UUID> teamsVisited, TeamHierarchySummary hierarchy) {
      this.policies = policies;
      this.teamsVisited = teamsVisited;
      this.hierarchy = hierarchy;
    }
  }

  /**
   * The answers {@code inAnyTeam()}, {@code matchTeam()} and {@code hasAnyRole()} need, flattened
   * out of the team hierarchy the policy loader already walked. Those are rule conditions, so they
   * are evaluated once per rule per entity; resolving the hierarchy on each call is what made a
   * listing request for a member of many teams issue thousands of queries (#19778).
   */
  record TeamHierarchySummary(Set<UUID> teamIds, Set<String> teamNames, Set<String> roleNames) {

    static TeamHierarchySummary of(List<EntityReference> teams) {
      return of(teams, TeamHierarchyResolver.closure(teams));
    }

    static TeamHierarchySummary of(
        List<EntityReference> teams, Map<UUID, TeamHierarchyResolver.TeamNode> hierarchy) {
      Set<String> teamNames = new HashSet<>();
      Set<String> roleNames = new HashSet<>();
      for (TeamHierarchyResolver.TeamNode node : hierarchy.values()) {
        teamNames.add(node.name());
        node.defaultRoles().forEach(role -> roleNames.add(role.getName()));
      }
      return new TeamHierarchySummary(teamIdsOf(teams), teamNames, roleNames);
    }

    /**
     * Whether this summary was built for exactly {@code teams}. A {@link SubjectContext} can be
     * constructed around a {@code User} that did not come from this cache, and answering such a
     * caller from the cached hierarchy would silently authorize against the wrong memberships.
     */
    boolean covers(List<EntityReference> teams) {
      return teamIds.equals(teamIdsOf(teams));
    }

    private static Set<UUID> teamIdsOf(List<EntityReference> teams) {
      Set<UUID> ids = new HashSet<>();
      for (EntityReference team : listOrEmpty(teams)) {
        if (team != null && team.getId() != null) {
          ids.add(team.getId());
        }
      }
      return ids;
    }
  }

  private static volatile LoadingCache<String, UserPoliciesContext> USER_POLICIES_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(2, TimeUnit.MINUTES)
          .recordStats()
          .build(new UserPoliciesLoader());

  private static volatile LoadingCache<String, User> USER_CONTEXT_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(15, TimeUnit.MINUTES)
          .recordStats()
          .build(new UserContextLoader());

  private static final Invalidatable INVALIDATOR =
      (type, id, fqn) -> {
        if (Entity.TEAM.equals(type) || Entity.ROLE.equals(type) || Entity.POLICY.equals(type)) {
          invalidateAll();
        } else if (Entity.PERSONA.equals(type)) {
          invalidateAllUserContexts();
        } else if (Entity.USER.equals(type) && fqn != null) {
          invalidateUserByFqn(fqn);
        }
      };

  private SubjectCache() {}

  /**
   * Rebuild auth caches with configured max entries. TTLs are kept at their original values
   * (2 min for policies and the resolved team graph, 15 min for user context) because they serve
   * different freshness needs.
   */
  public static void initCaches(int maxEntries) {
    USER_POLICIES_CACHE =
        CacheBuilder.newBuilder()
            .maximumSize(maxEntries)
            .expireAfterWrite(2, TimeUnit.MINUTES)
            .recordStats()
            .build(new UserPoliciesLoader());
    USER_CONTEXT_CACHE =
        CacheBuilder.newBuilder()
            .maximumSize(maxEntries)
            .expireAfterWrite(15, TimeUnit.MINUTES)
            .recordStats()
            .build(new UserContextLoader());
    TeamHierarchyResolver.initCache(maxEntries);
    LOG.info("Auth caches initialized: maxEntries={}", maxEntries);
  }

  public static List<PolicyContext> getPolicies(String userName) {
    try {
      return USER_POLICIES_CACHE.get(userName).policies;
    } catch (Exception e) {
      LOG.warn("Failed to load policies from cache for user {}", userName, e);
      return loadPoliciesForUser(userName).policies;
    }
  }

  /** Names of every team the user belongs to or sits under, including the teams themselves. */
  public static Set<String> getTeamNamesInHierarchy(String userName, List<EntityReference> teams) {
    return hierarchyFor(userName, teams).teamNames();
  }

  /** Names of the default roles the user inherits from the team hierarchy. */
  public static Set<String> getInheritedRoleNames(String userName, List<EntityReference> teams) {
    return hierarchyFor(userName, teams).roleNames();
  }

  private static TeamHierarchySummary hierarchyFor(String userName, List<EntityReference> teams) {
    try {
      TeamHierarchySummary cached = USER_POLICIES_CACHE.get(userName).hierarchy;
      if (cached.covers(teams)) {
        return cached;
      }
    } catch (Exception e) {
      LOG.warn("Failed to load the team hierarchy from cache for user {}", userName, e);
    }
    return TeamHierarchySummary.of(teams);
  }

  public static List<UUID> getVisitedTeams(String userName) {
    try {
      return new ArrayList<>(USER_POLICIES_CACHE.get(userName).teamsVisited);
    } catch (Exception e) {
      LOG.warn("Failed to load visited teams from cache for user {}", userName, e);
      return new ArrayList<>();
    }
  }

  public static void invalidateUser(String userName) {
    LOG.debug("Invalidating policy cache for user: {}", userName);
    USER_POLICIES_CACHE.invalidate(userName);
    USER_CONTEXT_CACHE.invalidate(userName);
  }

  public static void invalidateUserContext(String userName) {
    LOG.debug("Invalidating user context cache for user: {}", userName);
    USER_CONTEXT_CACHE.invalidate(userName);
  }

  public static void invalidateUserContexts(List<EntityReference> users) {
    Set<String> userNames = new HashSet<>();
    for (EntityReference user : listOrEmpty(users)) {
      if (user == null || nullOrEmpty(user.getName())) {
        invalidateAllUserContexts();
        return;
      }
      userNames.add(user.getName());
    }
    userNames.forEach(SubjectCache::invalidateUserContext);
  }

  public static void invalidateAllUserContexts() {
    LOG.info("Invalidating all user context caches");
    USER_CONTEXT_CACHE.invalidateAll();
  }

  /**
   * The {@link Invalidatable} to register with {@code CacheBundle} so persona assignments converge
   * across pods. The repositories invalidate only the JVM that served the write, so without this a
   * peer keeps a {@code User} carrying the old persona list for up to the 15-minute TTL and
   * {@code SubjectContext.getActivePersona()} discards the requested persona as "not assigned" —
   * which reads to the user as a persona switch that intermittently doesn't take.
   *
   * <p>A persona or team write drops every user context because the affected set isn't derivable
   * from the message: assignments change through the persona, the user's {@code defaultPersona},
   * and a team's default (which reaches users as {@code inheritedPersonas}, via membership or the
   * parent hierarchy) alike. Both are rare admin actions, so the blunt drop is the cheaper trade.
   * A context {@code refresh} is published under {@code TYPE_PERSONA_CONTEXT} and so does not land
   * here.
   *
   * <p>A team, role or policy write drops the policy cache and the resolved team graph as well,
   * not just the user contexts. Those caches carry the answers {@code hasAnyRole()} and
   * {@code inAnyTeam()} give, and both used to be read from the database on every evaluation; if
   * only the writing pod dropped them, a peer would keep granting access through a role that was
   * removed from a team, or through a parent that was reparented away, until the entry expired.
   * The same message also reaches the role names copied into the resolved graph. These are rare
   * administrative writes, so dropping every entry is the cheaper trade against deriving the
   * affected users from the message.
   */
  public static Invalidatable invalidator() {
    return INVALIDATOR;
  }

  /**
   * A user's FQN is the lower-cased quoted name while the cache is keyed by the principal name as
   * the request presented it, so match case-insensitively rather than dropping a key that may not
   * exist in that exact form.
   *
   * <p>Not an exact-key {@code invalidate}: {@code SecurityUtil.getUserName} only splits the
   * principal on {@code [/@]} and does not case-fold, so an IdP emitting {@code John.Doe@corp.com}
   * keys this cache under {@code John.Doe} while the FQN is {@code john.doe}. Keys also arrive
   * from {@code createdBy}/{@code updatedBy} strings. An O(1) lookup would silently miss those and
   * leave exactly the stale persona this fix is about. The scan is bounded by the cache's maximum
   * size and only runs on user writes, which are logins and profile edits — per-request activity
   * tracking updates the row through a raw {@code JSON_SET} that publishes nothing.
   */
  private static void invalidateUserByFqn(String fqn) {
    try {
      String userName = FullyQualifiedName.unquoteName(fqn);
      USER_CONTEXT_CACHE.asMap().keySet().removeIf(key -> key.equalsIgnoreCase(userName));
      // The policy entry holds this user's roles and their resolved team hierarchy, so a
      // membership or role change on a peer has to drop it too.
      USER_POLICIES_CACHE.asMap().keySet().removeIf(key -> key.equalsIgnoreCase(userName));
    } catch (Exception e) {
      LOG.debug("Could not invalidate caches for user fqn {}", fqn, e);
    }
  }

  public static void invalidateAll() {
    LOG.info("Invalidating all user policy caches");
    USER_POLICIES_CACHE.invalidateAll();
    USER_CONTEXT_CACHE.invalidateAll();
    // The policy caches are derived from the team graph, so they have to be dropped together.
    TeamHierarchyResolver.invalidateAll();
  }

  public static User getUserContext(String userName) {
    try {
      return USER_CONTEXT_CACHE.get(userName);
    } catch (Exception e) {
      LOG.warn("Failed to load user context from cache for user {}", userName, e);
      return Entity.getEntityByName(Entity.USER, userName, USER_CONTEXT_FIELDS, NON_DELETED);
    }
  }

  public static String getCacheStats() {
    return String.format(
        "PolicyCache: %s, UserContextCache: %s, %s",
        USER_POLICIES_CACHE.stats(),
        USER_CONTEXT_CACHE.stats(),
        TeamHierarchyResolver.getCacheStats());
  }

  static class UserPoliciesLoader extends CacheLoader<String, UserPoliciesContext> {
    @Override
    public @NonNull UserPoliciesContext load(@CheckForNull String userName) {
      return loadPoliciesForUser(userName);
    }
  }

  static class UserContextLoader extends CacheLoader<String, User> {
    @Override
    public @NonNull User load(@CheckForNull String userName) {
      LOG.debug("Loading user context from database for user: {}", userName);
      return Entity.getEntityByName(Entity.USER, userName, USER_CONTEXT_FIELDS, NON_DELETED);
    }
  }

  private static UserPoliciesContext loadPoliciesForUser(String userName) {
    LOG.debug("Loading policies for user: {}", userName);
    User user = Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, NON_DELETED);
    List<EntityReference> teams = listOrEmpty(user.getTeams());
    Map<UUID, TeamHierarchyResolver.TeamNode> hierarchy = TeamHierarchyResolver.closure(teams);
    List<PolicyContext> policies = new ArrayList<>();
    List<UUID> teamsVisited = new ArrayList<>();

    // 1. User's direct roles
    for (EntityReference roleRef : listOrEmpty(user.getRoles())) {
      policies.addAll(loadRolePolicies(Entity.USER, user.getName(), roleRef));
    }

    // 2. Team policies (skip for bots)
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      for (EntityReference teamRef : teams) {
        policies.addAll(loadTeamPolicies(teamRef.getId(), hierarchy, teamsVisited, false));
      }
    }

    LOG.debug("Loaded {} policies for user: {}", policies.size(), userName);
    return new UserPoliciesContext(
        policies, teamsVisited, TeamHierarchySummary.of(teams, hierarchy));
  }

  private static List<PolicyContext> loadRolePolicies(
      String entityType, String entityName, EntityReference roleRef) {
    List<PolicyContext> policies = new ArrayList<>();
    try {
      Role role = Entity.getEntity(Entity.ROLE, roleRef.getId(), "policies", NON_DELETED);
      for (EntityReference policyRef : listOrEmpty(role.getPolicies())) {
        policies.add(loadPolicyContext(entityType, entityName, roleRef.getName(), policyRef));
      }
    } catch (Exception e) {
      LOG.warn("Failed to load role: {}", roleRef.getName(), e);
    }
    return policies;
  }

  private static List<PolicyContext> loadTeamPolicies(
      UUID teamId,
      Map<UUID, TeamHierarchyResolver.TeamNode> hierarchy,
      List<UUID> visited,
      boolean skipRoles) {
    List<PolicyContext> policies = new ArrayList<>();
    if (visited.contains(teamId)) {
      return policies;
    }
    visited.add(teamId);

    TeamHierarchyResolver.TeamNode team = hierarchy.get(teamId);
    if (team == null) {
      LOG.warn("Failed to load team: {}", teamId);
      return policies;
    }

    // Team's default roles
    if (!skipRoles) {
      for (EntityReference roleRef : team.defaultRoles()) {
        policies.addAll(loadRolePolicies(Entity.TEAM, team.name(), roleRef));
      }
    }

    // Direct policies on team
    for (EntityReference policyRef : team.policies()) {
      policies.add(loadPolicyContext(Entity.TEAM, team.name(), null, policyRef));
    }

    // Parent teams
    for (EntityReference parentRef : team.parents()) {
      policies.addAll(loadTeamPolicies(parentRef.getId(), hierarchy, visited, skipRoles));
    }
    return policies;
  }

  private static PolicyContext loadPolicyContext(
      String entityType, String entityName, String roleName, EntityReference policyRef) {
    Policy policy = Entity.getEntity(Entity.POLICY, policyRef.getId(), "rules", NON_DELETED);
    List<CompiledRule> rules = new ArrayList<>();
    for (Rule r : listOrEmpty(policy.getRules())) {
      rules.add(new CompiledRule(r));
    }
    return new PolicyContext(entityType, entityName, roleName, policyRef.getName(), rules);
  }

  public static List<PolicyContext> getTeamPoliciesForResource(
      UUID teamId, List<UUID> teamsVisited) {
    EntityReference teamRef = new EntityReference().withId(teamId).withType(Entity.TEAM);
    return loadTeamPolicies(
        teamId, TeamHierarchyResolver.closure(List.of(teamRef)), teamsVisited, true);
  }
}
