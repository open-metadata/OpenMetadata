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

import org.openmetadata.catalog.jdbi3.DashboardRepository.DashboardDAO;
import org.openmetadata.catalog.jdbi3.DatabaseRepository.DatabaseDAO;
import org.openmetadata.catalog.jdbi3.ReportRepository.ReportDAO;
import org.openmetadata.catalog.jdbi3.TableRepository.TableDAO;
import org.openmetadata.catalog.jdbi3.TopicRepository.TopicDAO;
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.jdbi3.TaskRepository.TaskDAO;
import org.openmetadata.catalog.jdbi3.ModelRepository.ModelDAO;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.util.EntityUtil;
import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;
import org.skife.jdbi.v2.sqlobject.Transaction;
import org.skife.jdbi.v2.sqlobject.customizers.RegisterMapper;
import org.skife.jdbi.v2.tweak.ResultSetMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.util.EntityUtil.getEntityReference;

public abstract class UsageRepository {
  private static final Logger LOG = LoggerFactory.getLogger(UsageRepository.class);

  @CreateSqlObject
  abstract UsageDAO usageDAO();

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
  abstract ModelDAO modelDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();



  @Transaction
  public EntityUsage get(String entityType, String id, String date, int days) throws IOException {
    EntityReference ref = getEntityReference(entityType, UUID.fromString(id), tableDAO(), databaseDAO(),
            metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), chartDAO(), taskDAO(), modelDAO());
    List<UsageDetails> usageDetails = usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public EntityUsage getByName(String entityType, String fqn, String date, int days) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fqn, tableDAO(), databaseDAO(),
            metricsDAO(), reportDAO(), topicDAO(), chartDAO(), dashboardDAO(), taskDAO(), modelDAO());
    List<UsageDetails> usageDetails = usageDAO().getUsageById(ref.getId().toString(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public void create(String entityType, String id, DailyCount usage) throws IOException {
    // Validate data entity for which usage is being collected
    getEntityReference(entityType, UUID.fromString(id), tableDAO(), databaseDAO(), metricsDAO(),
            dashboardDAO(), reportDAO(), topicDAO(), chartDAO(), taskDAO(), modelDAO());
    addUsage(entityType, id, usage);
  }

  @Transaction
  public void createByName(String entityType, String fullyQualifiedName, DailyCount usage) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fullyQualifiedName, tableDAO(),
            databaseDAO(), metricsDAO(), reportDAO(), topicDAO(), chartDAO(), dashboardDAO(), taskDAO(), modelDAO());
    addUsage(entityType, ref.getId().toString(), usage);
    LOG.info("Usage successfully posted by name");
  }

  @Transaction
  public void computePercentile(String entityType, String date) {
    usageDAO().computePercentile(entityType, date);
  }

  private void addUsage(String entityType, String entityId, DailyCount usage) {
    // Insert usage record
    usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());

    // If table usage was reported, add the usage count to database
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      List<String> databaseIds = relationshipDAO().findFrom(entityId, Relationship.CONTAINS.ordinal(), Entity.DATABASE);
      usageDAO().insertOrUpdateCount(usage.getDate(), databaseIds.get(0), Entity.DATABASE, usage.getCount());
    }
  }

  @RegisterMapper(UsageDetailsMapper.class)
  public interface UsageDAO {
    @SqlUpdate("INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) " +
            "SELECT :date, :id, :entityType, :count1, " +
            "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - " +
            "INTERVAL 6 DAY)), " +
            "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - " +
            "INTERVAL 29 DAY))")
    void insert(@Bind("date") String date, @Bind("id") String id, @Bind("entityType") String entityType, @Bind(
            "count1") int count1);

    @SqlUpdate("INSERT INTO entity_usage (usageDate, id, entityType, count1, count7, count30) " +
            "SELECT :date, :id, :entityType, :count1, " +
            "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - " +
            "INTERVAL 6 DAY)), " +
            "(:count1 + (SELECT COALESCE(SUM(count1), 0) FROM entity_usage WHERE id = :id AND usageDate >= :date - " +
            "INTERVAL 29 DAY)) " +
            "ON DUPLICATE KEY UPDATE count1 = count1 + :count1, count7 = count7 + :count1, count30 = count30 + :count1")
    void insertOrUpdateCount(@Bind("date") String date, @Bind("id") String id, @Bind("entityType") String entityType,
                             @Bind("count1") int count1);

    @SqlUpdate("UPDATE entity_usage u JOIN ( " +
            "SELECT u1.id, " +
            "(SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 <  u1.count1 AND u2.entityType = :entityType " +
            "AND u2.usageDate = :date) as p1, " +
            "(SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 <  u1.count7 AND u3.entityType = :entityType " +
            "AND u3.usageDate = :date) as p7, " +
            "(SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 <  u1.count30 AND u4.entityType = :entityType " +
            "AND u4.usageDate = :date) as p30, " +
            "(SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = :date) as total " +
            "FROM entity_usage u1 WHERE u1.entityType = :entityType AND u1.usageDate = :date" +
            ") vals ON u.id = vals.id AND usageDate = :date " +
            "SET u.percentile1 = ROUND(100 * p1/total, 2), u.percentile7 = ROUND(p7 * 100/total, 2), u.percentile30 =" +
            " ROUND(p30*100/total, 2)")
    @SqlQuery("SELECT id, usageDate, entityType, count1, count7, count30, " +
            "percentile1, percentile7, percentile30 FROM entity_usage " +
            "WHERE id = :id AND usageDate >= :date - INTERVAL :days DAY AND usageDate <= :date ORDER BY usageDate DESC")
    List<UsageDetails> getUsageById(@Bind("id") String id, @Bind("date") String date, @Bind("days") int days);

    /**
     * Get latest usage record
     **/
    @SqlQuery("SELECT id, usageDate, entityType, count1, count7, count30, " +
            "percentile1, percentile7, percentile30 FROM entity_usage " +
            "WHERE usageDate IN (SELECT MAX(usageDate) FROM entity_usage WHERE id = :id) AND id = :id")
    UsageDetails getLatestUsage(@Bind("id") String id);

    @SqlUpdate("DELETE FROM entity_usage WHERE id = :id")
    int delete(@Bind("id") String id);

    /**
     * Note not using in following percentile computation PERCENT_RANK function as unit tests use mysql5.7 and it does
     * not have window function
     */
    @SqlUpdate("UPDATE entity_usage u JOIN ( " +
            "SELECT u1.id, " +
            "(SELECT COUNT(*) FROM entity_usage as u2 WHERE u2.count1 <  u1.count1 AND u2.entityType = :entityType " +
            "AND u2.usageDate = :date) as p1, " +
            "(SELECT COUNT(*) FROM entity_usage as u3 WHERE u3.count7 <  u1.count7 AND u3.entityType = :entityType " +
            "AND u3.usageDate = :date) as p7, " +
            "(SELECT COUNT(*) FROM entity_usage as u4 WHERE u4.count30 <  u1.count30 AND u4.entityType = :entityType " +
            "AND u4.usageDate = :date) as p30, " +
            "(SELECT COUNT(*) FROM entity_usage WHERE entityType = :entityType AND usageDate = :date) as total " +
            "FROM entity_usage u1 WHERE u1.entityType = :entityType AND u1.usageDate = :date" +
            ") vals ON u.id = vals.id AND usageDate = :date " +
            "SET u.percentile1 = ROUND(100 * p1/total, 2), u.percentile7 = ROUND(p7 * 100/total, 2), u.percentile30 =" +
            " ROUND(p30*100/total, 2)")
    void computePercentile(@Bind("entityType") String entityType, @Bind("date") String date);

  }

  public static class UsageDetailsMapper implements ResultSetMapper<UsageDetails> {
    @Override
    public UsageDetails map(int i, ResultSet r, StatementContext statementContext) throws SQLException {
      UsageStats dailyStats = new UsageStats().withCount(r.getInt("count1")).withPercentileRank(r.getDouble(
              "percentile1"));
      UsageStats weeklyStats = new UsageStats().withCount(r.getInt("count7")).withPercentileRank(r.getDouble(
              "percentile7"));
      UsageStats monthlyStats = new UsageStats().withCount(r.getInt("count30")).withPercentileRank(r.getDouble(
              "percentile30"));
      return new UsageDetails().withDate(r.getString("usageDate")).withDailyStats(dailyStats)
              .withWeeklyStats(weeklyStats).withMonthlyStats(monthlyStats);
    }
  }
}
