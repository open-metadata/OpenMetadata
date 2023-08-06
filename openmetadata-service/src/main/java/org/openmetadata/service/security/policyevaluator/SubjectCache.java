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

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.service.Entity;

/** Subject context used for Access Control Policies */
@Slf4j
public class SubjectCache {
  private static final String USER_FIELDS = "roles,teams,isAdmin,profile";
  public static final String TEAM_FIELDS = "defaultRoles, policies, parents, profile";

  private SubjectCache() {
    // Private constructor for singleton
  }

  public static SubjectContext getSubjectContext(String userName) {
    return new SubjectContext(getUser(userName));
  }

  public static SubjectContext getSubjectContext(UUID userId) {
    return new SubjectContext(getUserById(userId));
  }

  public static User getUser(String userName) {
    return Entity.getEntityByName(Entity.USER, EntityInterfaceUtil.quoteName(userName), USER_FIELDS, NON_DELETED);
  }

  public static User getUserById(String userId) {
    return getUserById(UUID.fromString(userId));
  }

  public static User getUserById(UUID userId) {
    return Entity.getEntity(Entity.USER, userId, USER_FIELDS, NON_DELETED);
  }

  public static Team getTeamByName(String teamName) {
    return Entity.getEntityByName(Entity.TEAM, teamName, TEAM_FIELDS, NON_DELETED);
  }

  /** Return true if given list of teams is part of the hierarchy of parentTeam */
  public static boolean isInTeam(String parentTeam, EntityReference team) {
    Deque<EntityReference> stack = new ArrayDeque<>();
    stack.push(team); // Start with team and see if the parent matches
    while (!stack.isEmpty()) {
      try {
        Team parent = Entity.getEntity(Entity.TEAM, stack.pop().getId(), TEAM_FIELDS, NON_DELETED);
        if (parent.getName().equals(parentTeam)) {
          return true;
        }
        listOrEmpty(parent.getParents()).forEach(stack::push); // Continue to go up the chain of parents
      } catch (Exception ex) {
        // Ignore and return false
      }
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
      try {
        Team parent = Entity.getEntity(Entity.TEAM, stack.pop().getId(), TEAM_FIELDS, NON_DELETED);
        if (hasRole(parent.getDefaultRoles(), role)) {
          return true;
        }
        listOrEmpty(parent.getParents()).forEach(stack::push); // Continue to go up the chain of parents
      } catch (Exception ex) {
        // Ignore the exception and return false
      }
    }
    return false;
  }

  private static boolean hasRole(List<EntityReference> userRoles, String expectedRole) {
    return listOrEmpty(userRoles).stream().anyMatch(userRole -> userRole.getName().equals(expectedRole));
  }

  public static void cleanUp() {
    LOG.info("Subject cache is cleaned up");
  }

  public static List<EntityReference> getRolesForTeams(List<EntityReference> teams) {
    List<EntityReference> roles = new ArrayList<>();
    for (EntityReference teamRef : listOrEmpty(teams)) {
      try {
        Team team = Entity.getEntity(Entity.TEAM, teamRef.getId(), TEAM_FIELDS, NON_DELETED);
        roles.addAll(team.getDefaultRoles());
        roles.addAll(getRolesForTeams(team.getParents()));
      } catch (Exception ex) {
        // Ignore and continue
      }
    }
    return roles.stream().distinct().collect(Collectors.toList());
  }
}
