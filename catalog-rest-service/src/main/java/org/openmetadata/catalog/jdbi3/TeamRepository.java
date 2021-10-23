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
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.resources.teams.TeamResource.TeamList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.catalog.util.ResultList;

import javax.json.JsonPatch;
import java.io.IOException;
import java.io.UnsupportedEncodingException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;

public class TeamRepository extends EntityRepository<Team> {
  static final Fields TEAM_PATCH_FIELDS = new Fields(TeamResource.FIELD_LIST, "profile,users");
  private final CollectionDAO dao;

  public TeamRepository(CollectionDAO dao) {
    super(Team.class, dao.teamDAO());
    this.dao = dao;
  }

  public static List<EntityReference> toEntityReference(List<User> users) {
    if (users == null) {
      return null;
    }
    List<EntityReference> refList = new ArrayList<>();
    for (User user : users) {
      refList.add(EntityUtil.getEntityReference(user));
    }
    return refList;
  }


  @Transaction
  public Team create(Team team, List<UUID> userIds) throws IOException {
    validateRelationships(team, userIds);
    storeTeam(team, false);
    addRelationships(team);
    return team;
  }

  @Transaction
  public Team patch(String teamId, String user, JsonPatch patch) throws IOException {
    Team original = setFields(dao.teamDAO().findEntityById(teamId), TEAM_PATCH_FIELDS);
    Team updated = JsonUtils.applyPatch(original, patch, Team.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public void delete(String id) {
    // Query 1 - delete team
    if (dao.teamDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound("Team", id));
    }

    // Query 2 - Remove all relationship from and to this team
    dao.relationshipDAO().deleteAll(id);
  }

  private void validateRelationships(Team team, List<UUID> userIds) throws IOException {
    team.setUsers(validateUsers(userIds));
  }

  private void addRelationships(Team team) {
    for (EntityReference user : Optional.ofNullable(team.getUsers()).orElse(Collections.emptyList())) {
      dao.relationshipDAO().insert(team.getId().toString(), user.getId().toString(), "team", "user",
              Relationship.CONTAINS.ordinal());
    }
  }

  private void storeTeam(Team team, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = team.getUsers();

    // Don't store users, href as JSON. Build it on the fly based on relationships
    team.withUsers(null).withHref(null);

    if (update) {
      dao.teamDAO().update(team.getId().toString(), JsonUtils.pojoToJson(team));
    } else {
      dao.teamDAO().insert(JsonUtils.pojoToJson(team));
    }

    // Restore the relationships
    team.withUsers(users);
  }

  private void patch(Team original, Team updated) throws IOException {
    // Patch can't make changes to following fields. Ignore the changes
    updated.withName(original.getName()).withId(original.getId());
    validateRelationships(updated, EntityUtil.getIDList(updated.getUsers()));
    TeamRepository.TeamUpdater teamUpdater = new TeamRepository.TeamUpdater(original, updated, true);
    teamUpdater.updateAll();
    teamUpdater.store();
  }

  private List<EntityReference> validateUsers(List<UUID> userIds) throws IOException {
    if (userIds == null) {
      return null;
    }
    List<EntityReference> users = new ArrayList<>();
    for (UUID id : userIds) {
      users.add(EntityUtil.getEntityReference(dao.userDAO().findEntityById(id.toString())));
    }
    return users;
  }

  @Override
  public String getFullyQualifiedName(Team entity) {
    return entity.getName();
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
  public ResultList<Team> getResultList(List<Team> entities, String beforeCursor, String afterCursor, int total)
          throws GeneralSecurityException, UnsupportedEncodingException {
    return new TeamList(entities, beforeCursor, afterCursor, total);
  }

  private List<EntityReference> getUsers(String id) throws IOException {
    List<String> userIds = dao.relationshipDAO().findTo(id, Relationship.CONTAINS.ordinal(), "user");
    List<User> users = new ArrayList<>();
    for (String userId : userIds) {
      // TODO not clean
      users.add(JsonUtils.readValue(dao.userDAO().findJsonById(userId), User.class));
    }
    return toEntityReference(users);
  }

  private List<EntityReference> getOwns(String teamId) throws IOException {
    // Compile entities owned by the team
    return EntityUtil.getEntityReference(dao.relationshipDAO().findTo(teamId, OWNS.ordinal()), dao.tableDAO(),
            dao.databaseDAO(), dao.metricsDAO(), dao.dashboardDAO(), dao.reportDAO(),
            dao.topicDAO(), dao.chartDAO(), dao.taskDAO(), dao.modelDAO(), dao.pipelineDAO());
  }

  static class TeamEntityInterface implements EntityInterface {
    private final Team team;

    TeamEntityInterface(Team Team) {
      this.team = Team;
    }

    @Override
    public UUID getId() {
      return team.getId();
    }

    @Override
    public String getDescription() {
      return team.getDescription();
    }

    @Override
    public String getDisplayName() {
      return team.getDisplayName();
    }

    @Override
    public EntityReference getOwner() { return null; }

    @Override
    public String getFullyQualifiedName() { return team.getName(); }

    @Override
    public List<TagLabel> getTags() { return null; }

    @Override
    public void setDescription(String description) { team.setDescription(description); }

    @Override
    public void setDisplayName(String displayName) {
      team.setDisplayName(displayName);
    }

    @Override
    public void setTags(List<TagLabel> tags) { }
  }

  /**
   * Handles entity updated from PUT and POST operation.
   */
  public class TeamUpdater extends EntityUpdater {
    final Team orig;
    final Team updated;

    public TeamUpdater(Team orig, Team updated, boolean patchOperation) {
      super(new TeamRepository.TeamEntityInterface(orig), new TeamRepository.TeamEntityInterface(updated),
              patchOperation, dao.relationshipDAO(), null);
      this.orig = orig;
      this.updated = updated;
    }

    public void updateAll() throws IOException {
      // Update operation can't undelete a user
      if (updated.getDeleted() != orig.getDeleted()) {
        throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Team", "deleted"));
      }
      super.updateAll();
      updateUsers();
    }

    public void updateUsers() throws IOException {
      // TODO cleanup
      // Remove users from original and add users from updated
      dao.relationshipDAO().deleteFrom(orig.getId().toString(), Relationship.CONTAINS.ordinal(), "user");

      for (EntityReference user : Optional.ofNullable(updated.getUsers()).orElse(Collections.emptyList())) {
        dao.relationshipDAO().insert(updated.getId().toString(), user.getId().toString(),
                "team", "user", Relationship.CONTAINS.ordinal());
      }
      update("users", orig.getUsers(), updated.getUsers());
    }

    public void store() throws IOException {
      updated.setVersion(getNewVersion(orig.getVersion()));
      storeTeam(updated, true);
    }
  }
}
