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

import org.openmetadata.catalog.entity.teams.Team;
import org.openmetadata.catalog.entity.teams.User;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.EntityNotFoundException;
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.UserRepository.UserDAO;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicDAO;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.resources.teams.TeamResource;
import org.openmetadata.catalog.type.EntityReference;
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
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Collections;
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

  @Transaction
  public Team create(Team team, List<UUID> userIds) throws IOException {
    // Query 1 - Validate user IDs
    List<User> users = validateUsers(userIds);

    // Query 2 - add team into team_entity - Note that no team href or relationship attributes are stored in json
    teamDAO().insert(JsonUtils.pojoToJson(team));

    // Query 3 - Add relationship Team -- contains --> User
    for (User user : Optional.ofNullable(users).orElse(Collections.emptyList())) {
      addUserRelationship(team, user);
    }

    team.setUsers(toEntityReference(users));
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
  public List<Team> listAfter(Fields fields, int limitParam, String after) throws IOException,
          ParseException, GeneralSecurityException {
    // Forward scrolling, either because after != null or first page is being asked
    List<String> jsons = teamDAO().listAfter(limitParam, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<Team> teams = new ArrayList<>();
    for (String json : jsons) {
      teams.add(setFields(JsonUtils.readValue(json, Team.class), fields));
    }
    return teams;
  }

  @Transaction
  public List<Team> listBefore(Fields fields, int limitParam, String before) throws IOException,
          ParseException, GeneralSecurityException {
    // Reverse scrolling
    List<String> jsons = teamDAO().listBefore(limitParam, CipherText.instance().decrypt(before));

    List<Team> teams = new ArrayList<>();
    for (String json : jsons) {
      teams.add(setFields(JsonUtils.readValue(json, Team.class), fields));
    }
    return teams;
  }

  @Transaction
  public Team patch(String teamId, JsonPatch patch) throws IOException {
    Team original = setFields(EntityUtil.validate(teamId, teamDAO().findById(teamId), Team.class),
            TEAM_PATCH_FIELDS);
    Team updated = JsonUtils.applyPatch(original, patch, Team.class);
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

  private void patch(Team original, Team updated) throws IOException {
    String teamId = original.getId().toString();
    if (!updated.getId().equals(original.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Team", "id"));
    }
    if (!updated.getName().equals(original.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Team", "name"));
    }
    if (updated.getDeleted() != original.getDeleted()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("Team", "deleted"));
    }
    patchUsers(original, updated);
    LOG.info("Updated user {}", JsonUtils.pojoToJson(updated));
    List<EntityReference> newUsers = updated.getUsers();
    updated.setUsers(null);
    LOG.info("Updated user {}", JsonUtils.pojoToJson(updated));
    teamDAO().update(teamId, JsonUtils.pojoToJson(updated)); // Update the stored JSON
    updated.setUsers(newUsers);
  }

  private void patchUsers(Team original, Team updated) throws IOException {
    // Remove users from original and add users from updated
    relationshipDAO().deleteFrom(original.getId().toString(), Relationship.CONTAINS.ordinal(), "user");
    List<User> validatedUsers = new ArrayList<>();
    for (EntityReference user : Optional.ofNullable(updated.getUsers()).orElse(Collections.emptyList())) {
      String userId = user.getId().toString();
      validatedUsers.add(EntityUtil.validate(userId, userDAO().findById(userId), User.class));
      relationshipDAO().insert(updated.getId().toString(), user.getId().toString(),
              "team", "user", Relationship.CONTAINS.ordinal());
    }
    updated.setUsers(toEntityReference(validatedUsers));
  }

  private List<User> validateUsers(List<UUID> userIds) throws IOException {
    if (userIds == null) {
      return null;
    }
    List<User> users = new ArrayList<>();
    for (UUID id : userIds) {
      User user = EntityUtil.validate(id.toString(), userDAO().findById(id.toString()), User.class);
      users.add(user);
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
            metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), chartDAO());
  }

  private void addUserRelationship(Team team, User user) {
    relationshipDAO().insert(team.getId().toString(), user.getId().toString(), "team", "user",
            Relationship.CONTAINS.ordinal());
  }

  public interface TeamDAO {
    @SqlUpdate("INSERT INTO team_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM team_entity where id = :teamId")
    String findById(@Bind("teamId") String teamId);

    @SqlQuery("SELECT json FROM team_entity where name = :name")
    String findByName(@Bind("name") String name);

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
}
