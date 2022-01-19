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

import static org.openmetadata.catalog.Entity.helper;
import static org.openmetadata.catalog.jdbi3.Relationship.FOLLOWS;
import static org.openmetadata.catalog.jdbi3.Relationship.HAS;
import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;
import static org.openmetadata.catalog.util.EntityUtil.toBoolean;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

public class UserRepository extends EntityRepository<User> {
  public static final Logger LOG = LoggerFactory.getLogger(UserRepository.class);
  static final Fields USER_PATCH_FIELDS = new Fields(UserResource.FIELD_LIST, "profile,roles,teams");
  static final Fields USER_UPDATE_FIELDS = new Fields(UserResource.FIELD_LIST, "profile,roles,teams");

  public UserRepository(CollectionDAO dao) {
    super(
        UserResource.COLLECTION_PATH,
        Entity.USER,
        User.class,
        dao.userDAO(),
        dao,
        USER_PATCH_FIELDS,
        USER_UPDATE_FIELDS,
        false,
        false,
        false);
  }

  @Override
  public EntityInterface<User> getEntityInterface(User entity) {
    return new UserEntityInterface(entity);
  }

  @Override
  public void prepare(User entity) {}

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
  public EntityUpdater getUpdater(User original, User updated, boolean patchOperation) {
    return new UserUpdater(original, updated, patchOperation);
  }

  @Transaction
  public User getByEmail(String email, Fields fields) throws IOException, ParseException {
    User user = EntityUtil.validate(email, daoCollection.userDAO().findByEmail(email), User.class);
    return setFields(user, fields);
  }

  @Override
  public User setFields(User user, Fields fields) throws IOException, ParseException {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains("teams") ? getTeams(user) : null);
    user.setRoles(fields.contains("roles") ? getRoles(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    return user;
  }

  @Override
  public void restorePatchAttributes(User original, User updated) {}

  private List<EntityReference> getOwns(User user) throws IOException, ParseException {
    // Compile entities owned by the user
    List<EntityReference> ownedEntities =
        daoCollection
            .relationshipDAO()
            .findTo(user.getId().toString(), Entity.USER, OWNS.ordinal(), toBoolean(toInclude(user)));

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(
          daoCollection
              .relationshipDAO()
              .findTo(team.getId().toString(), Entity.TEAM, OWNS.ordinal(), toBoolean(helper(team).isDeleted())));
    }
    // Populate details in entity reference
    return EntityUtil.populateEntityReferences(ownedEntities);
  }

  private List<EntityReference> getFollows(User user) throws IOException {
    return EntityUtil.populateEntityReferences(
        daoCollection
            .relationshipDAO()
            .findTo(user.getId().toString(), Entity.USER, FOLLOWS.ordinal(), toBoolean(toInclude(user))));
  }

  public List<EntityReference> validateRoles(List<UUID> roleIds) throws IOException {
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
    List<String> roleIds =
        daoCollection
            .relationshipDAO()
            .findTo(user.getId().toString(), Entity.USER, HAS.ordinal(), Entity.ROLE, toBoolean(toInclude(user)));
    List<EntityReference> roles = new ArrayList<>(roleIds.size());
    for (String roleId : roleIds) {
      roles.add(daoCollection.roleDAO().findEntityReferenceById(UUID.fromString(roleId)));
    }
    return roles;
  }

  /* Add all the teams that user belongs to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<String> teamIds =
        daoCollection
            .relationshipDAO()
            .findFrom(user.getId().toString(), Entity.USER, HAS.ordinal(), Entity.TEAM, toBoolean(toInclude(user)));
    List<EntityReference> teams = new ArrayList<>();
    for (String teamId : teamIds) {
      teams.add(daoCollection.teamDAO().findEntityReferenceById(UUID.fromString(teamId)));
    }
    return teams;
  }

  private void assignRoles(User user, List<EntityReference> roles) {
    roles = Optional.ofNullable(roles).orElse(Collections.emptyList());
    for (EntityReference role : roles) {
      daoCollection
          .relationshipDAO()
          .insert(user.getId().toString(), role.getId().toString(), Entity.USER, Entity.ROLE, HAS.ordinal());
    }
  }

  private void assignTeams(User user, List<EntityReference> teams) {
    // Query - add team to the user
    teams = Optional.ofNullable(teams).orElse(Collections.emptyList());
    for (EntityReference team : teams) {
      daoCollection
          .relationshipDAO()
          .insert(team.getId().toString(), user.getId().toString(), Entity.TEAM, Entity.USER, HAS.ordinal());
    }
  }

  public static class UserEntityInterface implements EntityInterface<User> {
    private final User entity;

    public UserEntityInterface(User entity) {
      this.entity = entity;
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
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.USER)
          .withHref(getHref());
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
    public UserUpdater(User original, User updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Update operation can't undelete a user
      if (updated.getEntity().getDeleted() != original.getEntity().getDeleted()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("User", "deactivated"));
      }
      updateRoles(original.getEntity(), updated.getEntity());
      updateTeams(original.getEntity(), updated.getEntity());
      recordChange("profile", original.getEntity().getProfile(), updated.getEntity().getProfile(), true);
      recordChange("timezone", original.getEntity().getTimezone(), updated.getEntity().getTimezone());
      recordChange("isBot", original.getEntity().getIsBot(), updated.getEntity().getIsBot());
      recordChange("isAdmin", original.getEntity().getIsAdmin(), updated.getEntity().getIsAdmin());
      recordChange("email", original.getEntity().getEmail(), updated.getEntity().getEmail());
    }

    private void updateRoles(User origUser, User updatedUser) throws JsonProcessingException {
      // Remove roles from original and add roles from updated
      daoCollection.relationshipDAO().deleteFrom(origUser.getId().toString(), Entity.USER, HAS.ordinal(), Entity.ROLE);
      assignRoles(updatedUser, updatedUser.getRoles());

      List<EntityReference> origRoles = Optional.ofNullable(origUser.getRoles()).orElse(Collections.emptyList());
      List<EntityReference> updatedRoles = Optional.ofNullable(updatedUser.getRoles()).orElse(Collections.emptyList());

      origRoles.sort(EntityUtil.compareEntityReference);
      updatedRoles.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("roles", origRoles, updatedRoles, added, deleted, EntityUtil.entityReferenceMatch);
    }

    private void updateTeams(User origUser, User updatedUser) throws JsonProcessingException {
      // Remove teams from original and add teams from updated
      daoCollection.relationshipDAO().deleteTo(origUser.getId().toString(), Entity.USER, HAS.ordinal(), Entity.TEAM);
      assignTeams(updatedUser, updatedUser.getTeams());

      List<EntityReference> origTeams = Optional.ofNullable(origUser.getTeams()).orElse(Collections.emptyList());
      List<EntityReference> updatedTeams = Optional.ofNullable(updatedUser.getTeams()).orElse(Collections.emptyList());

      origTeams.sort(EntityUtil.compareEntityReference);
      updatedTeams.sort(EntityUtil.compareEntityReference);

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      recordListChange("teams", origTeams, updatedTeams, added, deleted, EntityUtil.entityReferenceMatch);
    }
  }
}
