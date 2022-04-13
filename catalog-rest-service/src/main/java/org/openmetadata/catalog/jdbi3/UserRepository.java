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

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.Relationship;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class UserRepository extends EntityRepository<User> {
  static final String USER_PATCH_FIELDS = "profile,roles,teams";
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
  public EntityInterface<User> getEntityInterface(User entity) {
    return new UserEntityInterface(entity);
  }

  @Override
  public EntityReference getOriginalOwner(User entity) throws IOException {
    // For User entity, the entity and the owner are the same
    return getEntityInterface(entity).getEntityReference();
  }

  /** Ensures that the default roles are added for POST, PUT and PATCH operations. */
  @Override
  public void prepare(User user) throws IOException {
    // Get roles assigned to the user.
    Set<UUID> roleIds = listOrEmpty(user.getRoles()).stream().map(EntityReference::getId).collect(Collectors.toSet());
    // Get default role set up globally.
    daoCollection.roleDAO().getDefaultRolesIds().forEach(roleIdStr -> roleIds.add(UUID.fromString(roleIdStr)));
    // Get default roles from the teams that the user belongs to.
    getTeamDefaultRoles(user).forEach(roleRef -> roleIds.add(roleRef.getId()));

    // Assign roles.
    List<EntityReference> rolesRef = new ArrayList<>(roleIds.size());
    for (UUID roleId : roleIds) {
      rolesRef.add(daoCollection.roleDAO().findEntityReferenceById(roleId));
    }
    rolesRef.sort(EntityUtil.compareEntityReference);
    user.setRoles(rolesRef);
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
    return defaultRoles;
  }

  @Override
  public void storeEntity(User user, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> roles = user.getRoles();
    List<EntityReference> teams = user.getTeams();

    // Don't store roles, teams and href as JSON. Build it on the fly based on relationships
    user.withRoles(null).withTeams(null).withHref(null);

    store(user.getId(), user, update);

    // Restore the relationships
    user.withRoles(roles).withTeams(teams);
  }

  @Override
  public void storeRelationships(User user) {
    assignRoles(user, user.getRoles());
    assignTeams(user, user.getTeams());
  }

  @Override
  public EntityUpdater getUpdater(User original, User updated, Operation operation) {
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
    user.setRoles(fields.contains("roles") ? getRoles(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    return user;
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

  /* Add all the roles that user has been assigned, to User entity */
  private List<EntityReference> getRoles(User user) throws IOException {
    List<String> roleIds = findTo(user.getId(), Entity.USER, Relationship.HAS, Entity.ROLE);
    return EntityUtil.populateEntityReferences(roleIds, Entity.ROLE);
  }

  /* Add all the teams that user belongs to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<String> teamIds = findFrom(user.getId(), Entity.USER, Relationship.HAS, Entity.TEAM);
    return EntityUtil.populateEntityReferences(teamIds, Entity.TEAM);
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

  public static class UserEntityInterface extends EntityInterface<User> {
    public UserEntityInterface(User entity) {
      super(Entity.USER, entity);
    }

    @Override
    public UUID getId() {
      return entity.getId();
    }

    @Override
    public String getDescription() {
      return entity.getDescription();
    }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public String getName() {
      return entity.getName();
    }

    @Override
    public Boolean isDeleted() {
      return entity.getDeleted();
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public Double getVersion() {
      return entity.getVersion();
    }

    @Override
    public String getUpdatedBy() {
      return entity.getUpdatedBy();
    }

    @Override
    public long getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public User getEntity() {
      return entity;
    }

    @Override
    public void setId(UUID id) {
      entity.setId(id);
    }

    @Override
    public void setDescription(String description) {
      entity.setDescription(description);
    }

    @Override
    public void setDisplayName(String displayName) {
      entity.setDisplayName(displayName);
    }

    @Override
    public void setName(String name) {
      entity.setName(name);
    }

    @Override
    public void setUpdateDetails(String updatedBy, long updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public User withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }
  }

  /** Handles entity updated from PUT and POST operation. */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateRoles(original.getEntity(), updated.getEntity());
      updateTeams(original.getEntity(), updated.getEntity());
      recordChange("profile", original.getEntity().getProfile(), updated.getEntity().getProfile(), true);
      recordChange("timezone", original.getEntity().getTimezone(), updated.getEntity().getTimezone());
      recordChange("isBot", original.getEntity().getIsBot(), updated.getEntity().getIsBot());
      recordChange("isAdmin", original.getEntity().getIsAdmin(), updated.getEntity().getIsAdmin());
      recordChange("email", original.getEntity().getEmail(), updated.getEntity().getEmail());
    }

    private void updateRoles(User origUser, User updatedUser) throws IOException {
      // Remove roles from original and add roles from updated
      deleteFrom(origUser.getId(), Entity.USER, Relationship.HAS, Entity.ROLE);
      assignRoles(updatedUser, updatedUser.getRoles());

      List<EntityReference> origRoles = listOrEmpty(origUser.getRoles());
      List<EntityReference> updatedRoles = listOrEmpty(updatedUser.getRoles());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("roles", origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateTeams(User origUser, User updatedUser) throws JsonProcessingException {
      // Remove teams from original and add teams from updated
      deleteTo(origUser.getId(), Entity.USER, Relationship.HAS, Entity.TEAM);
      assignTeams(updatedUser, updatedUser.getTeams());

      List<EntityReference> origTeams = listOrEmpty(origUser.getTeams());
      List<EntityReference> updatedTeams = listOrEmpty(updatedUser.getTeams());

      origTeams.sort(EntityUtil.compareEntityReference);
      updatedTeams.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("teams", origTeams, updatedTeams, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
