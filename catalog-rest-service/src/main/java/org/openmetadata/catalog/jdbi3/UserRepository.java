/*
 *  Licensed to the Apache Software Foundation (ASF) under one or more
 *  contributor license agreements. See the NOTICE file distributed with
 *  this work for additional information regarding copyright ownership.
 *  The ASF licenses this file to You under the Apache License, Version 2.0
 *  (the "License"); you may not use this file except in compliance with
 *  the License. You may obtain a copy of the License at
 *
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.catalog.jdbi3;

import com.fasterxml.jackson.core.JsonProcessingException;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.teams.UserResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.net.URI;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.openmetadata.catalog.jdbi3.Relationship.CONTAINS;
import static org.openmetadata.catalog.jdbi3.Relationship.FOLLOWS;
import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;

public class UserRepository extends EntityRepository<User> {
  public static final Logger LOG = LoggerFactory.getLogger(UserRepository.class);
  static final Fields USER_PATCH_FIELDS = new Fields(UserResource.FIELD_LIST, "profile,teams");
  static final Fields USER_UPDATE_FIELDS = new Fields(UserResource.FIELD_LIST, "profile,teams");

  private final CollectionDAO dao;


  public UserRepository(CollectionDAO dao) {
    super(UserResource.COLLECTION_PATH, Entity.USER, User.class, dao.userDAO(), dao, USER_PATCH_FIELDS,
            USER_UPDATE_FIELDS);
    this.dao = dao;
  }

  @Override
  public EntityInterface<User> getEntityInterface(User entity) {
    return new UserEntityInterface(entity);
  }


  @Override
  public void prepare(User entity) throws IOException {

  }

  @Override
  public void storeEntity(User user, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> teams = user.getTeams();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    user.withTeams(null).withHref(null);

    if (update) {
      dao.userDAO().update(user.getId(), JsonUtils.pojoToJson(user));
    } else {
      dao.userDAO().insert(user);
    }

    // Restore the relationships
    user.withTeams(teams);
  }

  @Override
  public void addRelationships(User user) throws IOException {
    assignTeams(user, user.getTeams());
  }

  @Override
  public EntityUpdater getUpdater(User original, User updated, boolean patchOperation) throws IOException {
    return new UserUpdater(original, updated, patchOperation);
  }

  @Transaction
  public User getByEmail(String email, Fields fields) throws IOException {
    User user = EntityUtil.validate(email, dao.userDAO().findByEmail(email), User.class);
    return setFields(user, fields);
  }

  @Transaction
  public void delete(UUID id) throws IOException {
    // Query - mark user as deactivated
    User user = markUserAsDeactivated(id);

    // Remove relationship membership to teams
    dao.relationshipDAO().deleteTo(user.getId().toString(), CONTAINS.ordinal(), "team");

    // Remove follows relationship to entities
    dao.relationshipDAO().deleteFrom(id.toString(), FOLLOWS.ordinal());
  }

  @Override
  public User setFields(User user, Fields fields) throws IOException {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains("teams") ? getTeams(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    return user;
  }

  @Override
  public void restorePatchAttributes(User original, User updated) throws IOException, ParseException {

  }

  private List<EntityReference> getOwns(User user) throws IOException {
    // Compile entities owned by the user
    List<EntityReference> ownedEntities = dao.relationshipDAO().findTo(user.getId().toString(), OWNS.ordinal());

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(dao.relationshipDAO().findTo(team.getId().toString(), OWNS.ordinal()));
    }
    // Populate details in entity reference
    return EntityUtil.populateEntityReferences(ownedEntities);
  }

  private List<EntityReference> getFollows(User user) throws IOException {
    return EntityUtil.populateEntityReferences(
            dao.relationshipDAO().findTo(user.getId().toString(), FOLLOWS.ordinal()));
  }

  private User validateUser(UUID userId) throws IOException {
    return dao.userDAO().findEntityById(userId);
  }

  public List<EntityReference> validateTeams(List<UUID> teamIds) throws IOException {
    if (teamIds == null) {
      return Collections.emptyList(); // Return empty team list
    }
    List<EntityReference> validatedTeams = new ArrayList<>();
    for (UUID teamId : teamIds) {
      validatedTeams.add(dao.teamDAO().findEntityReferenceById(teamId));
    }
    return validatedTeams;
  }

  /* Add all the teams that user belongs to to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<String> teamIds = dao.relationshipDAO().findFrom(user.getId().toString(), CONTAINS.ordinal(), "team");
    List<EntityReference> teams = new ArrayList<>();
    for (String teamId : teamIds) {
      teams.add(dao.teamDAO().findEntityReferenceById(UUID.fromString(teamId)));
    }
    return teams;
  }

  private void assignTeams(User user, List<EntityReference> teams) {
    // Query - add team to the user
    teams = Optional.ofNullable(teams).orElse(Collections.emptyList());
    for (EntityReference team : teams) {
      dao.relationshipDAO().insert(team.getId().toString(), user.getId().toString(),
              "team", "user", CONTAINS.ordinal());
    }
  }

  private User markUserAsDeactivated(UUID id) throws IOException {
    User user = validateUser(id);
    if (Optional.ofNullable(user.getDeactivated()).orElse(false)) {
      // User is already deactivated
      return user;
    }
    user.setDeactivated(true);
    user.setName("deactivated." + user.getName());
    user.setDisplayName("Deactivated " + user.getDisplayName());
    dao.userDAO().update(id, JsonUtils.pojoToJson(user));
    return user;
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
    public String getDescription() { return entity.getDescription(); }

    @Override
    public String getDisplayName() {
      return entity.getDisplayName();
    }

    @Override
    public EntityReference getOwner() { return null; }

    @Override
    public String getFullyQualifiedName() { return entity.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public Double getVersion() { return entity.getVersion(); }

    @Override
    public String getUpdatedBy() { return entity.getUpdatedBy(); }

    @Override
    public Date getUpdatedAt() { return entity.getUpdatedAt(); }

    @Override
    public URI getHref() { return entity.getHref(); }

    @Override
    public List<EntityReference> getFollowers() {
      throw new UnsupportedOperationException("User does not support followers");
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference().withId(getId()).withName(getFullyQualifiedName()).withDescription(getDescription())
              .withDisplayName(getDisplayName()).withType(Entity.USER).withHref(getHref());
    }

    @Override
    public User getEntity() { return entity; }

    @Override
    public void setId(UUID id) { entity.setId(id); }

    @Override
    public void setDescription(String description) { entity.setDescription(description);}

    @Override
    public void setDisplayName(String displayName) { entity.setDisplayName(displayName);}

    @Override
    public void setUpdateDetails(String updatedBy, Date updatedAt) {
      entity.setUpdatedBy(updatedBy);
      entity.setUpdatedAt(updatedAt);
    }

    @Override
    public void setChangeDescription(Double newVersion, ChangeDescription changeDescription) {
      entity.setVersion(newVersion);
      entity.setChangeDescription(changeDescription);
    }

    @Override
    public void setOwner(EntityReference owner) { }

    @Override
    public User withHref(URI href) { return entity.withHref(href); }

    @Override
    public ChangeDescription getChangeDescription() { return entity.getChangeDescription(); }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class UserUpdater extends EntityUpdater {
    public UserUpdater(User original, User updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Update operation can't undelete a user
      if (updated.getEntity().getDeactivated() != original.getEntity().getDeactivated()) {
        throw new IllegalArgumentException(
                CatalogExceptionMessage.readOnlyAttribute("User", "deactivated"));
      }
      updateTeams(original.getEntity(), updated.getEntity());
      recordChange("profile", original.getEntity().getProfile(), updated.getEntity().getProfile(), true);
      recordChange("timezone", original.getEntity().getTimezone(), updated.getEntity().getTimezone());
      recordChange("isBot", original.getEntity().getIsBot(), updated.getEntity().getIsBot());
      recordChange("isAdmin", original.getEntity().getIsAdmin(), updated.getEntity().getIsAdmin());
      recordChange("email", original.getEntity().getEmail(), updated.getEntity().getEmail());
    }

    private void updateTeams(User origUser, User updatedUser) throws JsonProcessingException {
      // Remove teams from original and add teams from updated
      dao.relationshipDAO().deleteTo(origUser.getId().toString(), CONTAINS.ordinal(), "team");
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
