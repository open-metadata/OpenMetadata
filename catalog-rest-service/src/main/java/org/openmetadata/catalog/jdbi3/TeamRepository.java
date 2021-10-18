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
import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.jdbi3.ModelRepository.ModelDAO;
import org.openmetadata.catalog.jdbi3.PipelineRepository.PipelineDAO;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.TaskRepository.TaskDAO;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.resources.teams.TeamResource.TeamList;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.TagLabel;
import org.openmetadata.catalog.util.EntityInterface;
import org.openmetadata.catalog.util.EntityUpdater;
import org.openmetadata.catalog.util.EntityUtil;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.JsonUtils;
import org.openmetadata.common.utils.CipherText;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.json.JsonPatch;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Date;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;

public abstract class TeamRepository {
  private static final Logger LOG = LoggerFactory.getLogger(TeamResource.class);
  static final Fields TEAM_PATCH_FIELDS = new Fields(TeamResource.FIELD_LIST, "profile,users");

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

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract TableDAO tableDAO();

  @CreateSqlObject
  abstract DatabaseDAO databaseDAO();

  @CreateSqlObject
  abstract MetricsDAO metricsDAO();

  @CreateSqlObject
  abstract DashboardDAO dashboardDAO();

  @CreateSqlObject
  abstract ReportDAO reportDAO();

  @CreateSqlObject
  abstract TopicDAO topicDAO();

  @CreateSqlObject
  abstract ChartDAO chartDAO();

  @CreateSqlObject
  abstract TaskDAO taskDAO();

  @CreateSqlObject
  abstract PipelineDAO pipelineDAO();

  @CreateSqlObject
  abstract ModelDAO modelDAO();

  @Transaction
  public Team create(Team team, List<UUID> userIds) throws IOException {
    validateRelationships(team, userIds);
    storeTeam(team, false);
    addRelationships(team);
    return team;
  }

  @Transaction
  public Team get(String id, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(id, teamDAO().findById(id), Team.class), fields);
  }

  @Transaction
  public Team getByName(String name, Fields fields) throws IOException {
    return setFields(EntityUtil.validate(name, teamDAO().findByName(name), Team.class), fields);
  }

  @Transaction
  public TeamList listAfter(Fields fields, int limitParam, String after) throws IOException, GeneralSecurityException {
    // Forward scrolling, either because after != null or first page is being asked
    List<String> jsons = teamDAO().listAfter(limitParam + 1, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Team> teams = new ArrayList<>();
    for (String json : jsons) {
      teams.add(setFields(JsonUtils.readValue(json, Team.class), fields));
    }

    int total = teamDAO().listCount();

    String beforeCursor, afterCursor = null;
    beforeCursor = after == null ? null : teams.get(0).getName();
    if (teams.size() > limitParam) {
      teams.remove(limitParam);
      afterCursor = teams.get(limitParam - 1).getName();
    }
    return new TeamList(teams, beforeCursor, afterCursor, total);
  }

  @Transaction
  public TeamList listBefore(Fields fields, int limitParam, String before) throws IOException, GeneralSecurityException {
    // Reverse scrolling
    List<String> jsons = teamDAO().listBefore(limitParam + 1, CipherText.instance().decrypt(before));

    List<Team> teams = new ArrayList<>();
    for (String json : jsons) {
      teams.add(setFields(JsonUtils.readValue(json, Team.class), fields));
    }
    int total = teamDAO().listCount();

    String beforeCursor = null, afterCursor;
    if (teams.size() > limitParam) {
      teams.remove(0);
      beforeCursor = teams.get(0).getName();
    }
    afterCursor = teams.get(teams.size() - 1).getName();
    return new TeamList(teams, beforeCursor, afterCursor, total);
  }

  @Transaction
  public Team patch(String teamId, String user, JsonPatch patch) throws IOException {
    Team original = setFields(EntityUtil.validate(teamId, teamDAO().findById(teamId), Team.class),
            TEAM_PATCH_FIELDS);
    Team updated = JsonUtils.applyPatch(original, patch, Team.class);
    updated.withUpdatedBy(user).withUpdatedAt(new Date());
    patch(original, updated);
    return updated;
  }

  @Transaction
  public void delete(String id) {
    // Query 1 - delete team
    if (teamDAO().delete(id) <= 0) {
      throw EntityNotFoundException.byMessage(CatalogExceptionMessage.entityNotFound("Team", id));
    }

    // Query 2 - Remove all relationship from and to this team
    relationshipDAO().deleteAll(id);
  }

  private void validateRelationships(Team team, List<UUID> userIds) throws IOException {
    team.setUsers(validateUsers(userIds));
  }

  private void addRelationships(Team team) {
    for (EntityReference user : Optional.ofNullable(team.getUsers()).orElse(Collections.emptyList())) {
      relationshipDAO().insert(team.getId().toString(), user.getId().toString(), "team", "user",
              Relationship.CONTAINS.ordinal());
    }
  }

  private void storeTeam(Team team, boolean update) throws JsonProcessingException {
    // Relationships and fields such as href are derived and not stored as part of json
    List<EntityReference> users = team.getUsers();

    // Don't store users, href as JSON. Build it on the fly based on relationships
    team.withUsers(null).withHref(null);

    if (update) {
      teamDAO().update(team.getId().toString(), JsonUtils.pojoToJson(team));
    } else {
      teamDAO().insert(JsonUtils.pojoToJson(team));
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
      users.add(EntityUtil.getEntityReference(EntityUtil.validate(id.toString(), userDAO().findById(id.toString()),
              User.class)));
    }
    return users;
  }

  private Team setFields(Team team, Fields fields) throws IOException {
    if (!fields.contains("profile")) {
      team.setProfile(null);
    }
    team.setUsers(fields.contains("users") ? getUsers(team.getId().toString()) : null);
    team.setOwns(fields.contains("owns") ? getOwns(team.getId().toString()) : null);
    return team;
  }

  private List<EntityReference> getUsers(String id) throws IOException {
    List<String> userIds = relationshipDAO().findTo(id, Relationship.CONTAINS.ordinal(), "user");
    List<User> users = new ArrayList<>();
    for (String userId : userIds) {
      users.add(JsonUtils.readValue(userDAO().findById(userId), User.class));
    }
    return toEntityReference(users);
  }

  private List<EntityReference> getOwns(String teamId) throws IOException {
    // Compile entities owned by the team
    return EntityUtil.getEntityReference(relationshipDAO().findTo(teamId, OWNS.ordinal()), tableDAO(), databaseDAO(),
            metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), chartDAO(), taskDAO(), modelDAO(), pipelineDAO());
  }

  public interface TeamDAO {
    @SqlUpdate("INSERT INTO team_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM team_entity where id = :teamId")
    String findById(@Bind("teamId") String teamId);

    @SqlQuery("SELECT json FROM team_entity where name = :name")
    String findByName(@Bind("name") String name);

    @SqlQuery("SELECT count(*) FROM team_entity")
    int listCount();

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT name, json FROM team_entity WHERE " +
                    "name < :before " + // Pagination by team name
                    "ORDER BY name DESC " + // Pagination ordering by team name
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY name")
    List<String> listBefore(@Bind("limit") int limit, @Bind("before") String before);

    @SqlQuery("SELECT json FROM team_entity WHERE " +
            "name > :after " + // Pagination by team name
            "ORDER BY name " + // Pagination ordering by team name
            "LIMIT :limit")
    List<String> listAfter(@Bind("limit") int limit, @Bind("after") String after);

    @SqlUpdate("DELETE FROM team_entity WHERE id = :teamId")
    int delete(@Bind("teamId") String teamId);

    @SqlUpdate("UPDATE team_entity SET json = :json WHERE id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);
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
    public String getFullyQualifiedName() { return null; }

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
      super(new TeamRepository.TeamEntityInterface(orig), new TeamRepository.TeamEntityInterface(updated), patchOperation, relationshipDAO(),
              null);
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
      relationshipDAO().deleteFrom(orig.getId().toString(), Relationship.CONTAINS.ordinal(), "user");

      for (EntityReference user : Optional.ofNullable(updated.getUsers()).orElse(Collections.emptyList())) {
        relationshipDAO().insert(updated.getId().toString(), user.getId().toString(),
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
