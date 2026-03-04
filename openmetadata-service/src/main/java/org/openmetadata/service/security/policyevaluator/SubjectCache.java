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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.security.policyevaluator.SubjectContext.PolicyContext;

/**
 * Cache for user policies to improve authorization performance. Caches the compiled policies for
 * each user including policies from direct roles and team hierarchy. Uses batch loading to avoid
 * N+1 query patterns when resolving team hierarchies.
 */
@Slf4j
public class SubjectCache {
  private static final String USER_FIELDS = "roles,teams,isAdmin,profile,domains";

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

  private static final LoadingCache<String, User> USER_CONTEXT_CACHE =
      CacheBuilder.newBuilder()
          .maximumSize(10000)
          .expireAfterWrite(15, TimeUnit.MINUTES)
          .recordStats()
          .build(new UserContextLoader());

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
    USER_CONTEXT_CACHE.invalidate(userName);
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
      return Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, NON_DELETED);
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
      return Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, NON_DELETED);
    }
  }

  private static UserPoliciesContext loadPoliciesForUser(String userName) {
    LOG.debug("Loading policies for user: {}", userName);
    User user = Entity.getEntityByName(Entity.USER, userName, USER_FIELDS, NON_DELETED);
    List<PolicyContext> policies = new ArrayList<>();

    // Step 1: Collect all team IDs from user's teams and their entire ancestor hierarchy
    Set<UUID> userTeamIds =
        listOrEmpty(user.getTeams()).stream()
            .map(EntityReference::getId)
            .collect(Collectors.toSet());

    Set<UUID> allTeamIds;
    if (!Boolean.TRUE.equals(user.getIsBot()) && !userTeamIds.isEmpty()) {
      allTeamIds = EntityRepository.batchLoadAncestorTeamIds(userTeamIds, NON_DELETED);
    } else {
      allTeamIds = new HashSet<>();
    }
    List<UUID> teamsVisited = new ArrayList<>(allTeamIds);

    // Step 2: Batch load team names for PolicyContext assembly
    Map<UUID, String> teamNames = batchLoadEntityNames(Entity.TEAM, allTeamIds);

    // Step 3: Batch load all team->role and team->policy relationships
    Map<UUID, List<EntityReference>> teamToRoles =
        EntityRepository.batchLoadTeamRoles(allTeamIds, NON_DELETED);
    Map<UUID, List<EntityReference>> teamToPolicies =
        EntityRepository.batchLoadTeamPolicies(allTeamIds, NON_DELETED);

    // Step 4: Collect all role IDs (user's direct roles + all teams' default roles)
    Set<UUID> allRoleIds = new HashSet<>();
    Map<UUID, String> roleToSourceEntity = new HashMap<>();
    Map<UUID, String> roleToSourceName = new HashMap<>();

    for (EntityReference roleRef : listOrEmpty(user.getRoles())) {
      allRoleIds.add(roleRef.getId());
      roleToSourceEntity.put(roleRef.getId(), Entity.USER);
      roleToSourceName.put(roleRef.getId(), user.getName());
    }

    // Track which roles come from which teams (for PolicyContext assembly)
    Map<UUID, List<UUID>> roleIdToTeamIds = new HashMap<>();
    for (Map.Entry<UUID, List<EntityReference>> entry : teamToRoles.entrySet()) {
      UUID teamId = entry.getKey();
      for (EntityReference roleRef : entry.getValue()) {
        allRoleIds.add(roleRef.getId());
        roleIdToTeamIds.computeIfAbsent(roleRef.getId(), k -> new ArrayList<>()).add(teamId);
      }
    }

    // Step 5: Batch load all role->policy relationships
    Map<UUID, List<EntityReference>> roleToPolicies =
        EntityRepository.batchLoadRolePolicies(allRoleIds, NON_DELETED);

    // Step 6: Collect all policy IDs and batch load policy entities with rules
    Set<UUID> allPolicyIds = new HashSet<>();
    for (List<EntityReference> policyRefs : roleToPolicies.values()) {
      for (EntityReference ref : policyRefs) {
        allPolicyIds.add(ref.getId());
      }
    }
    for (List<EntityReference> policyRefs : teamToPolicies.values()) {
      for (EntityReference ref : policyRefs) {
        allPolicyIds.add(ref.getId());
      }
    }

    Map<UUID, List<CompiledRule>> policyRulesMap = batchLoadPolicyRules(allPolicyIds);

    // Step 7: Batch load role names for PolicyContext
    Map<UUID, String> roleNames = batchLoadEntityNames(Entity.ROLE, allRoleIds);

    // Step 8: Assemble PolicyContext objects

    // 8a: User's direct roles -> their policies
    for (EntityReference roleRef : listOrEmpty(user.getRoles())) {
      String roleName = roleNames.getOrDefault(roleRef.getId(), roleRef.getName());
      for (EntityReference policyRef : listOrEmpty(roleToPolicies.get(roleRef.getId()))) {
        List<CompiledRule> rules =
            policyRulesMap.getOrDefault(policyRef.getId(), new ArrayList<>());
        policies.add(
            new PolicyContext(Entity.USER, user.getName(), roleName, policyRef.getName(), rules));
      }
    }

    // 8b: Team default roles -> their policies (skip for bots)
    if (!Boolean.TRUE.equals(user.getIsBot())) {
      for (Map.Entry<UUID, List<EntityReference>> entry : teamToRoles.entrySet()) {
        UUID teamId = entry.getKey();
        String teamName = teamNames.getOrDefault(teamId, teamId.toString());
        for (EntityReference roleRef : entry.getValue()) {
          String roleName = roleNames.getOrDefault(roleRef.getId(), roleRef.getName());
          for (EntityReference policyRef : listOrEmpty(roleToPolicies.get(roleRef.getId()))) {
            List<CompiledRule> rules =
                policyRulesMap.getOrDefault(policyRef.getId(), new ArrayList<>());
            policies.add(
                new PolicyContext(Entity.TEAM, teamName, roleName, policyRef.getName(), rules));
          }
        }
      }

      // 8c: Direct team policies
      for (Map.Entry<UUID, List<EntityReference>> entry : teamToPolicies.entrySet()) {
        UUID teamId = entry.getKey();
        String teamName = teamNames.getOrDefault(teamId, teamId.toString());
        for (EntityReference policyRef : entry.getValue()) {
          List<CompiledRule> rules =
              policyRulesMap.getOrDefault(policyRef.getId(), new ArrayList<>());
          policies.add(new PolicyContext(Entity.TEAM, teamName, null, policyRef.getName(), rules));
        }
      }
    }

    LOG.debug("Loaded {} policies for user: {}", policies.size(), userName);
    return new UserPoliciesContext(policies, teamsVisited);
  }

  public static List<PolicyContext> getTeamPoliciesForResource(
      UUID teamId, List<UUID> teamsVisited) {
    return loadTeamPoliciesBatch(teamId, teamsVisited, true);
  }

  private static List<PolicyContext> loadTeamPoliciesBatch(
      UUID teamId, List<UUID> alreadyVisited, boolean skipRoles) {
    List<PolicyContext> policies = new ArrayList<>();
    if (alreadyVisited.contains(teamId)) {
      return policies;
    }

    // Step 1: Get all ancestor team IDs starting from this team
    Set<UUID> startTeamIds = Set.of(teamId);
    Set<UUID> allTeamIds = EntityRepository.batchLoadAncestorTeamIds(startTeamIds, NON_DELETED);

    // Filter out already-visited teams
    Set<UUID> newTeamIds = new HashSet<>();
    for (UUID id : allTeamIds) {
      if (!alreadyVisited.contains(id)) {
        newTeamIds.add(id);
        alreadyVisited.add(id);
      }
    }

    if (newTeamIds.isEmpty()) {
      return policies;
    }

    // Step 2: Batch load team names
    Map<UUID, String> teamNames = batchLoadEntityNames(Entity.TEAM, newTeamIds);

    // Step 3: Batch load roles and policies for all teams
    Map<UUID, List<EntityReference>> teamToRoles =
        skipRoles ? new HashMap<>() : EntityRepository.batchLoadTeamRoles(newTeamIds, NON_DELETED);
    Map<UUID, List<EntityReference>> teamToPolicies =
        EntityRepository.batchLoadTeamPolicies(newTeamIds, NON_DELETED);

    // Step 4: Batch load role->policy relationships
    Set<UUID> allRoleIds = new HashSet<>();
    for (List<EntityReference> roles : teamToRoles.values()) {
      for (EntityReference ref : roles) {
        allRoleIds.add(ref.getId());
      }
    }
    Map<UUID, List<EntityReference>> roleToPolicies =
        EntityRepository.batchLoadRolePolicies(allRoleIds, NON_DELETED);

    // Step 5: Collect all policy IDs and batch load
    Set<UUID> allPolicyIds = new HashSet<>();
    for (List<EntityReference> policyRefs : roleToPolicies.values()) {
      for (EntityReference ref : policyRefs) {
        allPolicyIds.add(ref.getId());
      }
    }
    for (List<EntityReference> policyRefs : teamToPolicies.values()) {
      for (EntityReference ref : policyRefs) {
        allPolicyIds.add(ref.getId());
      }
    }

    Map<UUID, List<CompiledRule>> policyRulesMap = batchLoadPolicyRules(allPolicyIds);
    Map<UUID, String> roleNames = batchLoadEntityNames(Entity.ROLE, allRoleIds);

    // Step 6: Assemble PolicyContext objects
    if (!skipRoles) {
      for (Map.Entry<UUID, List<EntityReference>> entry : teamToRoles.entrySet()) {
        UUID tId = entry.getKey();
        String teamName = teamNames.getOrDefault(tId, tId.toString());
        for (EntityReference roleRef : entry.getValue()) {
          String roleName = roleNames.getOrDefault(roleRef.getId(), roleRef.getName());
          for (EntityReference policyRef : listOrEmpty(roleToPolicies.get(roleRef.getId()))) {
            List<CompiledRule> rules =
                policyRulesMap.getOrDefault(policyRef.getId(), new ArrayList<>());
            policies.add(
                new PolicyContext(Entity.TEAM, teamName, roleName, policyRef.getName(), rules));
          }
        }
      }
    }

    for (Map.Entry<UUID, List<EntityReference>> entry : teamToPolicies.entrySet()) {
      UUID tId = entry.getKey();
      String teamName = teamNames.getOrDefault(tId, tId.toString());
      for (EntityReference policyRef : entry.getValue()) {
        List<CompiledRule> rules =
            policyRulesMap.getOrDefault(policyRef.getId(), new ArrayList<>());
        policies.add(new PolicyContext(Entity.TEAM, teamName, null, policyRef.getName(), rules));
      }
    }

    return policies;
  }

  private static Map<UUID, String> batchLoadEntityNames(String entityType, Set<UUID> ids) {
    Map<UUID, String> nameMap = new HashMap<>();
    if (ids == null || ids.isEmpty()) {
      return nameMap;
    }
    try {
      List<EntityReference> refs =
          Entity.getEntityReferencesByIds(entityType, new ArrayList<>(ids), NON_DELETED);
      for (EntityReference ref : refs) {
        nameMap.put(ref.getId(), ref.getName());
      }
    } catch (Exception e) {
      LOG.warn("Failed to batch load {} names", entityType, e);
    }
    return nameMap;
  }

  private static Map<UUID, List<CompiledRule>> batchLoadPolicyRules(Set<UUID> policyIds) {
    Map<UUID, List<CompiledRule>> rulesMap = new HashMap<>();
    if (policyIds == null || policyIds.isEmpty()) {
      return rulesMap;
    }
    for (UUID policyId : policyIds) {
      try {
        Policy policy = Entity.getEntity(Entity.POLICY, policyId, "rules", NON_DELETED);
        List<CompiledRule> compiled = new ArrayList<>();
        for (Rule r : listOrEmpty(policy.getRules())) {
          compiled.add(new CompiledRule(r));
        }
        rulesMap.put(policy.getId(), compiled);
      } catch (Exception e) {
        LOG.warn("Failed to load policy: {}", policyId, e);
      }
    }
    return rulesMap;
  }
}
