package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;
import static org.openmetadata.service.Entity.KPI;

import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import javax.ws.rs.core.Response;
import javax.ws.rs.core.UriInfo;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.dataInsight.ChartParameterValues;
import org.openmetadata.schema.dataInsight.DataInsightChart;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.CustomExceptionMessage;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO.EntityRelationshipRecord;
import org.openmetadata.service.resources.kpi.KpiResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class KpiRepository extends EntityRepository<Kpi> {
  public static final String COLLECTION_PATH = "/v1/kpi";
  private static final String UPDATE_FIELDS = "owner,targetDefinition,dataInsightChart,startDate,endDate,metricType";
  private static final String PATCH_FIELDS =
      "owner,targetDefinition,dataInsightChart,description,owner,startDate,endDate,metricType";
  public static final String KPI_RESULT_EXTENSION = "kpi.kpiResult";

  public KpiRepository(CollectionDAO dao) {
    super(KpiResource.COLLECTION_PATH, KPI, Kpi.class, dao.kpiDAO(), dao, PATCH_FIELDS, UPDATE_FIELDS);
  }

  @Override
  public Kpi setFields(Kpi kpi, EntityUtil.Fields fields) throws IOException {
    kpi.setDataInsightChart(fields.contains("dataInsightChart") ? getDataInsightChart(kpi) : null);
    return kpi.withKpiResult(fields.contains("kpiResult") ? getKpiResult(kpi.getFullyQualifiedName()) : null);
  }

  @Override
  public void prepare(Kpi kpi) throws IOException {
    // validate targetDefinition
    DataInsightChart chart = Entity.getEntity(kpi.getDataInsightChart(), "metrics", Include.NON_DELETED);
    kpi.setDataInsightChart(chart.getEntityReference());

    // Validate here if this chart already has some kpi in progress
    validateKpiTargetDefinition(kpi.getTargetDefinition(), chart.getMetrics());
  }

  private void validateKpiTargetDefinition(
      List<KpiTarget> kpiTargetDef, List<ChartParameterValues> dataInsightChartMetric) {
    if (kpiTargetDef.isEmpty() && !dataInsightChartMetric.isEmpty()) {
      throw new IllegalArgumentException("Parameter Values doesn't match Kpi Definition Parameters");
    }
    Map<String, Object> values = new HashMap<>();
    for (ChartParameterValues parameterValue : dataInsightChartMetric) {
      values.put(parameterValue.getName(), parameterValue.getChartDataType());
    }
    for (KpiTarget kpiTarget : kpiTargetDef) {
      if (!values.containsKey(kpiTarget.getName())) {
        throw new IllegalArgumentException(
            "Kpi Target Definition "
                + kpiTarget.getName()
                + " is not valid, metric not defined in corresponding chart");
      }
    }
  }

  @Override
  public void storeEntity(Kpi kpi, boolean update) throws IOException {
    EntityReference dataInsightChart = kpi.getDataInsightChart();
    KpiResult kpiResults = kpi.getKpiResult();
    kpi.withDataInsightChart(null).withKpiResult(null);
    store(kpi, update);
    kpi.withDataInsightChart(dataInsightChart).withKpiResult(kpiResults);
  }

  @Override
  public void storeRelationships(Kpi kpi) {
    // Add relationship from Kpi to dataInsightChart
    addRelationship(kpi.getId(), kpi.getDataInsightChart().getId(), KPI, DATA_INSIGHT_CHART, Relationship.USES);
    // Add kpi owner relationship
    storeOwner(kpi, kpi.getOwner());
  }

  @Transaction
  public RestUtil.PutResponse<?> addKpiResult(UriInfo uriInfo, String fqn, KpiResult kpiResult) throws IOException {
    // Validate the request content
    Kpi kpi = dao.findEntityByName(fqn);

    String storedKpiResult = getExtensionAtTimestamp(kpi.getFullyQualifiedName(), KPI_RESULT_EXTENSION, kpiResult.getTimestamp());
      storeTimeSeries(kpi.getFullyQualifiedName(), KPI_RESULT_EXTENSION, "kpiResult",
          JsonUtils.pojoToJson(kpiResult), kpiResult.getTimestamp(), storedKpiResult != null);
    ChangeDescription change = addKpiResultChangeDescription(kpi.getVersion(), kpiResult, storedKpiResult);
    ChangeEvent changeEvent = getChangeEvent(withHref(uriInfo, kpi), change, entityType, kpi.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public RestUtil.PutResponse<?> deleteKpiResult(String fqn, Long timestamp) throws IOException {
    // Validate the request content
    Kpi kpi = dao.findEntityByName(fqn);
    KpiResult storedKpiResult =
        JsonUtils.readValue(
            getExtensionAtTimestamp(fqn, KPI_RESULT_EXTENSION, timestamp),
            KpiResult.class);
    if (storedKpiResult != null) {
      deleteExtensionAtTimestamp(fqn, KPI_RESULT_EXTENSION, timestamp);
      kpi.setKpiResult(storedKpiResult);
      ChangeDescription change = deleteKpiChangeDescription(kpi.getVersion(), storedKpiResult);
      ChangeEvent changeEvent = getChangeEvent(kpi, change, entityType, kpi.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new EntityNotFoundException(
        String.format("Failed to find kpi result for %s at %s", kpi.getName(), timestamp));
  }

  private ChangeDescription addKpiResultChangeDescription(Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("kpiResult").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  private ChangeDescription deleteKpiChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("kpiResult").withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsDeleted().add(fieldChange);
    return change;
  }

  private EntityReference getDataInsightChart(Kpi kpi) throws IOException {
    return getToEntityRef(kpi.getId(), Relationship.USES, DATA_INSIGHT_CHART, true);
  }

  public void validateDataInsightChartOneToOneMapping(UUID chartId) {
    // Each Chart has one unique Kpi mapping
    List<EntityRelationshipRecord> record = findTo(chartId, DATA_INSIGHT_CHART, Relationship.USES, KPI);
    if (record.size() > 0 && !chartId.equals(record.get(0).getId())) {
      throw new CustomExceptionMessage(Response.Status.BAD_REQUEST, "Chart Already has a mapped Kpi.");
    }
  }

  public KpiResult getKpiResult(String fqn) throws IOException {
    return JsonUtils.readValue(
        getLatestExtensionFromTimeseries(fqn, KPI_RESULT_EXTENSION), KpiResult.class);
  }

  public ResultList<KpiResult> getKpiResults(
      String fqn, Long startTs, Long endTs, CollectionDAO.EntityExtensionTimeSeriesDAO.OrderBy orderBy)
      throws IOException {
    List<KpiResult> kpiResults;
    kpiResults =
        JsonUtils.readObjects(
            getResultsFromAndToTimestamps(fqn, KPI_RESULT_EXTENSION, startTs, endTs, orderBy),
            KpiResult.class);
    return new ResultList<>(kpiResults, String.valueOf(startTs), String.valueOf(endTs), kpiResults.size());
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

  @Override
  public EntityUpdater getUpdater(Kpi original, Kpi updated, Operation operation) {
    return new KpiUpdater(original, updated, operation);
  }

  public class KpiUpdater extends EntityUpdater {
    public KpiUpdater(Kpi original, Kpi updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateToRelationship(
          "dataInsightChart",
          KPI,
          original.getId(),
          Relationship.USES,
          DATA_INSIGHT_CHART,
          original.getDataInsightChart(),
          updated.getDataInsightChart(),
          false);
      recordChange("targetDefinition", original.getTargetDefinition(), updated.getTargetDefinition());
      recordChange("startDate", original.getStartDate(), updated.getStartDate());
      recordChange("endDate", original.getEndDate(), updated.getEndDate());
      recordChange("metricType", original.getMetricType(), updated.getMetricType());
    }
  }
}
