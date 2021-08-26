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
import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.TeamRepository.TeamDAO;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicDAO;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.resources.teams.UserResource;
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

import static org.openmetadata.catalog.jdbi3.Relationship.CONTAINS;
import static org.openmetadata.catalog.jdbi3.Relationship.FOLLOWS;
import static org.openmetadata.catalog.jdbi3.Relationship.OWNS;

public abstract class UserRepository {
  public static final Logger LOG = LoggerFactory.getLogger(UserRepository.class);
  static final Fields USER_PATCH_FIELDS = new Fields(UserResource.FIELD_LIST, "profile,teams");

  public static List<EntityReference> toEntityReference(List<Team> teams) {
    if (teams == null) {
      return null;
    }
    List<EntityReference> refList = new ArrayList<>();
    for (Team team : teams) {
      refList.add(EntityUtil.getEntityReference(team));
    }
    return refList;
  }

  @CreateSqlObject
  abstract UserDAO userDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();

  @CreateSqlObject
  abstract TeamDAO teamDAO();

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
  public List<User> listAfter(Fields fields, int limitParam, String after) throws IOException,
          ParseException, GeneralSecurityException {
    // Forward scrolling, either because after != null or first page is being asked
    List<String> jsons = userDAO().listAfter(limitParam, after == null ? "" :
            CipherText.instance().decrypt(after));

    List<User> users = new ArrayList<>();
    for (String json : jsons) {
      users.add(setFields(JsonUtils.readValue(json, User.class), fields));
    }
    return users;
  }

  @Transaction
  public List<User> listBefore(Fields fields, int limitParam, String before) throws IOException,
          ParseException, GeneralSecurityException {
    // Reverse scrolling
    List<String> jsons = userDAO().listBefore(limitParam, CipherText.instance().decrypt(before));

    List<User> users = new ArrayList<>();
    for (String json : jsons) {
      users.add(setFields(JsonUtils.readValue(json, User.class), fields));
    }
    return users;
  }

  @Transaction
  public User get(String id) throws IOException {
    return validateUser(id);
  }

  @Transaction
  public User get(String id, Fields fields) throws IOException {
    // Query 1 - get user for given user name
    return setFields(validateUser(id), fields);
  }

  @Transaction
  public User getByName(String name, Fields fields) throws IOException {
    User user = EntityUtil.validate(name, userDAO().findByName(name), User.class);
    return setFields(user, fields);
  }

  @Transaction
  public User getByEmail(String email, Fields fields) throws IOException {
    User user = EntityUtil.validate(email, userDAO().findByEmail(email), User.class);
    return setFields(user, fields);
  }

  @Transaction
  public User create(User user, List<UUID> teamIds) throws IOException {
    List<Team> teams = validateTeams(teamIds);
    userDAO().insert(JsonUtils.pojoToJson(user));
    assignTeams(user, teams);
    List<EntityReference> entityRefs = toEntityReference(teams);
    user.setTeams(entityRefs.isEmpty() ? null : entityRefs);
    return user;
  }

  @Transaction
  public void delete(String id) throws IOException {
    // Query - mark user as deactivated
    User user = markUserAsDeactivated(id);

    // Remove relationship membership to teams
    relationshipDAO().deleteTo(user.getId().toString(), CONTAINS.ordinal(), "team");

    // Remove follows relationship to entities
    relationshipDAO().deleteFrom(id, FOLLOWS.ordinal());
  }

  @Transaction
  public User patch(String id, JsonPatch patch) throws IOException {
    User original = setFields(validateUser(id), USER_PATCH_FIELDS); // Query 1 - find user by Id
    JsonUtils.getJsonStructure(original);
    User updated = JsonUtils.applyPatch(original, patch, User.class);
    patch(original, updated);
    return updated;
  }

  private void patch(User original, User updated) throws IOException {
    String userId = original.getId().toString();
    if (!updated.getId().equals(original.getId())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("User", "id"));
    }
    if (!updated.getName().equals(original.getName())) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("User", "name"));
    }
    if (updated.getDeactivated() != original.getDeactivated()) {
      throw new IllegalArgumentException(CatalogExceptionMessage.readOnlyAttribute("User", "deactivated"));
    }
    patchTeams(original, updated);
    List<EntityReference> newTeams = updated.getTeams();
    updated.setTeams(null);
    userDAO().update(userId, JsonUtils.pojoToJson(updated)); // Update the stored JSON
    updated.setTeams(newTeams);
  }

  private User setFields(User user, Fields fields) throws IOException {
    user.setProfile(fields.contains("profile") ? user.getProfile() : null);
    user.setTeams(fields.contains("teams") ? getTeams(user) : null);
    user.setOwns(fields.contains("owns") ? getOwns(user) : null);
    user.setFollows(fields.contains("follows") ? getFollows(user) : null);
    return user;
  }

  private List<EntityReference> getOwns(User user) throws IOException {
    // Compile entities owned by the user
    List<EntityReference> ownedEntities = relationshipDAO().findTo(user.getId().toString(), OWNS.ordinal());

    // Compile entities owned by the team the user belongs to
    List<EntityReference> teams = user.getTeams() == null ? getTeams(user) : user.getTeams();
    for (EntityReference team : teams) {
      ownedEntities.addAll(relationshipDAO().findTo(team.getId().toString(), OWNS.ordinal()));
    }
    // Populate details in entity reference
    return EntityUtil.getEntityReference(ownedEntities, tableDAO(), databaseDAO(), metricsDAO(), dashboardDAO(),
            reportDAO(), topicDAO(), chartDAO());
  }

  private List<EntityReference> getFollows(User user) throws IOException {
    return EntityUtil.getEntityReference(relationshipDAO().findTo(user.getId().toString(), FOLLOWS.ordinal()),
            tableDAO(), databaseDAO(), metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), chartDAO());
  }

  private void patchTeams(User original, User updated) throws IOException {
    // Remove teams from original and add teams from updated
    relationshipDAO().deleteTo(original.getId().toString(), CONTAINS.ordinal(), "team");
    List<EntityReference> validatedTeams = new ArrayList<>();
    for (EntityReference team : Optional.ofNullable(updated.getTeams()).orElse(Collections.emptyList())) {
      String teamId = team.getId().toString();
      EntityReference ref = EntityUtil.getEntityReference(EntityUtil.validate(teamId,
              teamDAO().findById(teamId), Team.class));
      validatedTeams.add(ref);
      relationshipDAO().insert(team.getId().toString(), updated.getId().toString(),
              "team", "user", CONTAINS.ordinal());
    }
    updated.setTeams(validatedTeams);
  }

  private User validateUser(String userId) throws IOException {
    return EntityUtil.validate(userId, userDAO().findById(userId), User.class);
  }


  private List<Team> validateTeams(List<UUID> teamIds) throws IOException {
    if (teamIds == null) {
      return Collections.emptyList(); // Return empty team list
    }
    List<Team> validatedTeams = new ArrayList<>();
    for (UUID teamId : teamIds) {
      validatedTeams.add(EntityUtil.validate(teamId.toString(), teamDAO().findById(teamId.toString()), Team.class));
    }
    return validatedTeams;
  }

  /* Add all the teams that user belongs to to User entity */
  private List<EntityReference> getTeams(User user) throws IOException {
    List<String> teamIds = relationshipDAO().findFrom(user.getId().toString(), CONTAINS.ordinal(), "team");
    List<Team> teams = new ArrayList<>();
    for (String teamId : teamIds) {
      LOG.debug("Adding team {}", teamId);
      String json = teamDAO().findById(teamId);
      Team team = JsonUtils.readValue(json, Team.class);
      if (team != null) {
        teams.add(team);
      }
    }
    return toEntityReference(teams);
  }

  private void assignTeams(User user, List<Team> teams) {
    // Query - add team to the user
    for (Team team : teams) {
      relationshipDAO().insert(team.getId().toString(), user.getId().toString(),
              "team", "user", CONTAINS.ordinal());
    }
  }

  private User markUserAsDeactivated(String id) throws IOException {
    User user = validateUser(id);
    if (Optional.ofNullable(user.getDeactivated()).orElse(false)) {
      // User is already deactivated
      return user;
    }
    user.setDeactivated(true);
    user.setName("deactivated." +user.getName());
    user.setDisplayName("Deactivated " +user.getDisplayName());
    userDAO().update(id, JsonUtils.pojoToJson(user));
    return user;
  }

  public interface UserDAO {
    @SqlUpdate("INSERT INTO user_entity (json) VALUES (:json)")
    void insert(@Bind("json") String json);

    @SqlQuery("SELECT json FROM user_entity WHERE id = :id")
    String findById(@Bind("id") String id);

    @SqlQuery("SELECT json FROM user_entity WHERE name = :name")
    String findByName(@Bind("name") String name);

    @SqlQuery("SELECT json FROM user_entity WHERE email = :email")
    String findByEmail(@Bind("email") String email);

    @SqlQuery("SELECT json FROM user_entity")
    List<String> list();

    @SqlQuery(
            "SELECT json FROM (" +
                    "SELECT name, json FROM user_entity WHERE " +
                    "name < :before " + // Pagination by user name
                    "ORDER BY name DESC " + // Pagination ordering by user name
                    "LIMIT :limit" +
                    ") last_rows_subquery ORDER BY name")
    List<String> listBefore(@Bind("limit") int limit, @Bind("before") String before);

    @SqlQuery("SELECT json FROM user_entity WHERE " +
            "name > :after " + // Pagination by user name
            "ORDER BY name " + // Pagination ordering by user name
            "LIMIT :limit")
    List<String> listAfter(@Bind("limit") int limit, @Bind("after") String after);

    @SqlUpdate("UPDATE user_entity SET json = :json WHERE id = :id")
    void update(@Bind("id") String id, @Bind("json") String json);

    @SqlQuery("SELECT EXISTS (SELECT * FROM user_entity where id = :id)")
    boolean exists(@Bind("id") String id);
  }
}
