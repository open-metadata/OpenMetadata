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

import static org.openmetadata.catalog.Entity.FIELD_USAGE_SUMMARY;

import java.io.IOException;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Dashboard;
import org.openmetadata.catalog.entity.data.MlModel;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.exception.UnhandledServerException;
import org.openmetadata.catalog.type.ChangeDescription;
import org.openmetadata.catalog.type.ChangeEvent;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityReference;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.EventType;
import org.openmetadata.catalog.type.FieldChange;
import org.openmetadata.catalog.type.Include;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.type.UsageStats;
import org.openmetadata.catalog.util.EntityUtil.Fields;
import org.openmetadata.catalog.util.RestUtil;

@Slf4j
public class UsageRepository {
  private final CollectionDAO dao;

  public UsageRepository(CollectionDAO dao) {
    this.dao = dao;
  }

  @Transaction
  public EntityUsage get(String entityType, String id, String date, int days) throws IOException {
    EntityReference ref = Entity.getEntityReferenceById(entityType, UUID.fromString(id), Include.NON_DELETED);
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public EntityUsage getByName(String entityType, String fqn, String date, int days) {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(ref.getId().toString(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public RestUtil.PutResponse create(String entityType, String id, DailyCount usage) throws IOException {
    // Validate data entity for which usage is being collected
    Entity.getEntityReferenceById(entityType, UUID.fromString(id), Include.NON_DELETED);
    return addUsage(entityType, id, usage);
  }

  @Transaction
  public RestUtil.PutResponse createByName(String entityType, String fullyQualifiedName, DailyCount usage)
      throws IOException {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fullyQualifiedName, Include.NON_DELETED);
    return addUsage(entityType, ref.getId().toString(), usage);
  }

  @Transaction
  public void computePercentile(String entityType, String date) {
    dao.usageDAO().computePercentile(entityType, date);
  }

  private RestUtil.PutResponse addUsage(String entityType, String entityId, DailyCount usage) throws IOException {
    Fields fields = new Fields(List.of("usageSummary"));
    // If table usage was reported, add the usage count to schema and database
    if (entityType.equalsIgnoreCase(Entity.TABLE)) {
      // we accept usage for deleted entities
      Table table = Entity.getEntity(Entity.TABLE, UUID.fromString(entityId), fields, Include.ALL);
      // Insert usage record
      dao.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());
      Table updated = Entity.getEntity(Entity.TABLE, UUID.fromString(entityId), fields, Include.ALL);
      dao.usageDAO()
          .insertOrUpdateCount(
              usage.getDate(), table.getDatabaseSchema().getId().toString(), Entity.DATABASE_SCHEMA, usage.getCount());
      dao.usageDAO()
          .insertOrUpdateCount(
              usage.getDate(), table.getDatabase().getId().toString(), Entity.DATABASE, usage.getCount());
      dao.usageDAO().computePercentile(entityType, usage.getDate());
      ChangeDescription change = new ChangeDescription().withPreviousVersion(table.getVersion());
      change
          .getFieldsUpdated()
          .add(
              new FieldChange()
                  .withName(FIELD_USAGE_SUMMARY)
                  .withNewValue(updated.getUsageSummary())
                  .withOldValue(table.getUsageSummary()));
      ChangeEvent changeEvent =
          new ChangeEvent()
              .withEntity(updated)
              .withChangeDescription(change)
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(entityType)
              .withEntityId(updated.getId())
              .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
              .withUserName(updated.getUpdatedBy())
              .withTimestamp(System.currentTimeMillis())
              .withCurrentVersion(updated.getVersion())
              .withPreviousVersion(table.getVersion());

      return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    } else if (entityType.equalsIgnoreCase(Entity.DASHBOARD)) {
      Dashboard dashboard = Entity.getEntity(Entity.DASHBOARD, UUID.fromString(entityId), fields, Include.ALL);
      dao.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());
      Dashboard updated = Entity.getEntity(Entity.DASHBOARD, UUID.fromString(entityId), fields, Include.ALL);
      ChangeDescription change = new ChangeDescription().withPreviousVersion(dashboard.getVersion());
      change
          .getFieldsUpdated()
          .add(
              new FieldChange()
                  .withName(FIELD_USAGE_SUMMARY)
                  .withNewValue(updated.getUsageSummary())
                  .withOldValue(dashboard.getUsageSummary()));
      ChangeEvent changeEvent =
          new ChangeEvent()
              .withEntity(updated)
              .withChangeDescription(change)
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(entityType)
              .withEntityId(updated.getId())
              .withEntityFullyQualifiedName(dashboard.getFullyQualifiedName())
              .withUserName(updated.getUpdatedBy())
              .withTimestamp(System.currentTimeMillis())
              .withCurrentVersion(updated.getVersion())
              .withPreviousVersion(dashboard.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    } else if (entityType.equalsIgnoreCase(Entity.CHART)) {
      Chart chart = Entity.getEntity(Entity.CHART, UUID.fromString(entityId), fields, Include.ALL);
      dao.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());
      Chart updated = Entity.getEntity(Entity.CHART, UUID.fromString(entityId), fields, Include.ALL);
      ChangeDescription change = new ChangeDescription().withPreviousVersion(chart.getVersion());
      change
          .getFieldsUpdated()
          .add(
              new FieldChange()
                  .withName(FIELD_USAGE_SUMMARY)
                  .withNewValue(updated.getUsageSummary())
                  .withOldValue(chart.getUsageSummary()));
      ChangeEvent changeEvent =
          new ChangeEvent()
              .withEntity(updated)
              .withChangeDescription(change)
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(entityType)
              .withEntityId(updated.getId())
              .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
              .withUserName(updated.getUpdatedBy())
              .withTimestamp(System.currentTimeMillis())
              .withCurrentVersion(updated.getVersion())
              .withPreviousVersion(chart.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    } else if (entityType.equalsIgnoreCase(Entity.MLMODEL)) {
      MlModel mlModel = Entity.getEntity(Entity.MLMODEL, UUID.fromString(entityId), fields, Include.ALL);
      dao.usageDAO().insert(usage.getDate(), entityId, entityType, usage.getCount());
      MlModel updated = Entity.getEntity(Entity.CHART, UUID.fromString(entityId), fields, Include.ALL);
      ChangeDescription change = new ChangeDescription().withPreviousVersion(mlModel.getVersion());
      change
          .getFieldsUpdated()
          .add(
              new FieldChange()
                  .withName(FIELD_USAGE_SUMMARY)
                  .withNewValue(updated.getUsageSummary())
                  .withOldValue(mlModel.getUsageSummary()));
      ChangeEvent changeEvent =
          new ChangeEvent()
              .withEntity(updated)
              .withChangeDescription(change)
              .withEventType(EventType.ENTITY_UPDATED)
              .withEntityType(entityType)
              .withEntityId(updated.getId())
              .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
              .withUserName(updated.getUpdatedBy())
              .withTimestamp(System.currentTimeMillis())
              .withCurrentVersion(updated.getVersion())
              .withPreviousVersion(mlModel.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new UnhandledServerException(CatalogExceptionMessage.entityTypeNotSupported(entityType));
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
