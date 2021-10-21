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
import org.openmetadata.catalog.jdbi3.ChartRepository.ChartDAO;
import org.openmetadata.catalog.jdbi3.TaskRepository.TaskDAO;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.jdbi3.MetricsRepository.MetricsDAO;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.util.EntityUtil;
import org.skife.jdbi.v2.StatementContext;
import org.skife.jdbi.v2.sqlobject.CreateSqlObject;
import org.skife.jdbi.v2.sqlobject.Transaction;
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
  abstract PipelineDAO pipelineDAO();

  @CreateSqlObject
  abstract ModelDAO modelDAO();

  @CreateSqlObject
  abstract EntityRelationshipDAO relationshipDAO();



  @Transaction
  public EntityUsage get(String entityType, String id, String date, int days) throws IOException {
    EntityReference ref = getEntityReference(entityType, UUID.fromString(id), tableDAO(), databaseDAO(),
            metricsDAO(), dashboardDAO(), reportDAO(), topicDAO(), chartDAO(), taskDAO(), modelDAO(), pipelineDAO());
    List<UsageDetails> usageDetails = usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public EntityUsage getByName(String entityType, String fqn, String date, int days) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fqn, tableDAO(), databaseDAO(),
            metricsDAO(), reportDAO(), topicDAO(), chartDAO(), dashboardDAO(), taskDAO(), modelDAO(), pipelineDAO());
    List<UsageDetails> usageDetails = usageDAO().getUsageById(ref.getId().toString(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public void create(String entityType, String id, DailyCount usage) throws IOException {
    // Validate data entity for which usage is being collected
    getEntityReference(entityType, UUID.fromString(id), tableDAO(), databaseDAO(), metricsDAO(),
            dashboardDAO(), reportDAO(), topicDAO(), chartDAO(), taskDAO(), modelDAO(), pipelineDAO());
    addUsage(entityType, id, usage);
  }

  @Transaction
  public void createByName(String entityType, String fullyQualifiedName, DailyCount usage) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fullyQualifiedName, tableDAO(),
            databaseDAO(), metricsDAO(), reportDAO(), topicDAO(), chartDAO(), dashboardDAO(),
            taskDAO(), modelDAO(), pipelineDAO());
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
