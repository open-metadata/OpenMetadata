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

/** Subject context used for Access Control Policies */
@Slf4j
public class SubjectCache {
  protected static final LoadingCache<String, SubjectContext> USER_CACHE =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new UserLoader());
  protected static final LoadingCache<UUID, SubjectContext> USER_CACHE_WITH_ID =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new UserLoaderWithId());
  protected static final LoadingCache<String, Team> TEAM_CACHE =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new TeamLoader());
  protected static final LoadingCache<UUID, Team> TEAM_CACHE_WITH_ID =
      CacheBuilder.newBuilder().maximumSize(1000).expireAfterWrite(3, TimeUnit.MINUTES).build(new TeamLoaderWithId());
  private static final String USER_FIELDS = "roles,teams,isAdmin,profile";
  private static final String TEAM_FIELDS = "defaultRoles, policies, parents, profile";

  private SubjectCache() {
    // Private constructor for singleton
  }

  public static SubjectContext getSubjectContext(String userName) throws EntityNotFoundException {
    try {
      return USER_CACHE.get(userName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userName));
    }
  }

  public static SubjectContext getSubjectContext(UUID userId) throws EntityNotFoundException {
    try {
      return USER_CACHE_WITH_ID.get(userId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  public static User getUser(String userName) throws EntityNotFoundException {
    try {
      return USER_CACHE.get(userName).getUser();
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userName));
    }
  }

  public static User getUserById(String userId) throws EntityNotFoundException {
    return getUserById(UUID.fromString(userId));
  }

  public static User getUserById(UUID userId) throws EntityNotFoundException {
    try {
      return USER_CACHE_WITH_ID.get(userId).getUser();
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.USER, userId));
    }
  }

  public static Team getTeam(UUID teamId) throws EntityNotFoundException {
    try {
      return TEAM_CACHE_WITH_ID.get(teamId);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.TEAM, teamId));
    }
  }

  public static Team getTeamByName(String teamName) throws EntityNotFoundException {
    try {
      return TEAM_CACHE.get(teamName);
    } catch (ExecutionException | UncheckedExecutionException ex) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound(Entity.TEAM, teamName));
    }
  }

  /** Return true if given list of teams is part of the hierarchy of parentTeam */
  public static boolean isInTeam(String parentTeam, EntityReference team) {
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
  public static boolean hasRole(User user, String role) {
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
    USER_CACHE.invalidateAll();
    TEAM_CACHE_WITH_ID.invalidateAll();
  }

  public static void invalidateUser(String userName) {
    try {
      USER_CACHE.invalidate(userName);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for user {}", userName, ex);
    }
  }

  public static void invalidateTeam(UUID teamId) {
    try {
      TEAM_CACHE_WITH_ID.invalidate(teamId);
    } catch (Exception ex) {
      LOG.error("Failed to invalidate cache for team {}", teamId, ex);
    }
  }

  public static List<EntityReference> getRolesForTeams(List<EntityReference> teams) {
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
      try {
        User user =
            Entity.getEntityByName(Entity.USER, EntityInterfaceUtil.quoteName(userName), USER_FIELDS, NON_DELETED);
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
      User user = Entity.getEntity(Entity.USER, uid, USER_FIELDS, NON_DELETED);
      LOG.info("Loaded user {}:{}", user.getName(), user.getId());
      return new SubjectContext(user);
    }
  }

  static class TeamLoader extends CacheLoader<String, Team> {
    @Override
    public Team load(@CheckForNull String teamName) throws IOException {
      Team team = Entity.getEntityByName(Entity.TEAM, teamName, TEAM_FIELDS, NON_DELETED);
      LOG.info("Loaded team {}:{}", team.getName(), team.getId());
      return team;
    }
  }

  static class TeamLoaderWithId extends CacheLoader<UUID, Team> {
    @Override
    public Team load(@NonNull UUID teamId) throws IOException {
      Team team = Entity.getEntity(Entity.TEAM, teamId, TEAM_FIELDS, NON_DELETED);
      LOG.info("Loaded team {}:{}", team.getName(), team.getId());
      return team;
    }
  }
}
