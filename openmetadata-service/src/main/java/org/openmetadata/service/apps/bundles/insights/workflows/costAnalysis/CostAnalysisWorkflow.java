package org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis;

import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.TIMESTAMP_KEY;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.analytics.AggregatedCostAnalysisReportData;
import org.openmetadata.schema.analytics.DataAssetMetrics;
import org.openmetadata.schema.analytics.RawCostAnalysisReportData;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.api.services.CreateDatabaseService;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.config.InsightsConfig;
import org.openmetadata.service.apps.bundles.insights.processors.CreateReportDataProcessor;
import org.openmetadata.service.apps.bundles.insights.sinks.ReportDataSink;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflow.AbstractInsightsWorkflow;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors.AggregatedCostAnalysisReportDataAggregator;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors.AggregatedCostAnalysisReportDataProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors.DatabaseServiceTablesProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors.RawCostAnalysisReportDataProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.ReportDataRepository;
import org.openmetadata.service.jdbi3.TableRepository;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public class CostAnalysisWorkflow extends AbstractInsightsWorkflow {

  public static final String AGGREGATED_COST_ANALYSIS_DATA_MAP_KEY = "aggregatedCostAnalysisDataMap";

  public record CostAnalysisTableData(
      Table table, Optional<LifeCycle> oLifeCycle, Optional<Double> oSize) {}

  public record AggregatedCostAnalysisData(
      Double totalSize,
      Double totalCount,
      DataAssetMetrics unusedDataAssets,
      DataAssetMetrics frequentlyUsedDataAssets) {}

  private final InsightsConfig config;
  private final CollectionDAO collectionDAO;
  private final long startTimestamp;
  private final long endTimestamp;

  private final List<PaginatedEntitiesSource> sources = new ArrayList<>();
  private DatabaseServiceTablesProcessor databaseServiceTablesProcessor;
  private RawCostAnalysisReportDataProcessor rawCostAnalysisReportDataProcessor;
  private AggregatedCostAnalysisReportDataProcessor aggregatedCostAnalysisReportDataProcessor;

  public CostAnalysisWorkflow(InsightsConfig config, CollectionDAO collectionDAO) {
    super("CostAnalysisWorkflow");
    this.config = config;
    this.collectionDAO = collectionDAO;
    this.endTimestamp =
        TimestampUtils.getEndOfDayTimestamp(
            TimestampUtils.subtractDays(config.steadyStatePeriod().endTimestamp(), 1));
    this.startTimestamp = TimestampUtils.getStartOfDayTimestamp(endTimestamp);
  }

  @Override
  protected boolean isEnabled() {
    return config.costAnalysisConfig() != null
        && Boolean.TRUE.equals(config.costAnalysisConfig().getEnabled());
  }

  @Override
  protected void initialize() throws SearchIndexException {
    PaginatedEntitiesSource databaseServices =
        new PaginatedEntitiesSource(Entity.DATABASE_SERVICE, config.batchSize(), List.of("*"));
    int total = 0;
    String cursor = null;
    while (true) {
      ResultList<? extends EntityInterface> rawResult = databaseServices.readNextKeyset(cursor);
      cursor = rawResult.getPaging().getAfter();
      ResultList<DatabaseService> resultList = filterDatabaseServices(rawResult);
      for (DatabaseService databaseService : resultList.getData()) {
        ListFilter filter = new ListFilter(null);
        filter.addQueryParam("database", databaseService.getFullyQualifiedName());
        sources.add(
            new PaginatedEntitiesSource(Entity.TABLE, config.batchSize(), List.of("*"), filter)
                .withName(String.format("[CostAnalysisWorkflow] %s", databaseService.getFullyQualifiedName())));
        total += ((TableRepository) Entity.getEntityRepository(Entity.TABLE)).getDao().listCount(filter);
      }
      if (cursor == null) break;
    }
    databaseServiceTablesProcessor = new DatabaseServiceTablesProcessor(total);
    rawCostAnalysisReportDataProcessor = new RawCostAnalysisReportDataProcessor(total);
    aggregatedCostAnalysisReportDataProcessor = new AggregatedCostAnalysisReportDataProcessor(total);
  }

  @Override
  protected void run() throws SearchIndexException {
    Map<String, Object> contextData = new HashMap<>();

    long pointer = TimestampUtils.getStartOfDayTimestamp(endTimestamp);
    while (pointer >= startTimestamp) {
      deleteReportDataRecordsAtDate(pointer, ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA);
      pointer = TimestampUtils.subtractDays(pointer, 1);
    }
    deleteReportDataRecords(ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA);

    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();

    for (PaginatedEntitiesSource source : sources) {
      if (stopped) break;
      List<RawCostAnalysisReportData> rawList = new ArrayList<>();
      Map<String, Map<String, Map<String, AggregatedCostAnalysisData>>> aggregatedMap = new HashMap<>();
      contextData.put(TIMESTAMP_KEY, startTimestamp);
      contextData.put(AGGREGATED_COST_ANALYSIS_DATA_MAP_KEY, aggregatedMap);

      boolean sourceError = false;
      String cursor = null;
      while (true) {
        try {
          ResultList<? extends EntityInterface> resultList = source.readNextKeyset(cursor);
          cursor = resultList.getPaging().getAfter();
          List<CostAnalysisTableData> tableData =
              databaseServiceTablesProcessor.process(resultList, contextData);
          rawList.addAll(rawCostAnalysisReportDataProcessor.process(tableData, contextData));
          aggregatedCostAnalysisReportDataProcessor.process(tableData, contextData);
          source.updateStats(resultList.getData().size(), 0);
          if (cursor == null) break;
        } catch (SearchIndexException ex) {
          source.updateStats(ex.getIndexingError().getSuccessCount(), ex.getIndexingError().getFailedCount());
          errors.add(String.format("Failed processing %s: %s", source.getName(), ex));
          sourceError = true;
          totalFailed++;
          break;
        }
      }

      if (sourceError) continue;

      processRawCostAnalysisReportData(rawList, contextData).ifPresent(errors::add);
      processAggregatedCostAnalysisReportData(aggregatedMap, contextData).ifPresent(errors::add);
      totalSuccess++;
    }

    stats().record(new StepResult("cost-analysis", totalSuccess, totalFailed, errors));
  }

  private Optional<String> processRawCostAnalysisReportData(
      List<RawCostAnalysisReportData> rawList, Map<String, Object> contextData) {
    try {
      CreateReportDataProcessor processor =
          new CreateReportDataProcessor(rawList.size(),
              "[CostAnalysisWorkflow] Raw Cost Analysis Report Data Processor",
              ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA);
      List<ReportData> reportData = processor.process(rawList, contextData);
      new ReportDataSink(reportData.size(),
          "[CostAnalysisWorkflow] Raw Cost Analysis Report Data Sink",
          ReportData.ReportDataType.RAW_COST_ANALYSIS_REPORT_DATA).write(reportData);
    } catch (SearchIndexException ex) {
      return Optional.of(String.format("Failed processing raw cost analysis: %s", ex.getMessage()));
    }
    return Optional.empty();
  }

  private Optional<String> processAggregatedCostAnalysisReportData(
      Map<String, Map<String, Map<String, AggregatedCostAnalysisData>>> aggregatedMap,
      Map<String, Object> contextData) {
    try {
      AggregatedCostAnalysisReportDataAggregator aggregator =
          new AggregatedCostAnalysisReportDataAggregator(aggregatedMap.size());
      List<AggregatedCostAnalysisReportData> aggregatedList =
          aggregator.process(aggregatedMap, contextData);
      CreateReportDataProcessor processor =
          new CreateReportDataProcessor(aggregatedList.size(),
              "[CostAnalysisWorkflow] Aggregated Cost Analysis Report Data Processor",
              ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA);
      List<ReportData> reportData = processor.process(aggregatedList, contextData);
      new ReportDataSink(reportData.size(),
          "[CostAnalysisWorkflow] Aggregated Cost Analysis Report Data Sink",
          ReportData.ReportDataType.AGGREGATED_COST_ANALYSIS_REPORT_DATA).write(reportData);
    } catch (SearchIndexException ex) {
      return Optional.of(String.format("Failed processing aggregated cost analysis: %s", ex.getMessage()));
    }
    return Optional.empty();
  }

  private ResultList<DatabaseService> filterDatabaseServices(
      ResultList<? extends EntityInterface> resultList) {
    return new ResultList<>(
        resultList.getData().stream()
            .map(o -> (DatabaseService) o)
            .filter(this::supportsProfilerAndUsage)
            .toList());
  }

  private boolean supportsProfilerAndUsage(DatabaseService service) {
    return List.of(
            CreateDatabaseService.DatabaseServiceType.BigQuery,
            CreateDatabaseService.DatabaseServiceType.Redshift,
            CreateDatabaseService.DatabaseServiceType.Snowflake)
        .contains(service.getServiceType());
  }

  private void deleteReportDataRecordsAtDate(long timestamp, ReportData.ReportDataType type) {
    String date = TimestampUtils.timestampToString(timestamp, "yyyy-MM-dd");
    ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .deleteReportDataAtDate(type, date);
  }

  private void deleteReportDataRecords(ReportData.ReportDataType type) {
    ((ReportDataRepository) Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA))
        .deleteReportData(type);
  }
}
