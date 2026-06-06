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

package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.ORGANIZATION_NAME;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.MYSQL;
import static org.openmetadata.service.jdbi3.locator.ConnectionType.POSTGRES;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Collections;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.CreateSqlObject;
import org.jdbi.v3.sqlobject.config.RegisterRowMapper;
import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.BindList;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.events.FailedEvent;
import org.openmetadata.schema.entity.events.FailedEventResponse;
import org.openmetadata.schema.entity.teams.Persona;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.UsageStats;
import org.openmetadata.schema.utils.EntityInterfaceUtil;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.AccessControlDAOs.UsageDAO.UsageDetailsMapper;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlBatch;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlQuery;
import org.openmetadata.service.jdbi3.locator.ConnectionAwareSqlUpdate;
import org.openmetadata.service.resources.events.subscription.TypedEvent;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.jdbi.BindFQN;
import org.openmetadata.service.util.jdbi.BindUUID;

public interface AccessControlDAOs {
  @CreateSqlObject
  RoleDAO roleDAO();

  @CreateSqlObject
  UserDAO userDAO();

  @CreateSqlObject
  TeamDAO teamDAO();

  @CreateSqlObject
  PersonaDAO personaDAO();

  @CreateSqlObject
  UsageDAO usageDAO();

  @CreateSqlObject
  TopicDAO topicDAO();

  @CreateSqlObject
  ChangeEventDAO changeEventDAO();

  @CreateSqlObject
  TypeEntityDAO typeEntityDAO();

  interface RoleDAO extends EntityDAO<Role> {
    @Override
    default String getTableName() {
      return "role_entity";
    }

    @Override
    default Class<Role> getEntityClass() {
      return Role.class;
    }
  }

  interface PersonaDAO extends EntityDAO<Persona> {
    @Override
    default String getTableName() {
      return "persona_entity";
    }

    @Override
    default Class<Persona> getEntityClass() {
      return Persona.class;
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM persona_entity WHERE JSON_EXTRACT(json, '$.default') = true LIMIT 1",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT json FROM persona_entity WHERE json->>'default' = 'true' LIMIT 1",
        connectionType = POSTGRES)
    String findDefaultPersona();

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id FROM persona_entity WHERE JSON_EXTRACT(json, '$.default') = true AND id != :excludeId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id FROM persona_entity WHERE json->>'default' = 'true' AND id != :excludeId",
        connectionType = POSTGRES)
    List<String> findOtherDefaultPersonaIds(@Bind("excludeId") String excludeId);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, JSON_UNQUOTE(JSON_EXTRACT(json, '$.fullyQualifiedName')) AS fqn "
                + "FROM persona_entity "
                + "WHERE JSON_EXTRACT(json, '$.default') = true AND id != :excludeId",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, json->>'fullyQualifiedName' AS fqn FROM persona_entity "
                + "WHERE json->>'default' = 'true' AND id != :excludeId",
        connectionType = POSTGRES)
    @RegisterRowMapper(EntityDAO.EntityIdFqnPairMapper.class)
    List<EntityDAO.EntityIdFqnPair> findOtherDefaultPersonaIdsWithFqn(
        @Bind("excludeId") String excludeId);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE persona_entity SET json = JSON_SET(json, '$.default', false) WHERE JSON_EXTRACT(json, '$.default') = true AND id != :excludeId",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE persona_entity SET json = jsonb_set(json, '{default}', 'false') WHERE json->>'default' = 'true' AND id != :excludeId",
        connectionType = POSTGRES)
    void unsetOtherDefaultPersonas(@Bind("excludeId") String excludeId);
  }

  interface TeamDAO extends EntityDAO<Team> {
    @Override
    default String getTableName() {
      return "team_entity";
    }

    @Override
    default Class<Team> getEntityClass() {
      return Team.class;
    }

    @Override
    default int listCount(ListFilter filter) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam, Include.ALL);
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the teams without parents should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = :isJoinable ", mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = :isJoinable ", postgresCondition);
      }

      return listCount(
          getTableName(),
          getNameHashColumn(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition);
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam, Include.ALL);
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the parentless teams should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = :isJoinable ", mySqlCondition);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = :isJoinable ", postgresCondition);
      }

      // Quoted name is stored in fullyQualifiedName column and not in the name column
      beforeName =
          Optional.ofNullable(beforeName).map(FullyQualifiedName::unquoteName).orElse(null);
      return listBefore(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          beforeName,
          beforeId);
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String parentTeam = filter.getQueryParam("parentTeam");
      String isJoinable = filter.getQueryParam("isJoinable");
      String condition = filter.getCondition();
      if (parentTeam != null) {
        // validate parent team
        Team team = findEntityByName(parentTeam, Include.ALL);
        if (ORGANIZATION_NAME.equals(team.getName())) {
          // All the parentless teams should come under "organization" team
          condition =
              String.format(
                  "%s AND id NOT IN ( (SELECT '%s') UNION (SELECT toId FROM entity_relationship WHERE fromId!='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d) )",
                  condition, team.getId(), team.getId(), Relationship.PARENT_OF.ordinal());
        } else {
          condition =
              String.format(
                  "%s AND id IN (SELECT toId FROM entity_relationship WHERE fromId='%s' AND fromEntity='team' AND toEntity='team' AND relation=%d)",
                  condition, team.getId(), Relationship.PARENT_OF.ordinal());
        }
      }
      String mySqlCondition = condition;
      String postgresCondition = condition;
      if (isJoinable != null) {
        mySqlCondition =
            String.format(
                "%s AND JSON_EXTRACT(json, '$.isJoinable') = %s ", mySqlCondition, isJoinable);
        postgresCondition =
            String.format(
                "%s AND ((json#>'{isJoinable}')::boolean)  = %s ", postgresCondition, isJoinable);
      }

      // Quoted name is stored in fullyQualifiedName column and not in the name column
      afterName = Optional.ofNullable(afterName).map(FullyQualifiedName::unquoteName).orElse(null);
      return listAfter(
          getTableName(),
          filter.getQueryParams(),
          mySqlCondition,
          postgresCondition,
          limit,
          afterName,
          afterId);
    }

    default List<String> listTeamsUnderOrganization(UUID teamId) {
      return listTeamsUnderOrganization(teamId, Relationship.PARENT_OF.ordinal());
    }

    @SqlQuery(
        "SELECT te.id "
            + "FROM team_entity te "
            + "WHERE te.id NOT IN ((SELECT :teamId) UNION "
            + "(SELECT toId FROM entity_relationship "
            + "WHERE fromId != :teamId AND fromEntity = 'team' AND relation = :relation AND toEntity = 'team'))")
    List<String> listTeamsUnderOrganization(
        @BindUUID("teamId") UUID teamId, @Bind("relation") int relation);
  }

  interface TopicDAO extends EntityDAO<Topic> {
    @Override
    default String getTableName() {
      return "topic_entity";
    }

    @Override
    default Class<Topic> getEntityClass() {
      return Topic.class;
    }

    @Override
    default String getNameHashColumn() {
      return "fqnHash";
    }
  }

  @RegisterRowMapper(UsageDetailsMapper.class)
  interface UsageDAO {
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT :date, :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 6 DAY)), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 29 DAY))"
                + "ON DUPLICATE KEY UPDATE count7 = count7 - count1 + :count1, count30 = count30 - count1 + :count1, count1 = :count1",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT (:date :: date), :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '6 days')), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '29 days'))"
                + "ON CONFLICT (usageDate, id) DO UPDATE SET count7 = entity_usage.count7 - entity_usage.count1 + :count1,"
                + "count30 = entity_usage.count30 - entity_usage.count1 + :count1, count1 = :count1",
        connectionType = POSTGRES)
    void insertOrReplaceCount(
        @Bind("date") String date,
        @BindUUID("id") UUID id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT :date, :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 6 DAY)), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - "
                + "INTERVAL 29 DAY)) "
                + "ON DUPLICATE KEY UPDATE count1 = count1 + :count1, count7 = count7 + :count1, count30 = count30 + :count1",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) "
                + "SELECT (:date :: date), :id, :entityType, :count1, "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '6 days')), "
                + "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= (:date :: date) - INTERVAL '29 days')) "
                + "ON CONFLICT (usageDate, id) DO UPDATE SET count1 = entity_usage.count1 + :count1, count7 = entity_usage.count7 + :count1, count30 = entity_usage.count30 + :count1",
        connectionType = POSTGRES)
    void insertOrUpdateCount(
        @Bind("date") String date,
        @BindUUID("id") UUID id,
        @Bind("entityType") String entityType,
        @Bind("count1") int count1);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, usageDate, entityType, count1, count7, count30, "
                + "percentile1, percentile7, percentile30 FROM entity_usage "
                + "WHERE id = :id AND usageDate >= :date - INTERVAL :days DAY AND usageDate <= :date ORDER BY usageDate DESC",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT id, usageDate, entityType, count1, count7, count30, "
                + "percentile1, percentile7, percentile30 FROM entity_usage "
                + "WHERE id = :id AND usageDate >= (:date :: date) - make_interval(days => :days) AND usageDate <= (:date :: date) ORDER BY usageDate DESC",
        connectionType = POSTGRES)
    List<UsageDetails> getUsageById(
        @BindUUID("id") UUID id, @Bind("date") String date, @Bind("days") int days);

    /** Get latest usage record */
    @SqlQuery(
        "SELECT id, usageDate, entityType, count1, count7, count30, "
            + "percentile1, percentile7, percentile30 FROM entity_usage "
            + "WHERE usageDate IN (SELECT MAX(usageDate) FROM entity_usage WHERE id = :id) AND id = :id")
    UsageDetails getLatestUsage(@Bind("id") String id);

    /** Get latest usage records for multiple entities in one query */
    @RegisterRowMapper(UsageDetailsWithIdMapper.class)
    @SqlQuery(
        "SELECT u1.id, u1.usageDate, u1.entityType, u1.count1, u1.count7, u1.count30, "
            + "u1.percentile1, u1.percentile7, u1.percentile30 FROM entity_usage u1 "
            + "INNER JOIN (SELECT id, MAX(usageDate) as maxDate FROM entity_usage WHERE id IN (<ids>) GROUP BY id) u2 "
            + "ON u1.id = u2.id AND u1.usageDate = u2.maxDate")
    List<UsageDetailsWithId> getLatestUsageBatch(@BindList("ids") List<String> ids);

    @SqlUpdate("DELETE FROM entity_usage WHERE id = :id")
    void delete(@BindUUID("id") UUID id);

    /**
     * TODO: Not sure I get what the next comment means, but tests now use mysql 8 so maybe tests can be improved here
     * Note not using in following percentile computation PERCENT_RANK function as unit tests use mysql5.7, and it does
     * not have window function
     */
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE entity_usage u JOIN ( "
                + "SELECT u1.id, "
                + "(SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 <  u1.count1 AND u2.entityType = :entityType "
                + "AND u2.usageDate = :date) as p1, "
                + "(SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 <  u1.count7 AND u3.entityType = :entityType "
                + "AND u3.usageDate = :date) as p7, "
                + "(SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 <  u1.count30 AND u4.entityType = :entityType "
                + "AND u4.usageDate = :date) as p30, "
                + "(SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = :date) as total "
                + "FROM entity_usage u1 WHERE u1.entityType = :entityType AND u1.usageDate = :date"
                + ") vals ON u.id = vals.id AND usageDate = :date "
                + "SET u.percentile1 = ROUND(100 * p1/total, 2), u.percentile7 = ROUND(p7 * 100/total, 2), u.percentile30 ="
                + " ROUND(p30*100/total, 2)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE entity_usage u "
                + "SET percentile1 = ROUND(100 * p1 / total, 2), percentile7 = ROUND(p7 * 100 / total, 2), percentile30 = ROUND(p30 * 100 / total, 2) "
                + "FROM ("
                + "   SELECT u1.id, "
                + "       (SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 < u1.count1 AND u2.entityType = :entityType AND u2.usageDate = (:date :: date)) as p1, "
                + "       (SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 < u1.count7 AND u3.entityType = :entityType AND u3.usageDate = (:date :: date)) as p7, "
                + "       (SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 < u1.count30 AND u4.entityType = :entityType AND u4.usageDate = (:date :: date)) as p30, "
                + "       (SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = (:date :: date)"
                + "   ) as total FROM entity_usage u1 "
                + "   WHERE u1.entityType = :entityType AND u1.usageDate = (:date :: date)"
                + ") vals "
                + "WHERE u.id = vals.id AND usageDate = (:date :: date);",
        connectionType = POSTGRES)
    void computePercentile(@Bind("entityType") String entityType, @Bind("date") String date);

    class UsageDetailsMapper implements RowMapper<UsageDetails> {
      @Override
      public UsageDetails map(ResultSet r, StatementContext ctx) throws SQLException {
        UsageStats dailyStats =
            new UsageStats()
                .withCount(r.getInt("count1"))
                .withPercentileRank(r.getDouble("percentile1"));
        UsageStats weeklyStats =
            new UsageStats()
                .withCount(r.getInt("count7"))
                .withPercentileRank(r.getDouble("percentile7"));
        UsageStats monthlyStats =
            new UsageStats()
                .withCount(r.getInt("count30"))
                .withPercentileRank(r.getDouble("percentile30"));
        java.sql.Date usageDate = r.getDate("usageDate");
        return new UsageDetails()
            .withDate(usageDate != null ? usageDate.toString() : null)
            .withDailyStats(dailyStats)
            .withWeeklyStats(weeklyStats)
            .withMonthlyStats(monthlyStats);
      }
    }

    /** Usage details with entity ID for batch operations */
    class UsageDetailsWithId {
      private final String entityId;
      private final UsageDetails usageDetails;

      public UsageDetailsWithId(String entityId, UsageDetails usageDetails) {
        this.entityId = entityId;
        this.usageDetails = usageDetails;
      }

      public String getEntityId() {
        return entityId;
      }

      public UsageDetails getUsageDetails() {
        return usageDetails;
      }
    }

    class UsageDetailsWithIdMapper implements RowMapper<UsageDetailsWithId> {
      @Override
      public UsageDetailsWithId map(ResultSet r, StatementContext ctx) throws SQLException {
        String entityId = r.getString("id");
        UsageStats dailyStats =
            new UsageStats()
                .withCount(r.getInt("count1"))
                .withPercentileRank(r.getDouble("percentile1"));
        UsageStats weeklyStats =
            new UsageStats()
                .withCount(r.getInt("count7"))
                .withPercentileRank(r.getDouble("percentile7"));
        UsageStats monthlyStats =
            new UsageStats()
                .withCount(r.getInt("count30"))
                .withPercentileRank(r.getDouble("percentile30"));
        java.sql.Date usageDate = r.getDate("usageDate");
        UsageDetails usageDetails =
            new UsageDetails()
                .withDate(usageDate != null ? usageDate.toString() : null)
                .withDailyStats(dailyStats)
                .withWeeklyStats(weeklyStats)
                .withMonthlyStats(monthlyStats);
        return new UsageDetailsWithId(entityId, usageDetails);
      }
    }
  }

  interface UserDAO extends EntityDAO<User> {
    @Override
    default String getTableName() {
      return "user_entity";
    }

    @Override
    default Class<User> getEntityClass() {
      return User.class;
    }

    @Override
    default int listCount(ListFilter filter) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String lastLoginTimeGreaterThan = filter.getQueryParam("lastLoginTimeGreaterThan");
      String lastActivityTimeGreaterThan = filter.getQueryParam("lastActivityTimeGreaterThan");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean)  = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND ue.isBot = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = TRUE ", postgresCondition);
        } else {
          mySqlCondition = String.format("%s AND ue.isBot = FALSE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = FALSE ", postgresCondition);
        }
      }
      if (lastLoginTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", mySqlCondition, lastLoginTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", postgresCondition, lastLoginTimeGreaterThan);
      }
      if (lastActivityTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                mySqlCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                postgresCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
      }
      if (team == null
          && isAdminStr == null
          && isBotStr == null
          && lastLoginTimeGreaterThan == null
          && lastActivityTimeGreaterThan == null) {
        return EntityDAO.super.listCount(filter);
      }
      return listCount(
          getTableName(), mySqlCondition, postgresCondition, team, Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listBefore(
        ListFilter filter, int limit, String beforeName, String beforeId) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String lastLoginTimeGreaterThan = filter.getQueryParam("lastLoginTimeGreaterThan");
      String lastActivityTimeGreaterThan = filter.getQueryParam("lastActivityTimeGreaterThan");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND ue.isBot = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = TRUE ", postgresCondition);
        } else {
          mySqlCondition = String.format("%s AND ue.isBot = FALSE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = FALSE ", postgresCondition);
        }
      }
      if (lastLoginTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", mySqlCondition, lastLoginTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", postgresCondition, lastLoginTimeGreaterThan);
      }
      if (lastActivityTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                mySqlCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                postgresCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
      }
      if (team == null
          && isAdminStr == null
          && isBotStr == null
          && lastLoginTimeGreaterThan == null
          && lastActivityTimeGreaterThan == null) {
        return EntityDAO.super.listBefore(filter, limit, beforeName, beforeId);
      }
      return listBefore(
          getTableName(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          beforeName,
          beforeId,
          Relationship.HAS.ordinal());
    }

    @Override
    default List<String> listAfter(ListFilter filter, int limit, String afterName, String afterId) {
      String team = EntityInterfaceUtil.quoteName(filter.getQueryParam("team"));
      String isBotStr = filter.getQueryParam("isBot");
      String isAdminStr = filter.getQueryParam("isAdmin");
      String lastLoginTimeGreaterThan = filter.getQueryParam("lastLoginTimeGreaterThan");
      String lastActivityTimeGreaterThan = filter.getQueryParam("lastActivityTimeGreaterThan");
      String mySqlCondition = filter.getCondition("ue");
      String postgresCondition = filter.getCondition("ue");
      if (isAdminStr != null) {
        boolean isAdmin = Boolean.parseBoolean(isAdminStr);
        if (isAdmin) {
          mySqlCondition =
              String.format("%s AND JSON_EXTRACT(ue.json, '$.isAdmin') = TRUE ", mySqlCondition);
          postgresCondition =
              String.format("%s AND ((ue.json#>'{isAdmin}')::boolean) = TRUE ", postgresCondition);
        } else {
          mySqlCondition =
              String.format(
                  "%s AND (JSON_EXTRACT(ue.json, '$.isAdmin') IS NULL OR JSON_EXTRACT(ue.json, '$.isAdmin') = FALSE ) ",
                  mySqlCondition);
          postgresCondition =
              String.format(
                  "%s AND (ue.json#>'{isAdmin}' IS NULL OR ((ue.json#>'{isAdmin}')::boolean) = FALSE ) ",
                  postgresCondition);
        }
      }
      if (isBotStr != null) {
        boolean isBot = Boolean.parseBoolean(isBotStr);
        if (isBot) {
          mySqlCondition = String.format("%s AND ue.isBot = TRUE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = TRUE ", postgresCondition);
        } else {
          mySqlCondition = String.format("%s AND ue.isBot = FALSE ", mySqlCondition);
          postgresCondition = String.format("%s AND ue.isBot = FALSE ", postgresCondition);
        }
      }
      if (lastLoginTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", mySqlCondition, lastLoginTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ue.lastLoginTime > %s ", postgresCondition, lastLoginTimeGreaterThan);
      }
      if (lastActivityTimeGreaterThan != null) {
        mySqlCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                mySqlCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
        postgresCondition =
            String.format(
                "%s AND ((ue.lastActivityTime IS NOT NULL AND ue.lastActivityTime > %s) OR (ue.lastLoginTime IS NOT NULL AND ue.lastLoginTime > %s)) ",
                postgresCondition, lastActivityTimeGreaterThan, lastActivityTimeGreaterThan);
      }
      if (team == null
          && isAdminStr == null
          && isBotStr == null
          && lastLoginTimeGreaterThan == null
          && lastActivityTimeGreaterThan == null) {
        return EntityDAO.super.listAfter(filter, limit, afterName, afterId);
      }
      return listAfter(
          getTableName(),
          mySqlCondition,
          postgresCondition,
          team,
          limit,
          afterName,
          afterId,
          Relationship.HAS.ordinal());
    }

    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM ("
                + "SELECT ue.id "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + " AND (:team IS NULL OR te.nameHash = :team) "
                + "GROUP BY ue.id) subquery",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT count(id) FROM ("
                + "SELECT ue.id "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + " AND (:team IS NULL OR te.nameHash = :team) "
                + "GROUP BY ue.id) subquery",
        connectionType = POSTGRES)
    int listCount(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.name, ue.id, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name < :beforeName OR (ue.name = :beforeName AND ue.id < :beforeId)) "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name DESC,ue.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json FROM ("
                + "SELECT ue.name, ue.id, ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name < :beforeName OR (ue.name = :beforeName AND ue.id < :beforeId))  "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name DESC,ue.id DESC "
                + "LIMIT :limit"
                + ") last_rows_subquery ORDER BY name,id",
        connectionType = POSTGRES)
    List<String> listBefore(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("limit") int limit,
        @Bind("beforeName") String beforeName,
        @Bind("beforeId") String beforeId,
        @Bind("relation") int relation);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <mysqlCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name > :afterName OR (ue.name = :afterName AND ue.id > :afterId)) "
                + "GROUP BY ue.name, ue.id, ue.json "
                + "ORDER BY ue.name,ue.id "
                + "LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT ue.json "
                + "FROM user_entity ue "
                + "LEFT JOIN entity_relationship er on ue.id = er.toId "
                + "LEFT JOIN team_entity te on te.id = er.fromId and er.relation = :relation "
                + " <postgresCond> "
                + "AND (:team IS NULL OR te.nameHash = :team) "
                + "AND (ue.name > :afterName OR (ue.name = :afterName AND ue.id > :afterId))  "
                + "GROUP BY ue.name,ue.id, ue.json "
                + "ORDER BY ue.name,ue.id "
                + "LIMIT :limit",
        connectionType = POSTGRES)
    List<String> listAfter(
        @Define("table") String table,
        @Define("mysqlCond") String mysqlCond,
        @Define("postgresCond") String postgresCond,
        @BindFQN("team") String team,
        @Bind("limit") int limit,
        @Bind("afterName") String afterName,
        @Bind("afterId") String afterId,
        @Bind("relation") int relation);

    @SqlQuery("SELECT COUNT(*) FROM user_entity WHERE LOWER(email) = LOWER(:email)")
    int checkEmailExists(@Bind("email") String email);

    @SqlQuery("SELECT COUNT(*) FROM user_entity WHERE LOWER(name) = LOWER(:name)")
    int checkUserNameExists(@Bind("name") String name);

    @SqlQuery(
        "SELECT json FROM user_entity WHERE LOWER(name) = LOWER(:name) AND LOWER(email) = LOWER(:email)")
    String findUserByNameAndEmail(@Bind("name") String name, @Bind("email") String email);

    @SqlQuery("SELECT json FROM user_entity WHERE LOWER(email) = LOWER(:email)")
    String findUserByEmail(@Bind("email") String email);

    @Override
    default User findEntityByName(String fqn, Include include) {
      return EntityDAO.super.findEntityByName(fqn.toLowerCase(), include);
    }

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_entity SET json = JSON_SET(json, '$.lastActivityTime', :lastActivityTime) WHERE nameHash = :nameHash AND deleted = false",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_entity SET json = jsonb_set(json, '{lastActivityTime}', to_jsonb(:lastActivityTime::bigint)) WHERE nameHash = :nameHash AND deleted = false",
        connectionType = POSTGRES)
    void updateLastActivityTime(
        @BindFQN("nameHash") String nameHash, @Bind("lastActivityTime") long lastActivityTime);

    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_entity SET json = JSON_SET(json, '$.lastActivityTime', "
                + "CASE nameHash "
                + "<caseStatements> "
                + "END) "
                + "WHERE nameHash IN (<nameHashes>) AND deleted = false",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value =
            "UPDATE user_entity SET json = jsonb_set(json, '{lastActivityTime}', "
                + "CASE nameHash "
                + "<caseStatements> "
                + "END::text::jsonb) "
                + "WHERE nameHash IN (<nameHashes>) AND deleted = false",
        connectionType = POSTGRES)
    void updateLastActivityTimeBulk(
        @Define("caseStatements") String caseStatements,
        @BindList("nameHashes") List<String> nameHashes);

    @SqlQuery(
        "SELECT lastActivityTime FROM user_entity "
            + "WHERE isBot = FALSE AND lastActivityTime IS NOT NULL AND deleted = FALSE "
            + "ORDER BY lastActivityTime DESC LIMIT 1")
    Long getMaxLastActivityTime();

    @SqlQuery(
        "SELECT COUNT(DISTINCT id) FROM user_entity "
            + "WHERE isBot = false "
            + "AND deleted = false "
            + "AND lastActivityTime >= :since")
    int countDailyActiveUsers(@Bind("since") long since);
  }

  interface ChangeEventDAO {
    @SqlQuery(
        "SELECT json FROM change_event ce where ce.offset > :offset ORDER BY ce.eventTime DESC LIMIT :limit OFFSET :paginationOffset")
    List<String> listUnprocessedEvents(
        @Bind("offset") long offset,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE id = :id ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listFailedEventsById(
        @Bind("id") String id,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery("SELECT COUNT(*) FROM consumers_dlq WHERE id = :id")
    long countFailedEvents(@Bind("id") String id);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE id = :id AND source = :source ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listFailedEventsByIdAndSource(
        @Bind("id") String id,
        @Bind("source") String source,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listAllFailedEvents(
        @Bind("limit") int limit, @Bind("paginationOffset") int paginationOffset);

    @SqlQuery(
        "SELECT json, source FROM consumers_dlq WHERE source = :source ORDER BY timestamp DESC LIMIT :limit OFFSET :paginationOffset")
    @RegisterRowMapper(FailedEventResponseMapper.class)
    List<FailedEventResponse> listAllFailedEventsBySource(
        @Bind("source") String source,
        @Bind("limit") int limit,
        @Bind("paginationOffset") int paginationOffset);

    @ConnectionAwareSqlQuery(
        value =
            "SELECT json, status, timestamp "
                + "FROM ( "
                + "    SELECT json, 'FAILED' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'SUCCESSFUL' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events "
                + "ORDER BY timestamp DESC "
                + "LIMIT :limit OFFSET :paginationOffset",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT json, status, timestamp "
                + "FROM ( "
                + "    SELECT json, 'failed' AS status, timestamp "
                + "    FROM consumers_dlq WHERE id = :id "
                + "    UNION ALL "
                + "    SELECT json, 'successful' AS status, timestamp "
                + "    FROM successful_sent_change_events WHERE event_subscription_id = :id "
                + ") AS combined_events "
                + "ORDER BY timestamp DESC "
                + "LIMIT :limit OFFSET :paginationOffset",
        connectionType = POSTGRES)
    @RegisterRowMapper(EventResponseMapper.class)
    List<TypedEvent> listAllEventsWithStatuses(
        @Bind("id") String id,
        @Bind("limit") int limit,
        @Bind("paginationOffset") long paginationOffset);

    @SqlQuery("SELECT json FROM change_event ce where ce.offset > :offset")
    List<String> listUnprocessedEvents(@Bind("offset") long offset);

    @SqlQuery(
        "SELECT CASE WHEN EXISTS (SELECT 1 FROM event_subscription_entity WHERE id = :id) THEN 1 ELSE 0 END AS record_exists")
    int recordExists(@Bind("id") String id);

    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO change_event (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlUpdate(
        value = "INSERT INTO change_event (json) VALUES (:json :: jsonb)",
        connectionType = POSTGRES)
    void insert(@Bind("json") String json);

    @Transaction
    @ConnectionAwareSqlBatch(
        value = "INSERT INTO change_event (json) VALUES (:json)",
        connectionType = MYSQL)
    @ConnectionAwareSqlBatch(
        value = "INSERT INTO change_event (json) VALUES (CAST(:json AS jsonb))",
        connectionType = POSTGRES)
    void insertBatchRows(@Bind("json") List<String> jsons);

    default void insertBatch(List<String> jsons) {
      if (nullOrEmpty(jsons)) {
        return;
      }
      insertBatchRows(jsons);
    }

    @SqlUpdate("DELETE FROM change_event WHERE entityType = :entityType")
    void deleteAll(@Bind("entityType") String entityType);

    default List<String> list(EventType eventType, List<String> entityTypes, long timestamp) {
      if (nullOrEmpty(entityTypes)) {
        return Collections.emptyList();
      }
      if (entityTypes.get(0).equals("*")) {
        return listWithoutEntityFilter(eventType.value(), timestamp);
      }
      return listWithEntityFilter(eventType.value(), entityTypes, timestamp);
    }

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND (entityType IN (<entityTypes>)) AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithEntityFilter(
        @Bind("eventType") String eventType,
        @BindList("entityTypes") List<String> entityTypes,
        @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM change_event WHERE "
            + "eventType = :eventType AND eventTime >= :timestamp "
            + "ORDER BY eventTime ASC")
    List<String> listWithoutEntityFilter(
        @Bind("eventType") String eventType, @Bind("timestamp") long timestamp);

    @SqlQuery(
        "SELECT json FROM change_event ce  WHERE ce.offset > :offset ORDER BY ce.offset ASC LIMIT :limit")
    List<String> list(@Bind("limit") long limit, @Bind("offset") long offset);

    @ConnectionAwareSqlQuery(value = "SELECT MAX(offset) FROM change_event", connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value = "SELECT MAX(\"offset\") FROM change_event",
        connectionType = POSTGRES)
    long getLatestOffset();

    @SqlQuery("SELECT count(*) FROM change_event")
    long listCount();

    /** Record holding change event offset and JSON for cursor-based pagination. */
    record ChangeEventRecord(long offset, String json) {}

    /** Returns change events with their offset values for accurate cursor tracking. */
    @ConnectionAwareSqlQuery(
        value =
            "SELECT `offset`, json FROM change_event WHERE `offset` > :afterOffset ORDER BY `offset` ASC LIMIT :limit",
        connectionType = MYSQL)
    @ConnectionAwareSqlQuery(
        value =
            "SELECT \"offset\", json FROM change_event WHERE \"offset\" > :afterOffset ORDER BY \"offset\" ASC LIMIT :limit",
        connectionType = POSTGRES)
    @RegisterRowMapper(ChangeEventRecordMapper.class)
    List<ChangeEventRecord> listWithOffset(
        @Bind("limit") int limit, @Bind("afterOffset") long afterOffset);
  }

  class ChangeEventRecordMapper implements RowMapper<ChangeEventDAO.ChangeEventRecord> {
    @Override
    public ChangeEventDAO.ChangeEventRecord map(ResultSet rs, StatementContext ctx)
        throws SQLException {
      return new ChangeEventDAO.ChangeEventRecord(rs.getLong("offset"), rs.getString("json"));
    }
  }

  class FailedEventResponseMapper implements RowMapper<FailedEventResponse> {
    @Override
    public FailedEventResponse map(ResultSet rs, StatementContext ctx) throws SQLException {
      FailedEventResponse response = new FailedEventResponse();
      FailedEvent failedEvent = JsonUtils.readValue(rs.getString("json"), FailedEvent.class);
      response.setFailingSubscriptionId(failedEvent.getFailingSubscriptionId());
      response.setChangeEvent(failedEvent.getChangeEvent());
      response.setReason(failedEvent.getReason());
      response.setSource(rs.getString("source"));
      response.setTimestamp(failedEvent.getTimestamp());
      return response;
    }
  }

  class EventResponseMapper implements RowMapper<TypedEvent> {
    @Override
    public TypedEvent map(ResultSet rs, StatementContext ctx) throws SQLException {
      TypedEvent response = new TypedEvent();
      String status = rs.getString("status").toLowerCase();

      if (TypedEvent.Status.FAILED.value().equalsIgnoreCase(status)) {
        FailedEvent failedEvent = JsonUtils.readValue(rs.getString("json"), FailedEvent.class);
        response.setData(List.of(failedEvent));
        response.setStatus(TypedEvent.Status.FAILED);
      } else {
        ChangeEvent changeEvent = JsonUtils.readValue(rs.getString("json"), ChangeEvent.class);
        response.setData(List.of(changeEvent));
        response.setStatus(TypedEvent.Status.fromValue(status));
      }

      long timestampMillis = rs.getLong("timestamp");
      response.setTimestamp((double) timestampMillis);
      return response;
    }
  }

  interface TypeEntityDAO extends EntityDAO<Type> {
    @Override
    default String getTableName() {
      return "type_entity";
    }

    @Override
    default Class<Type> getEntityClass() {
      return Type.class;
    }

    @Override
    default boolean supportsSoftDelete() {
      return false;
    }
  }
}
