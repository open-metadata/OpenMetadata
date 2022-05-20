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

package org.openmetadata.catalog.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.AuthenticationMechanism;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.teams.authn.JWTAuthMechanism;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

@Slf4j
public class UserRepository extends EntityRepository<User> {
  static final String USER_PATCH_FIELDS = "profile,roles,teams,inheritedRoles,authenticationMechanism";
  static final String USER_UPDATE_FIELDS = "profile,roles,teams";

  public UserRepository(CollectionDAO dao) {
    super(
        UserResource.COLLECTION_PATH,
        Entity.USER,
        User.class,
        dao.userDAO(),
        dao,
        USER_PATCH_FIELDS,
        USER_UPDATE_FIELDS);
  }

  @Override
  public EntityReference getOriginalOwner(User entity) throws IOException {
    // For User entity, the entity and the owner are the same
    return entity.getEntityReference();
  }

  /** Ensures that the default roles are added for POST, PUT and PATCH operations. */
  @Override
  public void prepare(User user) throws IOException {
    setFullyQualifiedName(user);
  }

  @Override
  public void restorePatchAttributes(User original, User updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated
        .withId(original.getId())
        .withName(original.getName())
        .withInheritedRoles(original.getInheritedRoles())
        .withAuthenticationMechanism(original.getAuthenticationMechanism());
  }

  private List<EntityReference> getTeamDefaultRoles(User user) throws IOException {
    List<EntityReference> teamsRef = listOrEmpty(user.getTeams());
    List<EntityReference> defaultRoles = new ArrayList<>();
    for (EntityReference teamRef : teamsRef) {
      Team team = Entity.getEntity(teamRef, new Fields(List.of("defaultRoles")), Include.NON_DELETED);
      if (team.getDefaultRoles() != null) {
        defaultRoles.addAll(team.getDefaultRoles());
      }
    }
    return defaultRoles.stream().distinct().collect(Collectors.toList());
  }

  @Override
  public void storeEntity(User user, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> roles = user.getRoles();
    List<EntityReference> inheritedRoles = user.getInheritedRoles();
    List<EntityReference> teams = user.getTeams();

    // Don't store roles, teams and href as JSON. Build it on the fly based on relationships
    user.withRoles(null).withTeams(null).withHref(null).withInheritedRoles(null);

    store(user.getId(), user, update);

    // Restore the relationships
    user.withRoles(roles).withTeams(teams).withInheritedRoles(inheritedRoles);
  }

  @Override
  public void storeRelationships(User user) throws IOException {
    assignRoles(user, user.getRoles());
    assignTeams(user, user.getTeams());
    user.setInheritedRoles(getInheritedRoles(user));
  }

  @Override
  public UserUpdater getUpdater(User original, User updated, Operation operation) {
    return new UserUpdater(original, updated, operation);
  }

  @Transaction
  public User getByEmail(String email, Fields fields) throws IOException {
    User user = EntityUtil.validate(email, daoCollection.userDAO().findByEmail(email), User.class);
    return setFields(user, fields);
  }

  @Override
  public User setFields(User user, Fields fields) throws IOException {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains("teams") ? getTeams(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    user.setRoles(fields.contains("roles") ? getRoles(user) : null);
    user.setAuthenticationMechanism(
        fields.contains("authenticationMechanism") ? user.getAuthenticationMechanism() : null);
    return user.withInheritedRoles(fields.contains("roles") ? getInheritedRoles(user) : null);
  }

  public boolean isTeamJoinable(String teamId) throws IOException {
    Team team = daoCollection.teamDAO().findEntityById(UUID.fromString(teamId), Include.NON_DELETED);
    return team.getIsJoinable();
  }

  /* Validate if the user is already part of the given team */
  public void validateTeamAddition(String userId, String teamId) throws IOException {
    User user = dao.findEntityById(UUID.fromString(userId));
    List<EntityReference> teams = getTeams(user);
    Optional<EntityReference> team = teams.stream().filter(t -> t.getId().equals(UUID.fromString(teamId))).findFirst();
    if (team.isPresent()) {
      throw new IllegalArgumentException(
          CatalogExceptionMessage.userAlreadyPartOfTeam(user.getName(), team.get().getDisplayName()));
    }
  }

  private List<EntityReference> getOwns(User user) throws IOException {
    // Compile entities owned by the user
    List<EntityReference> ownedEntities =
        daoCollection.relationshipDAO().findTo(user.getId().toString(), Entity.USER, Relationship.OWNS.ordinal());

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(
          daoCollection.relationshipDAO().findTo(team.getId().toString(), Entity.TEAM, Relationship.OWNS.ordinal()));
    }
    // Populate details in entity reference
    return EntityUtil.populateEntityReferences(ownedEntities);
  }

  private List<EntityReference> getFollows(User user) throws IOException {
    return EntityUtil.populateEntityReferences(
        daoCollection.relationshipDAO().findTo(user.getId().toString(), Entity.USER, Relationship.FOLLOWS.ordinal()));
  }

  public List<EntityReference> validateRolesByIds(List<UUID> roleIds) throws IOException {
    if (roleIds == null) {
      return Collections.emptyList(); // Return an empty roles list
    }
    List<EntityReference> validatedRoles = new ArrayList<>();
    for (UUID roleId : roleIds) {
      validatedRoles.add(daoCollection.roleDAO().findEntityReferenceById(roleId));
    }
    return validatedRoles;
  }

  public List<EntityReference> validateTeams(List<UUID> teamIds) throws IOException {
    if (teamIds == null) {
      return Collections.emptyList(); // Return an empty teams list
    }
    List<EntityReference> validatedTeams = new ArrayList<>();
    for (UUID teamId : teamIds) {
      validatedTeams.add(daoCollection.teamDAO().findEntityReferenceById(teamId));
    }
    return validatedTeams;
  }

  private List<EntityReference> getDefaultRole() throws IOException {
    List<String> defaultRoleIds = daoCollection.roleDAO().getDefaultRolesIds();
    return EntityUtil.populateEntityReferences(defaultRoleIds, Entity.ROLE);
  }

  /* Add all the roles that user has been assigned and inherited from the team to User entity */
  private List<EntityReference> getRoles(User user) throws IOException {
    List<String> roleIds = findTo(user.getId(), Entity.USER, Relationship.HAS, Entity.ROLE);
    return EntityUtil.populateEntityReferences(roleIds, Entity.ROLE);
  }

  /* Add all the roles that user has been assigned and inherited from the team to User entity */
  private List<EntityReference> getInheritedRoles(User user) throws IOException {
    List<EntityReference> roles = getDefaultRole();
    roles.addAll(getTeamDefaultRoles(user));
    return roles.stream().distinct().collect(Collectors.toList()); // Remove duplicates
  }

  /* Add all the teams that user belongs to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<String> teamIds = findFrom(user.getId(), Entity.USER, Relationship.HAS, Entity.TEAM);
    List<EntityReference> teams = EntityUtil.populateEntityReferences(teamIds, Entity.TEAM);
    // return only the non-deleted teams
    return teams.stream().filter(team -> !team.getDeleted()).collect(Collectors.toList());
  }

  private void assignRoles(User user, List<EntityReference> roles) {
    roles = listOrEmpty(roles);
    for (EntityReference role : roles) {
      addRelationship(user.getId(), role.getId(), Entity.USER, Entity.ROLE, Relationship.HAS);
    }
  }

  private void assignTeams(User user, List<EntityReference> teams) {
    teams = listOrEmpty(teams);
    for (EntityReference team : teams) {
      addRelationship(team.getId(), user.getId(), Entity.TEAM, Entity.USER, Relationship.HAS);
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateRoles(original, updated);
      updateTeams(original, updated);
      recordChange("profile", original.getProfile(), updated.getProfile(), true);
      recordChange("timezone", original.getTimezone(), updated.getTimezone());
      recordChange("isBot", original.getIsBot(), updated.getIsBot());
      recordChange("isAdmin", original.getIsAdmin(), updated.getIsAdmin());
      recordChange("email", original.getEmail(), updated.getEmail());
      // Add inherited roles to the entity after update
      updated.setInheritedRoles(getInheritedRoles(updated));
      updateAuthenticationMechanism(original, updated);
    }

    private void updateRoles(User original, User updated) throws IOException {
      // Remove roles from original and add roles from updated
      deleteFrom(original.getId(), Entity.USER, Relationship.HAS, Entity.ROLE);
      assignRoles(updated, updated.getRoles());

      List<EntityReference> origRoles = listOrEmpty(original.getRoles());
      List<EntityReference> updatedRoles = listOrEmpty(updated.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("roles", origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateTeams(User original, User updated) throws IOException {
      // Remove teams from original and add teams from updated
      deleteTo(original.getId(), Entity.USER, Relationship.HAS, Entity.TEAM);
      assignTeams(updated, updated.getTeams());

      List<EntityReference> origTeams = listOrEmpty(original.getTeams());
      List<EntityReference> updatedTeams = listOrEmpty(updated.getTeams());

      origTeams.sort(EntityUtil.compareEntityReference);
      updatedTeams.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("teams", origTeams, updatedTeams, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateAuthenticationMechanism(User original, User updated) throws IOException {
      AuthenticationMechanism origAuthMechanism = original.getAuthenticationMechanism();
      AuthenticationMechanism updatedAuthMechanism = updated.getAuthenticationMechanism();
      if (origAuthMechanism == null && updatedAuthMechanism != null) {
        recordChange(
            "authenticationMechanism", original.getAuthenticationMechanism(), updated.getAuthenticationMechanism());
      } else if (origAuthMechanism != null
          && updatedAuthMechanism != null
          && origAuthMechanism.getConfig() != null
          && updatedAuthMechanism.getConfig() != null) {
        JWTAuthMechanism origJwtAuthMechanism =
            JsonUtils.convertValue(origAuthMechanism.getConfig(), JWTAuthMechanism.class);
        JWTAuthMechanism updatedJwtAuthMechanism =
            JsonUtils.convertValue(updatedAuthMechanism.getConfig(), JWTAuthMechanism.class);
        if (!origJwtAuthMechanism.getJWTToken().equals(updatedJwtAuthMechanism.getJWTToken())) {
          recordChange(
              "authenticationMechanism", original.getAuthenticationMechanism(), updated.getAuthenticationMechanism());
        }
      }
    }
  }
}
