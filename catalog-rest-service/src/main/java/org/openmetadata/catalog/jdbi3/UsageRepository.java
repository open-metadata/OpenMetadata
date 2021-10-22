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

import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.util.EntityUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;

import static org.openmetadata.catalog.util.EntityUtil.getEntityReference;

public class UsageRepository {
  private static final Logger LOG = LoggerFactory.getLogger(UsageRepository.class);

  public UsageRepository(CollectionDAO repo3) { this.repo3 = repo3; }

  private final CollectionDAO repo3;

  @Transaction
  public EntityUsage get(String entityType, String id, String date, int days) throws IOException {
    EntityReference ref = getEntityReference(entityType, UUID.fromString(id), repo3.tableDAO(), repo3.databaseDAO(),
            repo3.metricsDAO(), repo3.dashboardDAO(), repo3.reportDAO(), repo3.topicDAO(), repo3.chartDAO(),
            repo3.taskDAO(), repo3.modelDAO(), repo3.pipelineDAO());
    List<UsageDetails> usageDetails = repo3.usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public EntityUsage getByName(String entityType, String fqn, String date, int days) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fqn, repo3.tableDAO(), repo3.databaseDAO(),
            repo3.metricsDAO(), repo3.reportDAO(), repo3.topicDAO(), repo3.chartDAO(), repo3.dashboardDAO(),
            repo3.taskDAO(), repo3.modelDAO(), repo3.pipelineDAO());
    List<UsageDetails> usageDetails = repo3.usageDAO().getUsageById(ref.getId().toString(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public void create(String entityType, String id, DailyCount usage) throws IOException {
    // Validate data entity for which usage is being collected
    getEntityReference(entityType, UUID.fromString(id), repo3.tableDAO(), repo3.databaseDAO(), repo3.metricsDAO(),
            repo3.dashboardDAO(), repo3.reportDAO(), repo3.topicDAO(), repo3.chartDAO(), repo3.taskDAO(),
            repo3.modelDAO(), repo3.pipelineDAO());
    addUsage(entityType, id, usage);
  }

  @Transaction
  public void createByName(String entityType, String fullyQualifiedName, DailyCount usage) throws IOException {
    EntityReference ref = EntityUtil.getEntityReferenceByName(entityType, fullyQualifiedName, repo3.tableDAO(),
            repo3.databaseDAO(), repo3.metricsDAO(), repo3.reportDAO(), repo3.topicDAO(), repo3.chartDAO(),
            repo3.dashboardDAO(), repo3.taskDAO(), repo3.modelDAO(), repo3.pipelineDAO());
    addUsage(entityType, ref.getId().toString(), usage);
    LOG.info("Usage successfully posted by name");
  }

  @Transaction
  public void computePercentile(String entityType, String date) {
    repo3.usageDAO().computePercentile(entityType, date);
  }

  private void addUsage(String entityType, String entityId, DailyCount usage) {
    // Insert usage record
    repo3.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());

    // If table usage was reported, add the usage count to database
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      List<String> databaseIds = repo3.relationshipDAO().findFrom(entityId, Relationship.CONTAINS.ordinal(), Entity.DATABASE);
      repo3.usageDAO().insertOrUpdateCount(usage.getDate(), databaseIds.get(0), Entity.DATABASE, usage.getCount());
    }
  }

  public static class UsageDetailsMapper implements RowMapper<UsageDetails> {
    @Override
    public UsageDetails map(ResultSet r, StatementContext ctx) throws SQLException {
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
