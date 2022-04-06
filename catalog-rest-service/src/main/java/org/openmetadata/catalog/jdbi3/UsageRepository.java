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

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.util.EntityUtil.Fields;

@Slf4j
public class UsageRepository {
  private final CollectionDAO dao;

  public UsageRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  @Transaction
  public EntityUsage get(String entityType, String id, String date, int days) throws IOException {
    EntityReference ref = Entity.getEntityReferenceById(entityType, UUID.fromString(id));
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public EntityUsage getByName(String entityType, String fqn, String date, int days) throws IOException {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn);
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(ref.getId().toString(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public void create(String entityType, String id, DailyCount usage) throws IOException {
    // Validate data entity for which usage is being collected
    Entity.getEntityReferenceById(entityType, UUID.fromString(id));
    addUsage(entityType, id, usage);
  }

  @Transaction
  public void createByName(String entityType, String fullyQualifiedName, DailyCount usage) throws IOException {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fullyQualifiedName);
    addUsage(entityType, ref.getId().toString(), usage);
    LOG.info("Usage successfully posted by name");
  }

  @Transaction
  public void computePercentile(String entityType, String date) {
    dao.usageDAO().computePercentile(entityType, date);
  }

  private void addUsage(String entityType, String entityId, DailyCount usage) throws IOException {
    // Insert usage record
    dao.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());

    // If table usage was reported, add the usage count to schema and database
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      // we accept usage for deleted entities
      Table table = Entity.getEntity(Entity.TABLE, UUID.fromString(entityId), Fields.EMPTY_FIELDS, Include.ALL);
      dao.usageDAO()
          .insertOrUpdateCount(
              usage.getDate(), table.getDatabaseSchema().getId().toString(), Entity.DATABASE_SCHEMA, usage.getCount());
      dao.usageDAO()
          .insertOrUpdateCount(
              usage.getDate(), table.getDatabase().getId().toString(), Entity.DATABASE, usage.getCount());
    }
  }

  public static class UsageDetailsMapper implements RowMapper<UsageDetails> {
    @Override
    public UsageDetails map(ResultSet r, StatementContext ctx) throws SQLException {
      UsageStats dailyStats =
          new UsageStats().withCount(r.getInt("count1")).withPercentileRank(r.getDouble("percentile1"));
      UsageStats weeklyStats =
          new UsageStats().withCount(r.getInt("count7")).withPercentileRank(r.getDouble("percentile7"));
      UsageStats monthlyStats =
          new UsageStats().withCount(r.getInt("count30")).withPercentileRank(r.getDouble("percentile30"));
      return new UsageDetails()
          .withDate(r.getString("usageDate"))
          .withDailyStats(dailyStats)
          .withWeeklyStats(weeklyStats)
          .withMonthlyStats(monthlyStats);
    }
  }
}
