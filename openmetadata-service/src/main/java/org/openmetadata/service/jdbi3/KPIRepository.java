package org.openmetadata.service.jdbi3;

import static org.openmetadata.service.Entity.DATA_INSIGHT_CHART;
import static org.openmetadata.service.Entity.KPI;

import java.io.IOException;
import java.util.ArrayList;
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
import org.openmetadata.schema.dataInsight.KPI;
import org.openmetadata.schema.dataInsight.type.KPIResult;
import org.openmetadata.schema.dataInsight.type.KPITarget;
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
import org.openmetadata.service.resources.kpi.KPIResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;

public class KPIRepository extends EntityRepository<KPI> {
  public static final String COLLECTION_PATH = "/v1/kpi";
  private static final String UPDATE_FIELDS = "owner,targetDefinition,dataInsightChart,startDate,endDate,metricType";
  private static final String PATCH_FIELDS =
      "owner,targetDefinition,dataInsightChart,description,owner,startDate,endDate,metricType";
  public static final String KPI_RESULT_EXTENSION = "kpi.KPIResult";

  public KPIRepository(CollectionDAO dao) {
    super(
        KPIResource.COLLECTION_PATH,
        KPI,
        org.openmetadata.schema.dataInsight.KPI.class,
        dao.KPIDAO(),
        dao,
        PATCH_FIELDS,
        UPDATE_FIELDS);
  }

  @Override
  public KPI setFields(KPI kpi, EntityUtil.Fields fields) throws IOException {
    kpi.setDataInsightChart(fields.contains("dataInsightChart") ? getDataInsightChart(kpi) : null);
    kpi.setKpiResult(fields.contains("KPIResult") ? getKpiResult(kpi.getFullyQualifiedName()) : null);
    kpi.setOwner(fields.contains("owner") ? getOwner(kpi) : null);
    return kpi;
  }

  @Override
  public void prepare(KPI kpi) throws IOException {
    // validate targetDefinition
    Entity.getEntityReferenceById(Entity.DATA_INSIGHT_CHART, kpi.getDataInsightChart().getId(), Include.NON_DELETED);
    EntityRepository<DataInsightChart> dataInsightChartRepository = Entity.getEntityRepository(DATA_INSIGHT_CHART);
    DataInsightChart chart =
        dataInsightChartRepository.get(
            null, kpi.getDataInsightChart().getId(), dataInsightChartRepository.getFields("metrics"));
    // Validate here if this chart already has some kpi in progress
    validateKpiTargetDefinition(kpi.getTargetDefinition(), chart.getMetrics());
  }

  private void validateKpiTargetDefinition(
      List<KPITarget> kpiTargetDef, List<ChartParameterValues> dataInsightChartMetric) {
    if (kpiTargetDef.isEmpty() && !dataInsightChartMetric.isEmpty()) {
      throw new IllegalArgumentException("Parameter Values doesn't match Kpi Definition Parameters");
    }
    Map<String, Object> values = new HashMap<>();
    for (ChartParameterValues parameterValue : dataInsightChartMetric) {
      values.put(parameterValue.getName(), parameterValue.getChartDataType());
    }
    for (KPITarget kpiTarget : kpiTargetDef) {
      if (!values.containsKey(kpiTarget.getName())) {
        throw new IllegalArgumentException(
            "Kpi Target Definition "
                + kpiTarget.getName()
                + " is not valid, metric not defined in corresponding chart");
      }
    }
  }

  @Override
  public void storeEntity(KPI kpi, boolean update) throws IOException {
    EntityReference owner = kpi.getOwner();
    EntityReference dataInsightChart = kpi.getDataInsightChart();

    // Don't store owner, database, href and tags as JSON. Build it on the fly based on relationships
    kpi.withOwner(null).withHref(null).withDataInsightChart(null);
    store(kpi, update);

    // Restore the relationships
    kpi.withOwner(owner).withDataInsightChart(dataInsightChart);
  }

  @Override
  public void storeRelationships(KPI kpi) {
    // Add relationship from Kpi to dataInsightChart
    addRelationship(kpi.getId(), kpi.getDataInsightChart().getId(), KPI, DATA_INSIGHT_CHART, Relationship.USES);
    // Add kpi owner relationship
    storeOwner(kpi, kpi.getOwner());
  }

  @Transaction
  public RestUtil.PutResponse<?> addKpiResult(UriInfo uriInfo, String fqn, KPIResult KPIResult) throws IOException {
    // Validate the request content
    KPI kpi = dao.findEntityByName(fqn);

    KPIResult storedKpiResult =
        JsonUtils.readValue(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .getExtensionAtTimestamp(kpi.getFullyQualifiedName(), KPI_RESULT_EXTENSION, KPIResult.getTimestamp()),
            KPIResult.class);
    if (storedKpiResult != null) {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .update(
              kpi.getFullyQualifiedName(),
              KPI_RESULT_EXTENSION,
              JsonUtils.pojoToJson(KPIResult),
              KPIResult.getTimestamp());
    } else {
      daoCollection
          .entityExtensionTimeSeriesDao()
          .insert(kpi.getFullyQualifiedName(), KPI_RESULT_EXTENSION, "KPIResult", JsonUtils.pojoToJson(KPIResult));
    }
    ChangeDescription change = addKpiResultChangeDescription(kpi.getVersion(), KPIResult, storedKpiResult);
    ChangeEvent changeEvent = getChangeEvent(withHref(uriInfo, kpi), change, entityType, kpi.getVersion());

    return new RestUtil.PutResponse<>(Response.Status.CREATED, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
  }

  @Transaction
  public RestUtil.PutResponse<?> deleteKpiResult(String fqn, Long timestamp) throws IOException {
    // Validate the request content
    KPI kpi = dao.findEntityByName(fqn);
    KPIResult storedKpiResult =
        JsonUtils.readValue(
            daoCollection.entityExtensionTimeSeriesDao().getExtensionAtTimestamp(fqn, KPI_RESULT_EXTENSION, timestamp),
            KPIResult.class);
    if (storedKpiResult != null) {
      daoCollection.entityExtensionTimeSeriesDao().deleteAtTimestamp(fqn, KPI_RESULT_EXTENSION, timestamp);
      kpi.setKpiResult(storedKpiResult);
      ChangeDescription change = deleteKpiChangeDescription(kpi.getVersion(), storedKpiResult);
      ChangeEvent changeEvent = getChangeEvent(kpi, change, entityType, kpi.getVersion());
      return new RestUtil.PutResponse<>(Response.Status.OK, changeEvent, RestUtil.ENTITY_FIELDS_CHANGED);
    }
    throw new EntityNotFoundException(
        String.format("Failed to find kpi result for %s at %s", kpi.getName(), timestamp));
  }

  private ChangeDescription addKpiResultChangeDescription(Double version, Object newValue, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("KPIResult").withNewValue(newValue).withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsUpdated().add(fieldChange);
    return change;
  }

  private ChangeDescription deleteKpiChangeDescription(Double version, Object oldValue) {
    FieldChange fieldChange = new FieldChange().withName("KPIResult").withOldValue(oldValue);
    ChangeDescription change = new ChangeDescription().withPreviousVersion(version);
    change.getFieldsDeleted().add(fieldChange);
    return change;
  }

  private EntityReference getDataInsightChart(KPI kpi) throws IOException {
    return getToEntityRef(kpi.getId(), Relationship.USES, DATA_INSIGHT_CHART, true);
  }

  public void validateDataInsightChartOneToOneMapping(UUID chartId) {
    // Each Chart has one unique Kpi mapping
    List<CollectionDAO.EntityRelationshipRecord> record = findFrom(chartId, DATA_INSIGHT_CHART, Relationship.USES, KPI);
    if (record.size() > 0) {
      throw new CustomExceptionMessage(Response.Status.BAD_REQUEST, "Chart Already has a mapped Kpi.");
    }
  }

  public KPIResult getKpiResult(String fqn) throws IOException {
    return JsonUtils.readValue(
        daoCollection.entityExtensionTimeSeriesDao().getLatestExtension(fqn, KPI_RESULT_EXTENSION), KPIResult.class);
  }

  public ResultList<KPIResult> getKpiResults(
      String fqn, Long startTs, Long endTs, CollectionDAO.EntityExtensionTimeSeriesDAO.OrderBy orderBy)
      throws IOException {
    List<KPIResult> kpiResults;
    kpiResults =
        JsonUtils.readObjects(
            daoCollection
                .entityExtensionTimeSeriesDao()
                .listBetweenTimestampsByOrder(fqn, KPI_RESULT_EXTENSION, startTs, endTs, orderBy),
            KPIResult.class);
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
  public EntityUpdater getUpdater(KPI original, KPI updated, Operation operation) {
    return new KpiUpdater(original, updated, operation);
  }

  public class KpiUpdater extends EntityUpdater {
    public KpiUpdater(KPI original, KPI updated, Operation operation) {
      super(original, updated, operation);
    }

    @Override
    public void entitySpecificUpdate() throws IOException {
      updateToRelationships(
          "dataInsightChart",
          KPI,
          original.getId(),
          Relationship.USES,
          DATA_INSIGHT_CHART,
          new ArrayList<>(List.of(original.getDataInsightChart())),
          new ArrayList<>(List.of(updated.getDataInsightChart())),
          false);
      recordChange("targetDefinition", original.getTargetDefinition(), updated.getTargetDefinition());
      recordChange("startDate", original.getStartDate(), updated.getStartDate());
      recordChange("endDate", original.getEndDate(), updated.getEndDate());
      recordChange("metricType", original.getMetricType(), updated.getMetricType());
    }
  }
}
