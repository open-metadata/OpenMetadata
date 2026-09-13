package org.openmetadata.service.jdbi3;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;
import static org.openmetadata.service.Entity.DATA_INSIGHT_CUSTOM_CHART;
import static org.openmetadata.service.Entity.KPI;
import static org.openmetadata.service.Entity.getEntity;
import static org.openmetadata.service.Entity.getEntityByName;
import static org.quartz.DateBuilder.MILLISECONDS_IN_DAY;

import java.io.IOException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.sqlobject.transaction.Transaction;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChart;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResult;
import org.openmetadata.schema.dataInsight.custom.DataInsightCustomChartResultList;
import org.openmetadata.schema.dataInsight.kpi.Kpi;
import org.openmetadata.schema.dataInsight.type.KpiResult;
import org.openmetadata.schema.dataInsight.type.KpiTarget;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.schema.type.change.ChangeSource;
import org.openmetadata.service.Entity;
import org.openmetadata.service.entity.EntityModuleDependencies;
import org.openmetadata.service.entity.EntityModuleFactory;
import org.openmetadata.service.entity.metadata.EntityRelationshipUpdates;
import org.openmetadata.service.entity.metadata.EntityRelationshipWriter;
import org.openmetadata.service.entity.policy.EntityPolicy;
import org.openmetadata.service.entity.policy.EntityPolicyContext;
import org.openmetadata.service.entity.write.EntityOperation;
import org.openmetadata.service.entity.write.EntitySpecificMutation;
import org.openmetadata.service.entity.write.EntityUpdateRequest;
import org.openmetadata.service.entity.write.EntityUpdater;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.resources.kpi.KpiResource;
import org.openmetadata.service.util.EntityUtil;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;

@Slf4j
@Repository()
public class KpiRepository implements EntityPolicy<Kpi> {

  private static final String KPI_RESULT_FIELD = "kpiResult";

  private static final String UPDATE_FIELDS =
      "targetValue,dataInsightChart,startDate,endDate,metricType";

  private static final String PATCH_FIELDS =
      "targetValue,dataInsightChart,description,startDate,endDate,metricType";

  public KpiRepository() {
    this.entityContext =
        new EntityPolicyContext<>(
            new EntityPolicyContext.Schema<>(
                KpiResource.COLLECTION_PATH, KPI, Kpi.class, Entity.getCollectionDAO().kpiDAO()),
            new EntityPolicyContext.WriteFields(PATCH_FIELDS, UPDATE_FIELDS, Set.of()),
            EntityModuleDependencies.standard());
    EntityModuleFactory.initialize(this, true);
  }

  @Override
  public void setFields(Kpi kpi, EntityUtil.Fields fields, RelationIncludes relationIncludes) {
    kpi.setDataInsightChart(
        fields.contains("dataInsightChart") ? getDataInsightChart(kpi) : kpi.getDataInsightChart());
    kpi.withKpiResult(
        fields.contains(KPI_RESULT_FIELD)
            ? getKpiResult(kpi.getFullyQualifiedName())
            : kpi.getKpiResult());
  }

  @Override
  public void setFieldsInBulk(EntityUtil.Fields fields, List<Kpi> kpis) {
    if (kpis == null || kpis.isEmpty()) {
      return;
    }
    if (fields.contains("dataInsightChart")) {
      fetchAndSetDataInsightCharts(kpis);
    }
    if (fields.contains(KPI_RESULT_FIELD)) {
      fetchAndSetKpiResults(kpis);
    }
    // Call parent implementation for other fields
    EntityPolicy.super.setFieldsInBulk(fields, kpis);
  }

  private void fetchAndSetDataInsightCharts(List<Kpi> kpis) {
    List<String> kpiIds = kpis.stream().map(Kpi::getId).map(UUID::toString).distinct().toList();
    // Bulk fetch data insight chart relationships
    List<CollectionDAO.EntityRelationshipObject> chartRecords =
        context()
            .dependencies()
            .daos()
            .relationshipDAO()
            .findToBatch(kpiIds, Relationship.USES.ordinal(), KPI, DATA_INSIGHT_CUSTOM_CHART);
    // Create a map of KPI ID to chart reference
    Map<UUID, EntityReference> kpiToChartMap = new HashMap<>();
    for (CollectionDAO.EntityRelationshipObject record : chartRecords) {
      UUID kpiId = UUID.fromString(record.getFromId());
      EntityReference chartRef =
          Entity.getEntityReferenceById(
              DATA_INSIGHT_CUSTOM_CHART, UUID.fromString(record.getToId()), Include.ALL);
      kpiToChartMap.put(kpiId, chartRef);
    }
    // Set charts on KPIs
    for (Kpi kpi : kpis) {
      EntityReference chartRef = kpiToChartMap.get(kpi.getId());
      kpi.setDataInsightChart(chartRef);
    }
  }

  private void fetchAndSetKpiResults(List<Kpi> kpis) {
    // For KPI results, we need to fetch the latest data for each KPI
    // Since this involves search queries, we'll process them individually but in a more efficient
    // way
    long end = System.currentTimeMillis();
    long start = end - MILLISECONDS_IN_DAY;
    // Group KPIs by their data insight chart to potentially batch queries
    Map<UUID, List<Kpi>> chartToKpisMap = new HashMap<>();
    for (Kpi kpi : kpis) {
      if (kpi.getDataInsightChart() != null) {
        chartToKpisMap
            .computeIfAbsent(kpi.getDataInsightChart().getId(), k -> new ArrayList<>())
            .add(kpi);
      }
    }
    // Process each chart group
    for (Map.Entry<UUID, List<Kpi>> entry : chartToKpisMap.entrySet()) {
      try {
        DataInsightCustomChart chart =
            getEntity(DATA_INSIGHT_CUSTOM_CHART, entry.getKey(), null, Include.NON_DELETED);
        DataInsightCustomChartResultList resultList =
            context().dependencies().search().getSearchClient().buildDIChart(chart, start, end);
        DataInsightCustomChartResult result = getMostRecentResult(resultList);
        if (result != null) {
          // Apply the result to all KPIs using this chart
          for (Kpi kpi : entry.getValue()) {
            KpiTarget target =
                new KpiTarget()
                    .withValue(result.getCount().toString())
                    .withTargetMet(result.getCount() >= kpi.getTargetValue());
            List<KpiTarget> targetList = new ArrayList<>();
            targetList.add(target);
            KpiResult kpiResult =
                new KpiResult()
                    .withKpiFqn(kpi.getFullyQualifiedName())
                    .withTimestamp(end)
                    .withTargetResult(targetList);
            kpi.withKpiResult(kpiResult);
          }
        }
      } catch (IOException | RuntimeException e) {
        // Log error but continue processing other KPIs
        LOG.warn("Failed to fetch KPI results for chart {}", entry.getKey(), e);
      }
    }
  }

  @Override
  public void clearFields(Kpi kpi, EntityUtil.Fields fields) {
    kpi.setDataInsightChart(fields.contains("dataInsightChart") ? kpi.getDataInsightChart() : null);
    kpi.withKpiResult(fields.contains(KPI_RESULT_FIELD) ? kpi.getKpiResult() : null);
  }

  @Override
  public void prepare(Kpi kpi, boolean update) {
    // validate targetDefinition
    DataInsightCustomChart chart =
        Entity.getEntity(kpi.getDataInsightChart(), null, Include.NON_DELETED);
    kpi.setDataInsightChart(chart.getEntityReference());
  }

  @Override
  public List<String> getFieldsStrippedFromStorageJson() {
    return List.of("dataInsightChart", "kpiResult");
  }

  @Override
  public void storeEntity(Kpi kpi, boolean update) {
    persistence().store(kpi, update);
  }

  @Override
  public void storeEntities(List<Kpi> entities) {
    persistence().insertMany(entities);
  }

  @Override
  public void clearEntitySpecificRelationshipsForMany(List<Kpi> entities) {
    if (entities.isEmpty()) return;
    List<UUID> ids = entities.stream().map(Kpi::getId).toList();
    deleteFromMany(ids, Entity.KPI, Relationship.USES, Entity.DATA_INSIGHT_CUSTOM_CHART);
  }

  @Override
  public void storeRelationships(Kpi kpi) {
    // Add relationship from Kpi to dataInsightChart
    relationshipWrites()
        .add(
            new EntityRelationshipWriter.Edge(
                kpi.getId(),
                kpi.getDataInsightChart().getId(),
                KPI,
                DATA_INSIGHT_CUSTOM_CHART,
                Relationship.USES),
            EntityRelationshipWriter.Value.EMPTY,
            false);
  }

  private EntityReference getDataInsightChart(Kpi kpi) {
    return relationships()
        .singleTo(kpi.getId(), Relationship.USES, DATA_INSIGHT_CUSTOM_CHART, true);
  }

  static DataInsightCustomChartResult getMostRecentResult(
      DataInsightCustomChartResultList resultList) {
    DataInsightCustomChartResult result = null;
    if (resultList != null && !nullOrEmpty(resultList.getResults())) {
      result = resultList.getResults().getLast();
    }
    return result;
  }

  public KpiResult getKpiResult(String fqn) {
    long end = System.currentTimeMillis();
    long start = end - MILLISECONDS_IN_DAY;
    Kpi kpi = getEntityByName(KPI, fqn, UPDATE_FIELDS, null);
    DataInsightCustomChart dataInsightCustomChart =
        getEntity(kpi.getDataInsightChart(), null, Include.NON_DELETED);
    DataInsightCustomChartResultList resultList;
    try {
      resultList =
          context()
              .dependencies()
              .search()
              .getSearchClient()
              .buildDIChart(dataInsightCustomChart, start, end);
    } catch (IOException e) {
      throw new RuntimeException(e);
    }
    DataInsightCustomChartResult result = getMostRecentResult(resultList);
    if (result != null) {
      KpiTarget target =
          new KpiTarget()
              .withValue(result.getCount().toString())
              .withTargetMet(result.getCount() >= kpi.getTargetValue());
      List<KpiTarget> targetList = new ArrayList<>();
      targetList.add(target);
      return new KpiResult()
          .withKpiFqn(kpi.getFullyQualifiedName())
          .withTimestamp(end)
          .withTargetResult(targetList);
    }
    return null;
  }

  public DataInsightCustomChartResultList getKpiResults(
      String fqn, Long startTs, Long endTs, OrderBy orderBy) throws IOException {
    Kpi kpi = getEntityByName(KPI, fqn, UPDATE_FIELDS, null);
    DataInsightCustomChart dataInsightCustomChart =
        getEntity(kpi.getDataInsightChart(), null, Include.NON_DELETED);
    return context()
        .dependencies()
        .search()
        .getSearchClient()
        .buildDIChart(dataInsightCustomChart, startTs, endTs);
  }

  @Override
  public EntityUpdater<Kpi> getUpdater(
      Kpi original, Kpi updated, EntityOperation operation, ChangeSource changeSource) {
    return new KpiUpdater(original, updated, operation).mutation();
  }

  public class KpiUpdater implements EntitySpecificMutation<Kpi> {

    public KpiUpdater(Kpi original, Kpi updated, EntityOperation operation) {
      this.entityUpdate =
          new EntityUpdater<>(
              context().services().getUpdaterServices(),
              new EntityUpdateRequest<>(original, updated, operation, null, false),
              this);
    }

    @Transaction
    @Override
    public void update(EntityUpdater<Kpi> entityUpdate, boolean consolidatingChanges) {
      entityUpdate.compareAndUpdate(
          "dataInsightChart",
          () ->
              entityUpdate.updateToRelationship(
                  new EntityRelationshipUpdates.Target(
                      "dataInsightChart",
                      entityUpdate.getOriginal().getId(),
                      KPI,
                      DATA_INSIGHT_CUSTOM_CHART,
                      Relationship.USES),
                  entityUpdate.getOriginal().getDataInsightChart(),
                  entityUpdate.getUpdated().getDataInsightChart(),
                  false));
      entityUpdate.compareAndUpdate(
          "targetValue",
          () ->
              entityUpdate.recordChange(
                  "targetValue",
                  entityUpdate.getOriginal().getTargetValue(),
                  entityUpdate.getUpdated().getTargetValue(),
                  true));
      entityUpdate.compareAndUpdate(
          "startDate",
          () ->
              entityUpdate.recordChange(
                  "startDate",
                  entityUpdate.getOriginal().getStartDate(),
                  entityUpdate.getUpdated().getStartDate()));
      entityUpdate.compareAndUpdate(
          "endDate",
          () ->
              entityUpdate.recordChange(
                  "endDate",
                  entityUpdate.getOriginal().getEndDate(),
                  entityUpdate.getUpdated().getEndDate()));
      entityUpdate.compareAndUpdate(
          "metricType",
          () ->
              entityUpdate.recordChange(
                  "metricType",
                  entityUpdate.getOriginal().getMetricType(),
                  entityUpdate.getUpdated().getMetricType()));
    }

    private final EntityUpdater<Kpi> entityUpdate;

    public EntityUpdater<Kpi> mutation() {
      return entityUpdate;
    }
  }

  private final EntityPolicyContext<Kpi> entityContext;

  @Override
  public final EntityPolicyContext<Kpi> context() {
    return entityContext;
  }
}
