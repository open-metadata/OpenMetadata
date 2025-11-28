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
import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import java.util.ArrayList;
import java.util.List;
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
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Cache for user policies to improve authorization performance. Caches the compiled policies for
 * each user including policies from direct roles and team hierarchy.
 */
@Slf4j
public class SubjectCache {
  private static final String USER_FIELDS = "roles,teams,isAdmin,profile,domains";
  private static final String TEAM_FIELDS = "defaultRoles,policies,parents,profile,domains";

  static class UserPoliciesContext {
    final List<PolicyContext> policies;
    final List<UUID> teamsVisited;

    UserPoliciesContext(List<PolicyContext> policies, List<UUID> teamsVisited) {
      this.policies = policies;
      this.teamsVisited = teamsVisited;
    }
  }

  private static final LoadingCache<String, UserPoliciesContext> USER_POLICIES_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(2, TimeUnit.MINUTES)
          .recordStats()
          .build(new UserPoliciesLoader());

  private SubjectCache() {}

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
  }

  public static void invalidateAll() {
    LOG.info("Invalidating all user policy caches");
    USER_POLICIES_CACHE.invalidateAll();
  }

  static class UserPoliciesLoader extends CacheLoader<String, UserPoliciesContext> {
    @Override
    public @NonNull UserPoliciesContext load(@CheckForNull String userName) {
      return loadPoliciesForUser(userName);
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
