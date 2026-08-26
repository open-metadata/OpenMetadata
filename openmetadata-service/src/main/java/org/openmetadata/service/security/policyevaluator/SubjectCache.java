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
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
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
  private static final String TEAM_FIELDS = "defaultRoles,policies,parents,profile,domains";

  static class UserPoliciesContext {
    final List<PolicyContext> policies;
    final List<UUID> teamsVisited;

    UserPoliciesContext(List<PolicyContext> policies, List<UUID> teamsVisited) {
      this.policies = policies;
      this.teamsVisited = teamsVisited;
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
        if (Entity.PERSONA.equals(type) || Entity.TEAM.equals(type)) {
          invalidateAllUserContexts();
        } else if (Entity.USER.equals(type) && fqn != null) {
          invalidateUserContextByFqn(fqn);
        }
      };

  private SubjectCache() {}

  /**
   * Rebuild auth caches with configured max entries. TTLs are kept at their original values
   * (2 min for policies, 15 min for user context) because they serve different freshness needs.
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
   * <p>Scoped to user contexts. {@code USER_POLICIES_CACHE} has its own 2-minute TTL and peers
   * relying on it is pre-existing behaviour that this persona fix deliberately doesn't widen.
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
  private static void invalidateUserContextByFqn(String fqn) {
    try {
      String userName = FullyQualifiedName.unquoteName(fqn);
      USER_CONTEXT_CACHE.asMap().keySet().removeIf(key -> key.equalsIgnoreCase(userName));
    } catch (Exception e) {
      LOG.debug("Could not invalidate user context for fqn {}", fqn, e);
    }
  }

  public static void invalidateAll() {
    LOG.info("Invalidating all user policy caches");
    USER_POLICIES_CACHE.invalidateAll();
    USER_CONTEXT_CACHE.invalidateAll();
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
        "PolicyCache: %s, UserContextCache: %s",
        USER_POLICIES_CACHE.stats(), USER_CONTEXT_CACHE.stats());
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
    List<PolicyContext> policies = new ArrayList<>();
    List<UUID> teamsVisited = new ArrayList<>();

    // 1. User's direct roles
    for (EntityReference roleRef : listOrEmpty(user.getRoles())) {
      policies.addAll(loadRolePolicies(Entity.USER, user.getName(), roleRef));
    }

    // 2. Team policies (skip for bots)
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      for (EntityReference teamRef : listOrEmpty(user.getTeams())) {
        policies.addAll(loadTeamPolicies(teamRef.getId(), teamsVisited, false));
      }
    }

    LOG.debug("Loaded {} policies for user: {}", policies.size(), userName);
    return new UserPoliciesContext(policies, teamsVisited);
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
      UUID teamId, List<UUID> visited, boolean skipRoles) {
    List<PolicyContext> policies = new ArrayList<>();
    if (visited.contains(teamId)) {
      return policies;
    }
    visited.add(teamId);

    try {
      Team team = Entity.getEntity(Entity.TEAM, teamId, TEAM_FIELDS, NON_DELETED);

      // Team's default roles
      if (!skipRoles) {
        for (EntityReference roleRef : listOrEmpty(team.getDefaultRoles())) {
          policies.addAll(loadRolePolicies(Entity.TEAM, team.getName(), roleRef));
        }
      }

      // Direct policies on team
      for (EntityReference policyRef : listOrEmpty(team.getPolicies())) {
        policies.add(loadPolicyContext(Entity.TEAM, team.getName(), null, policyRef));
      }

      // Parent teams
      for (EntityReference parentRef : listOrEmpty(team.getParents())) {
        policies.addAll(loadTeamPolicies(parentRef.getId(), visited, skipRoles));
      }
    } catch (Exception e) {
      LOG.warn("Failed to load team: {}", teamId, e);
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
    return loadTeamPolicies(teamId, teamsVisited, true);
  }
}
