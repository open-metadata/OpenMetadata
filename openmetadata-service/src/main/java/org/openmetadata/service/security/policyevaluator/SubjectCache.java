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

import com.google.common.cache.CacheBuilder;
import com.google.common.cache.CacheLoader;
import com.google.common.cache.LoadingCache;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import javax.annotation.CheckForNull;
import lombok.NonNull;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TeamRepository;
import org.openmetadata.service.jdbi3.UserRepository;
import org.openmetadata.service.util.EntityUtil.Fields;

/** Subject context used for Access Control Policies */
@Slf4j
public class SubjectCache {
  private static SubjectCache instance;
  private static volatile boolean initialized = false;
  protected static LoadingCache<String, SubjectContext> userCache;
  protected static LoadingCache<UUID, SubjectContext> userCacheWihId;
  protected static LoadingCache<String, Team> teamCache;
  protected static LoadingCache<UUID, Team> teamCacheWithId;
  protected static UserRepository userRepository;
  protected static Fields userFields;
  protected static TeamRepository teamRepository;
  protected static Fields teamFields;

  // Expected to be called only once from the DefaultAuthorizer
  public static void initialize() {
    if (!initialized) {
      userCache =
          CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new UserLoader());
      userCacheWihId =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterWrite(3, TimeUnit.MINUTES)
              .build(new UserLoaderWithId());
      teamCache =
          CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new TeamLoader());
      teamCacheWithId =
          CacheBuilder.newBuilder()
              .maximumSize(1000)
              .expireAfterWrite(3, TimeUnit.MINUTES)
              .build(new TeamLoaderWithId());
      userRepository = (UserRepository) Entity.getEntityRepository(Entity.USER);
      userFields = userRepository.getFields("roles, teams, isAdmin, profile");
      teamRepository = (TeamRepository) Entity.getEntityRepository(Entity.TEAM);
      teamFields = teamRepository.getFields("defaultRoles, policies, parents, profile");
      instance = new SubjectCache();
      initialized = true;
      LOG.info("Subject cache is initialized");
    } else {
      LOG.info("Subject cache is already initialized");
    }
  }

  public static SubjectCache getInstance() {
    return instance;
  }

  public SubjectContext getSubjectContext(String userName) throws EntityNotFoundException {
    try {
      return userCache.get(userName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userName));
    }
  }

  public SubjectContext getSubjectContext(UUID userId) throws EntityNotFoundException {
    try {
      return userCacheWihId.get(userId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  public User getUser(String userName) throws EntityNotFoundException {
    try {
      return userCache.get(userName).getUser();
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userName));
    }
  }

  public User getUserById(String userId) throws EntityNotFoundException {
    return getUserById(UUID.fromString(userId));
  }

  public User getUserById(UUID userId) throws EntityNotFoundException {
    try {
      return userCacheWihId.get(userId).getUser();
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  public Team getTeam(UUID teamId) throws EntityNotFoundException {
    try {
      return teamCacheWithId.get(teamId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.TEAM, teamId));
    }
  }

  public Team getTeamByName(String teamName) throws EntityNotFoundException {
    try {
      return teamCache.get(teamName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.TEAM, teamName));
    }
  }

  /** Return true if given list of teams is part of the hierarchy of parentTeam */
  public boolean isInTeam(String parentTeam, EntityReference team) {
    Deque<EntityReference> stack = new ArrayDeque<>();
    stack.push(team); // Start with team and see if the parent matches
    while (!stack.isEmpty()) {
      Team parent = getTeam(stack.pop().getId());
      if (parent.getName().equals(parentTeam)) {
        return true;
      }
      listOrEmpty(parent.getParents()).forEach(stack::push); // Continue to go up the chain of parents
    }
    return false;
  }

  /** Return true if the given user has any roles the list of roles */
  public boolean hasRole(User user, String role) {
    Deque<EntityReference> stack = new ArrayDeque<>();
    // If user has one of the roles directly assigned then return true
    if (hasRole(user.getRoles(), role)) {
      return true;
    }
    listOrEmpty(user.getTeams()).forEach(stack::push); // Continue to go up the chain of parents
    while (!stack.isEmpty()) {
      Team parent = getTeam(stack.pop().getId());
      if (hasRole(parent.getDefaultRoles(), role)) {
        return true;
      }
      listOrEmpty(parent.getParents()).forEach(stack::push); // Continue to go up the chain of parents
    }
    return false;
  }

  private static boolean hasRole(List<EntityReference> userRoles, String expectedRole) {
    return listOrEmpty(userRoles).stream().anyMatch(userRole -> userRole.getName().equals(expectedRole));
  }

  public static void cleanUp() {
    LOG.info("Subject cache is cleaned up");
    userCache.invalidateAll();
    teamCacheWithId.invalidateAll();
    initialized = false;
  }

  public void invalidateUser(String userName) {
    try {
      userCache.invalidate(userName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for user {}", userName, ex);
    }
  }

  public void invalidateTeam(UUID teamId) {
    try {
      teamCacheWithId.invalidate(teamId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for team {}", teamId, ex);
    }
  }

  public List<EntityReference> getRolesForTeams(List<EntityReference> teams) {
    List<EntityReference> roles = new ArrayList<>();
    for (EntityReference teamRef : listOrEmpty(teams)) {
      Team team = getTeam(teamRef.getId());
      if (team != null) {
        roles.addAll(team.getDefaultRoles());
        roles.addAll(getRolesForTeams(team.getParents()));
      }
    }
    return roles.stream().distinct().collect(Collectors.toList());
  }

  static class UserLoader extends CacheLoader<String, SubjectContext> {
    @Override
    public SubjectContext load(@CheckForNull String userName) throws IOException {
      // XXX
      try {
        System.out.println("Loading user by name " + userName);
        User user = userRepository.getByName(null, EntityInterfaceUtil.quoteName(userName), userFields);
        LOG.info("Loaded user {}:{}", user.getName(), user.getId());
        return new SubjectContext(user);
      } catch (Exception ex) {
        ex.printStackTrace();
        throw ex;
      }
    }
  }

  static class UserLoaderWithId extends CacheLoader<UUID, SubjectContext> {
    @Override
    public SubjectContext load(@CheckForNull UUID uid) throws IOException {
      User user = userRepository.get(null, uid, userFields);
      LOG.info("Loaded user {}:{}", user.getName(), user.getId());
      return new SubjectContext(user);
    }
  }

  static class TeamLoader extends CacheLoader<String, Team> {
    @Override
    public Team load(@CheckForNull String userName) throws IOException {
      Team team = teamRepository.getByName(null, userName, teamFields);
      LOG.info("Loaded user {}:{}", team.getName(), team.getId());
      return team;
    }
  }

  static class TeamLoaderWithId extends CacheLoader<UUID, Team> {
    @Override
    public Team load(@NonNull UUID teamId) throws IOException {
      Team team = teamRepository.get(null, teamId, teamFields);
      LOG.info("Loaded team {}:{}", team.getName(), team.getId());
      return team;
    }
  }
}
