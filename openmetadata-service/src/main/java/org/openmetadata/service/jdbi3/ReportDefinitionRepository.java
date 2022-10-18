package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.REPORT_DEFINITION;

import java.io.IOException;
import java.util.List;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.ReportDefinition;
import org.openmetadata.schema.analytics.type.ReportResult;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class ReportDefinitionRepository extends EntityRepository<ReportDefinition> {
  public static final String COLLECTION_PATH = "/v1/analytics/report";
  private static final String UPDATE_FIELDS = "owner";
  private static final String PATCH_FIELDS = "owner";
  private static final String REPORT_RESULT_EXTENSION = "reportDefinition.reportResult";

  public ReportDefinitionRepository(CollectionDAO dao) {
    super(
        COLLECTION_PATH,
        REPORT_DEFINITION,
        ReportDefinition.class,
        dao.reportDefinitionDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public ReportDefinition setFields(ReportDefinition reportDefinition, Fields fields) throws IOException {
    reportDefinition.setOwner(fields.contains("owner") ? getOwner(reportDefinition) : null);
    return reportDefinition;
  }

  @Override
  public void prepare(ReportDefinition reportDefinition) throws IOException {
    reportDefinition.setFullyQualifiedName(reportDefinition.getName());
  }

  @Override
  public void storeEntity(ReportDefinition reportDefinition, boolean update) throws IOException {
    EntityReference owner = reportDefinition.getOwner();

    reportDefinition.withOwner(null).withHref(null);
    store(reportDefinition.getId(), reportDefinition, update);

    reportDefinition.withOwner(owner);
  }

  @Override
  public void storeRelationships(ReportDefinition reportDefinition) throws IOException {
    storeOwner(reportDefinition, reportDefinition.getOwner());
  }

  private ChangeDescription addReportDefinitionChangeDescription(Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("reportResult").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  private ChangeEvent getChangeEvent(
      EntityInterface updated, ChangeDescription change, String entityType, Double prevVersion) {
    return new ChangeEvent()
        .withEntity(updated)
        .withChangeDescription(change)
        .withEventType(EventType.ENTITY_UPDATED)
        .withEntityType(entityType)
        .withEntityId(updated.getId())
        .withEntityFullyQualifiedName(updated.getFullyQualifiedName())
        .withUserName(updated.getUpdatedBy())
        .withTimestamp(System.currentTimeMillis())
        .withCurrentVersion(updated.getVersion())
        .withPreviousVersion(prevVersion);
  }

  @Transaction
  public RestUtil.PutResponse<?> addReportResult(UriInfo uriInfo, String fqn, ReportResult reportResult)
      throws IOException {
    ReportDefinition reportDefinition = dao.findEntityByName(fqn);
    reportResult.setId(UUID.randomUUID());

    ReportResult storedReportResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(
                    reportDefinition.getFullyQualifiedName(), REPORT_RESULT_EXTENSION, reportResult.getTimestamp()),
            ReportResult.class);
    if (storedReportResult != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              reportDefinition.getFullyQualifiedName(),
              REPORT_RESULT_EXTENSION,
              JsonUtils.pojoToJson(reportResult),
              reportResult.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(
              reportDefinition.getFullyQualifiedName(),
              REPORT_RESULT_EXTENSION,
              "reportResult",
              JsonUtils.pojoToJson(reportResult));
    }

    ChangeDescription change =
        addReportDefinitionChangeDescription(reportDefinition.getVersion(), reportResult, storedReportResult);
    ChangeEvent changeEvent =
        getChangeEvent(withHref(uriInfo, reportDefinition), change, entityType, reportDefinition.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  public ResultList<ReportResult> getReportResults(String fqn, Long startTs, Long endTs) throws IOException {
    List<ReportResult> reportResults;
    reportResults =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestamps(fqn, REPORT_RESULT_EXTENSION, startTs, endTs),
            ReportResult.class);

    return new ResultList<>(reportResults, String.valueOf(startTs), String.valueOf(endTs), reportResults.size());
  }
}
