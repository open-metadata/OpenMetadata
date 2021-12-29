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

import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;
import static org.openmetadata.catalog.util.EntityUtil.entityReferenceMatch;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.io.IOException;
import java.net.URI;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;

public class TeamRepository extends EntityRepository<Team> {
  static final Fields TEAM_UPDATE_FIELDS = new Fields(TeamResource.FIELD_LIST, "profile,users");
  static final Fields TEAM_PATCH_FIELDS = new Fields(TeamResource.FIELD_LIST, "profile,users");
  private final CollectionDAO dao;

  public TeamRepository(CollectionDAO dao) {
    super(
        TeamResource.COLLECTION_PATH,
        Entity.TEAM,
        Team.class,
        dao.teamDAO(),
        dao,
        TEAM_PATCH_FIELDS,
        TEAM_UPDATE_FIELDS);
    this.dao = dao;
  }

  public List<EntityReference> getUsers(List<UUID> userIds) {
    if (userIds == null) {
      return null;
    }
    List<EntityReference> users = new ArrayList<>();
    for (UUID id : userIds) {
      users.add(new EntityReference().withId(id));
    }
    return users;
  }

  public void validateUsers(List<EntityReference> users) throws IOException {
    if (users != null) {
      for (EntityReference user : users) {
        EntityReference ref = dao.userDAO().findEntityReferenceById(user.getId());
        user.withType(ref.getType()).withName(ref.getName()).withDisplayName(ref.getDisplayName());
      }
    }
  }

  @Override
  public Team setFields(Team team, Fields fields) throws IOException {
    if (!fields.contains("profile")) {
      team.setProfile(null);
    }
    team.setUsers(fields.contains("users") ? getUsers(team.getId().toString()) : null);
    team.setOwns(fields.contains("owns") ? getOwns(team.getId().toString()) : null);
    return team;
  }

  @Override
  public void restorePatchAttributes(Team original, Team updated) {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
  }

  @Override
  public EntityInterface<Team> getEntityInterface(Team entity) {
    return new TeamEntityInterface(entity);
  }

  @Override
  public void prepare(Team team) throws IOException {
    validateUsers(team.getUsers());
  }

  @Override
  public void storeEntity(Team team, boolean update) throws IOException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = team.getUsers();

    // Don't store users, href as JSON. Build it on the fly based on relationships
    team.withUsers(null).withHref(null);

    if (update) {
      dao.teamDAO().update(team.getId(), JsonUtils.pojoToJson(team));
    } else {
      dao.teamDAO().insert(team);
    }

    // Restore the relationships
    team.withUsers(users);
  }

  @Override
  public void storeRelationships(Team team) {
    for (EntityReference user : Optional.ofNullable(team.getUsers()).orElse(Collections.emptyList())) {
      dao.relationshipDAO()
          .insert(team.getId().toString(), user.getId().toString(), "team", "user", Relationship.HAS.ordinal());
      System.out.println("Team " + team.getName() + " has user " + user.getName());
    }
  }

  @Override
  public EntityUpdater getUpdater(Team original, Team updated, boolean patchOperation) {
    return new TeamUpdater(original, updated, patchOperation);
  }

  private List<EntityReference> getUsers(String id) throws IOException {
    List<String> userIds = dao.relationshipDAO().findTo(id, Relationship.HAS.ordinal(), "user");
    List<EntityReference> users = new ArrayList<>();
    for (String userId : userIds) {
      users.add(dao.userDAO().findEntityReferenceById(UUID.fromString(userId)));
    }
    return users;
  }

  private List<EntityReference> getOwns(String teamId) throws IOException {
    // Compile entities owned by the team
    return EntityUtil.populateEntityReferences(dao.relationshipDAO().findTo(teamId, OWNS.ordinal()));
  }

  public static class TeamEntityInterface implements EntityInterface<Team> {
    private final Team entity;

    public TeamEntityInterface(Team entity) {
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
    public EntityReference getOwner() {
      return null;
    }

    @Override
    public String getFullyQualifiedName() {
      return entity.getName();
    }

    @Override
    public List<TagLabel> getTags() {
      return null;
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
    public Date getUpdatedAt() {
      return entity.getUpdatedAt();
    }

    @Override
    public URI getHref() {
      return entity.getHref();
    }

    @Override
    public List<EntityReference> getFollowers() {
      throw new UnsupportedOperationException("Team does not support followers");
    }

    @Override
    public EntityReference getEntityReference() {
      return new EntityReference()
          .withId(getId())
          .withName(getFullyQualifiedName())
          .withDescription(getDescription())
          .withDisplayName(getDisplayName())
          .withType(Entity.TEAM)
          .withHref(getHref());
    }

    @Override
    public Team getEntity() {
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
    public void setOwner(EntityReference owner) {}

    @Override
    public void setDeleted(boolean flag) {
      entity.setDeleted(flag);
    }

    @Override
    public Team withHref(URI href) {
      return entity.withHref(href);
    }

    @Override
    public ChangeDescription getChangeDescription() {
      return entity.getChangeDescription();
    }

    @Override
    public void setTags(List<TagLabel> tags) {}
  }

  /** Handles entity updated from PUT and POST operation. */
  public class TeamUpdater extends EntityUpdater {
    public TeamUpdater(Team original, Team updated, boolean patchOperation) {
      super(original, updated, patchOperation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      // Update operation can't undelete a user
      if (updated.getEntity().getDeleted() != original.getEntity().getDeleted()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Team", "deleted"));
      }
      recordChange("profile", original.getEntity().getProfile(), updated.getEntity().getProfile());
      updateUsers(original.getEntity(), updated.getEntity());
    }

    private void updateUsers(Team origTeam, Team updatedTeam) throws JsonProcessingException {
      List<EntityReference> origUsers = Optional.ofNullable(origTeam.getUsers()).orElse(Collections.emptyList());
      List<EntityReference> updatedUsers = Optional.ofNullable(updatedTeam.getUsers()).orElse(Collections.emptyList());

      List<EntityReference> added = new ArrayList<>();
      List<EntityReference> deleted = new ArrayList<>();
      if (recordListChange("users", origUsers, updatedUsers, added, deleted, entityReferenceMatch)) {
        // Remove users from original and add users from updated
        dao.relationshipDAO().deleteFrom(origTeam.getId().toString(), Relationship.HAS.ordinal(), "user");
        // Add relationships
        for (EntityReference user : updatedUsers) {
          dao.relationshipDAO()
              .insert(
                  updatedTeam.getId().toString(), user.getId().toString(), "team", "user", Relationship.HAS.ordinal());
        }

        updatedUsers.sort(EntityUtil.compareEntityReference);
        origUsers.sort(EntityUtil.compareEntityReference);
      }
    }
  }
}
