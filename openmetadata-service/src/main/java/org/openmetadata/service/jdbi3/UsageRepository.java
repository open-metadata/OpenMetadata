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

import static org.openmetadata.schema.type.EventType.ENTITY_FIELDS_CHANGED;
import static org.openmetadata.schema.type.EventType.ENTITY_UPDATED;
import static org.openmetadata.service.Entity.CHART;
import static org.openmetadata.service.Entity.DASHBOARD;
import static org.openmetadata.service.Entity.FIELD_USAGE_SUMMARY;
import static org.openmetadata.service.Entity.MLMODEL;
import static org.openmetadata.service.Entity.PIPELINE;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.util.EntityUtil.fieldUpdated;

import jakarta.ws.rs.core.Response;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.DailyCount;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.UsageDetails;
import org.openmetadata.schema.type.UsageStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CatalogExceptionMessage;
import org.openmetadata.service.exception.UnhandledServerException;
import org.openmetadata.service.util.RestUtil;

@Slf4j
@Repository
public class UsageRepository {
  private static final String PUT = "createOrUpdate";
  private static final String POST = "createNew";
  private final CollectionDAO dao;

  public UsageRepository() {
    this.dao = Entity.getCollectionDAO();
    Entity.setUsageRepository(this);
  }

  public EntityUsage get(String entityType, UUID id, String date, int days) {
    EntityReference ref = Entity.getEntityReferenceById(entityType, id, Include.NON_DELETED);
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(id, date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  public EntityUsage getByName(String entityType, String fqn, String date, int days) {
    EntityReference ref = Entity.getEntityReferenceByName(entityType, fqn, Include.NON_DELETED);
    List<UsageDetails> usageDetails = dao.usageDAO().getUsageById(ref.getId(), date, days - 1);
    return new EntityUsage().withUsage(usageDetails).withEntity(ref);
  }

  @Transaction
  public RestUtil.PutResponse<?> create(String entityType, UUID id, DailyCount usage) {
    // Validate data entity for which usage is being collected
    Entity.getEntityReferenceById(entityType, id, Include.NON_DELETED);
    return addUsage(POST, entityType, id, usage);
  }

  @Transaction
  public RestUtil.PutResponse<?> createByName(
      String entityType, String fullyQualifiedName, DailyCount usage) {
    EntityReference ref =
        Entity.getEntityReferenceByName(entityType, fullyQualifiedName, Include.NON_DELETED);
    return addUsage(POST, entityType, ref.getId(), usage);
  }

  @Transaction
  public RestUtil.PutResponse<?> createOrUpdate(String entityType, UUID id, DailyCount usage) {
    // Validate data entity for which usage is being collected
    Entity.getEntityReferenceById(entityType, id, Include.NON_DELETED);
    return addUsage(PUT, entityType, id, usage);
  }

  @Transaction
  public RestUtil.PutResponse<?> createOrUpdateByName(
      String entityType, String fullyQualifiedName, DailyCount usage) {
    EntityReference ref =
        Entity.getEntityReferenceByName(entityType, fullyQualifiedName, Include.NON_DELETED);
    return addUsage(PUT, entityType, ref.getId(), usage);
  }

  @Transaction
  public void computePercentile(String entityType, String date) {
    dao.usageDAO().computePercentile(entityType, date);
  }

  private RestUtil.PutResponse<?> addUsage(
      String method, String entityType, UUID entityId, DailyCount usage) {
    String fields = "usageSummary";
    // If table usage was reported, add the usage count to schema and database
    String type = entityType.toLowerCase();
    switch (type) {
      case TABLE:
        return tableEntityUsage(method, fields, entityId, entityType, usage);
      case PIPELINE:
        return pipelineEntityUsage(method, fields, entityId, entityType, usage);
      case DASHBOARD:
        return dashboardEntityUsage(method, fields, entityId, entityType, usage);
      case CHART:
        return chartEntityUsage(method, fields, entityId, entityType, usage);
      case MLMODEL:
        return mlModelEntityUsage(method, fields, entityId, entityType, usage);
      default:
        LOG.error("Invalid Usage Entity Type");
        throw new UnhandledServerException(
            CatalogExceptionMessage.entityTypeNotSupported(entityType));
    }
  }

  private RestUtil.PutResponse<?> tableEntityUsage(
      String method, String fields, UUID entityId, String entityType, DailyCount usage) {
    // we accept usage for deleted entities
    Table table = Entity.getEntity(Entity.TABLE, entityId, fields, Include.ALL);
    // Insert usage record
    insertToUsageRepository(method, entityId, entityType, usage);
    Table updated = Entity.getEntity(Entity.TABLE, entityId, fields, Include.ALL);
    dao.usageDAO()
        .insertOrUpdateCount(
            usage.getDate(),
            table.getDatabaseSchema().getId(),
            Entity.DATABASE_SCHEMA,
            usage.getCount());
    dao.usageDAO()
        .insertOrUpdateCount(
            usage.getDate(), table.getDatabase().getId(), Entity.DATABASE, usage.getCount());

    ChangeDescription change =
        getChangeDescription(
            table.getVersion(), updated.getUsageSummary(), table.getUsageSummary());
    ChangeEvent changeEvent = getChangeEvent(updated, change, entityType, table.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private RestUtil.PutResponse<?> dashboardEntityUsage(
      String method, String fields, UUID entityId, String entityType, DailyCount usage) {
    Dashboard dashboard = Entity.getEntity(Entity.DASHBOARD, entityId, fields, Include.ALL);
    insertToUsageRepository(method, entityId, entityType, usage);
    Dashboard updated = Entity.getEntity(Entity.DASHBOARD, entityId, fields, Include.ALL);

    ChangeDescription change =
        getChangeDescription(
            dashboard.getVersion(), updated.getUsageSummary(), dashboard.getUsageSummary());
    ChangeEvent changeEvent = getChangeEvent(updated, change, entityType, dashboard.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private RestUtil.PutResponse<?> pipelineEntityUsage(
      String method, String fields, UUID entityId, String entityType, DailyCount usage) {
    Pipeline pipeline = Entity.getEntity(Entity.PIPELINE, entityId, fields, Include.ALL);
    insertToUsageRepository(method, entityId, entityType, usage);
    Pipeline updated = Entity.getEntity(Entity.PIPELINE, entityId, fields, Include.ALL);

    ChangeDescription change =
        getChangeDescription(
            pipeline.getVersion(), updated.getUsageSummary(), pipeline.getUsageSummary());
    ChangeEvent changeEvent = getChangeEvent(updated, change, entityType, pipeline.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private RestUtil.PutResponse<?> chartEntityUsage(
      String method, String fields, UUID entityId, String entityType, DailyCount usage) {
    Chart chart = Entity.getEntity(Entity.CHART, entityId, fields, Include.ALL);
    insertToUsageRepository(method, entityId, entityType, usage);
    Chart updated = Entity.getEntity(Entity.CHART, entityId, fields, Include.ALL);

    ChangeDescription change =
        getChangeDescription(
            chart.getVersion(), updated.getUsageSummary(), chart.getUsageSummary());
    ChangeEvent changeEvent = getChangeEvent(updated, change, entityType, chart.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private RestUtil.PutResponse<?> mlModelEntityUsage(
      String method, String fields, UUID entityId, String entityType, DailyCount usage) {
    MlModel mlModel = Entity.getEntity(Entity.MLMODEL, entityId, fields, Include.ALL);
    insertToUsageRepository(method, entityId, entityType, usage);
    MlModel updated = Entity.getEntity(Entity.CHART, entityId, fields, Include.ALL);

    ChangeDescription change =
        getChangeDescription(
            mlModel.getVersion(), updated.getUsageSummary(), mlModel.getUsageSummary());
    ChangeEvent changeEvent = getChangeEvent(updated, change, entityType, mlModel.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, ENTITY_FIELDS_CHANGED);
  }

  private void insertToUsageRepository(
      String method, UUID entityId, String entityType, DailyCount usage) {
    if (method.equals(POST)) {
      dao.usageDAO().insertOrReplaceCount(usage.getDate(), entityId, entityType, usage.getCount());
    } else if (method.equals(PUT)) {
      dao.usageDAO().insertOrUpdateCount(usage.getDate(), entityId, entityType, usage.getCount());
    }
  }

  private ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withId(UUID.randomUUID())
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  private ChangeDescription getChangeDescription(Double version, Object newValue, Object oldValue) {
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    fieldUpdated(change, FIELD_USAGE_SUMMARY, oldValue, newValue);
    return change;
  }

  public static class UsageDetailsMapper implements RowMapper<UsageDetails> {
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
      return new UsageDetails()
          .withDate(r.getString("usageDate"))
          .withDailyStats(dailyStats)
          .withWeeklyStats(weeklyStats)
          .withMonthlyStats(monthlyStats);
    }
  }
}
