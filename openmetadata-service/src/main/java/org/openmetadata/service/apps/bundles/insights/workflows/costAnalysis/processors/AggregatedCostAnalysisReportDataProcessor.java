package org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.processors;

import static org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow.AGGREGATED_COST_ANALYSIS_DATA_MAP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.TIMESTAMP_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.AggregatedCostAnalysisReportData;
import org.openmetadata.schema.analytics.DataAssetMetrics;
import org.openmetadata.schema.analytics.DataAssetValues;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.LifeCycle;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.costAnalysis.CostAnalysisWorkflow;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class AggregatedCostAnalysisReportDataProcessor
    implements Processor<
        List<AggregatedCostAnalysisReportData>, List<CostAnalysisWorkflow.CostAnalysisTableData>> {
  private final StepStats stats = new StepStats();

  public AggregatedCostAnalysisReportDataProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<AggregatedCostAnalysisReportData> process(
      List<CostAnalysisWorkflow.CostAnalysisTableData> input, Map<String, Object> contextData)
      throws SearchIndexException {
    List<AggregatedCostAnalysisReportData> aggregatedCostAnalysisReportDataList = new ArrayList<>();

    Long timestamp = (Long) contextData.get(TIMESTAMP_KEY);
    Map<String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>>
        aggregatedCostAnalysisDataMap =
            (Map<String, Map<String, Map<String, CostAnalysisWorkflow.AggregatedCostAnalysisData>>>)
                contextData.get(AGGREGATED_COST_ANALYSIS_DATA_MAP_KEY);

    try {
      for (CostAnalysisWorkflow.CostAnalysisTableData tableData : input) {
        String entityType = Entity.TABLE;
        String serviceType = tableData.table().getServiceType().toString();
        String serviceName = tableData.table().getService().getName();

        if (!aggregatedCostAnalysisDataMap.containsKey(entityType)) {
          aggregatedCostAnalysisDataMap.put(entityType, new HashMap<>());
        }

        if (!aggregatedCostAnalysisDataMap.get(entityType).containsKey(serviceType)) {
          aggregatedCostAnalysisDataMap.get(entityType).put(serviceType, new HashMap<>());
        }

        if (!aggregatedCostAnalysisDataMap
            .get(entityType)
            .get(serviceType)
            .containsKey(serviceName)) {
          aggregatedCostAnalysisDataMap
              .get(entityType)
              .get(serviceType)
              .put(
                  serviceName,
                  new CostAnalysisWorkflow.AggregatedCostAnalysisData(
                      (double) 0,
                      (double) 0,
                      new DataAssetMetrics()
                          .withCount(
                              new DataAssetValues()
                                  .withThreeDays((double) 0)
                                  .withSevenDays((double) 0)
                                  .withFourteenDays((double) 0)
                                  .withThirtyDays((double) 0)
                                  .withSixtyDays((double) 0))
                          .withSize(
                              new DataAssetValues()
                                  .withThreeDays((double) 0)
                                  .withSevenDays((double) 0)
                                  .withFourteenDays((double) 0)
                                  .withThirtyDays((double) 0)
                                  .withSixtyDays((double) 0))
                          .withTotalCount((double) 0)
                          .withTotalSize((double) 0),
                      new DataAssetMetrics()
                          .withCount(
                              new DataAssetValues()
                                  .withThreeDays((double) 0)
                                  .withSevenDays((double) 0)
                                  .withFourteenDays((double) 0)
                                  .withThirtyDays((double) 0)
                                  .withSixtyDays((double) 0))
                          .withSize(
                              new DataAssetValues()
                                  .withThreeDays((double) 0)
                                  .withSevenDays((double) 0)
                                  .withFourteenDays((double) 0)
                                  .withThirtyDays((double) 0)
                                  .withSixtyDays((double) 0))
                          .withTotalCount((double) 0)
                          .withTotalSize((double) 0)));
        }
        CostAnalysisWorkflow.AggregatedCostAnalysisData aggregatedCostAnalysisData =
            aggregatedCostAnalysisDataMap.get(entityType).get(serviceType).get(serviceName);

        Double tableSize = (double) 0;

        if (tableData.oSize().isPresent()) {
          tableSize = tableData.oSize().get();
        }

        DataAssetMetrics unusedDataAssets = aggregatedCostAnalysisData.unusedDataAssets();
        DataAssetMetrics frequentlyUsedDataAssets =
            aggregatedCostAnalysisData.frequentlyUsedDataAssets();

        // TODO: Should be a way to do this better
        // Compute LifeCycle
        if (tableData.oLifeCycle().isPresent()) {
          LifeCycle lifeCycle = tableData.oLifeCycle().get();
          // Compute 3Days
          Long periodTimestamp =
              TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 3));

          if (lifeCycle.getAccessed().getTimestamp() <= periodTimestamp) {
            unusedDataAssets.withCount(
                unusedDataAssets
                    .getCount()
                    .withThreeDays((double) unusedDataAssets.getCount().getThreeDays() + 1));
            unusedDataAssets.withSize(
                unusedDataAssets
                    .getSize()
                    .withThreeDays((double) unusedDataAssets.getSize().getThreeDays() + tableSize));
          } else {
            frequentlyUsedDataAssets.withCount(
                frequentlyUsedDataAssets
                    .getCount()
                    .withThreeDays(
                        (double) frequentlyUsedDataAssets.getCount().getThreeDays() + 1));
            frequentlyUsedDataAssets.withSize(
                frequentlyUsedDataAssets
                    .getSize()
                    .withThreeDays(
                        (double) frequentlyUsedDataAssets.getSize().getThreeDays() + tableSize));
          }
          // Compute 7Days
          periodTimestamp =
              TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 7));

          if (lifeCycle.getAccessed().getTimestamp() <= periodTimestamp) {
            unusedDataAssets.withCount(
                unusedDataAssets
                    .getCount()
                    .withSevenDays((double) unusedDataAssets.getCount().getSevenDays() + 1));
            unusedDataAssets.withSize(
                unusedDataAssets
                    .getSize()
                    .withSevenDays((double) unusedDataAssets.getSize().getSevenDays() + tableSize));
          } else {
            frequentlyUsedDataAssets.withCount(
                frequentlyUsedDataAssets
                    .getCount()
                    .withSevenDays(
                        (double) frequentlyUsedDataAssets.getCount().getSevenDays() + 1));
            frequentlyUsedDataAssets.withSize(
                frequentlyUsedDataAssets
                    .getSize()
                    .withSevenDays(
                        (double) frequentlyUsedDataAssets.getSize().getSevenDays() + tableSize));
          }
          // Compute 14Days
          periodTimestamp =
              TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 14));

          if (lifeCycle.getAccessed().getTimestamp() <= periodTimestamp) {
            unusedDataAssets.withCount(
                unusedDataAssets
                    .getCount()
                    .withFourteenDays((double) unusedDataAssets.getCount().getFourteenDays() + 1));
            unusedDataAssets.withSize(
                unusedDataAssets
                    .getSize()
                    .withFourteenDays(
                        (double) unusedDataAssets.getSize().getFourteenDays() + tableSize));
          } else {
            frequentlyUsedDataAssets.withCount(
                frequentlyUsedDataAssets
                    .getCount()
                    .withFourteenDays(
                        (double) frequentlyUsedDataAssets.getCount().getFourteenDays() + 1));
            frequentlyUsedDataAssets.withSize(
                frequentlyUsedDataAssets
                    .getSize()
                    .withFourteenDays(
                        (double) frequentlyUsedDataAssets.getSize().getFourteenDays() + tableSize));
          }
          // Compute 30Days
          periodTimestamp =
              TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 30));

          if (lifeCycle.getAccessed().getTimestamp() <= periodTimestamp) {
            unusedDataAssets.withCount(
                unusedDataAssets
                    .getCount()
                    .withThirtyDays((double) unusedDataAssets.getCount().getThirtyDays() + 1));
            unusedDataAssets.withSize(
                unusedDataAssets
                    .getSize()
                    .withThirtyDays(
                        (double) unusedDataAssets.getSize().getThirtyDays() + tableSize));
          } else {
            frequentlyUsedDataAssets.withCount(
                frequentlyUsedDataAssets
                    .getCount()
                    .withThirtyDays(
                        (double) frequentlyUsedDataAssets.getCount().getThirtyDays() + 1));
            frequentlyUsedDataAssets.withSize(
                frequentlyUsedDataAssets
                    .getSize()
                    .withThirtyDays(
                        (double) frequentlyUsedDataAssets.getSize().getThirtyDays() + tableSize));
          }
          // Compute 60Days
          periodTimestamp =
              TimestampUtils.getEndOfDayTimestamp(TimestampUtils.subtractDays(timestamp, 60));

          if (lifeCycle.getAccessed().getTimestamp() <= periodTimestamp) {
            unusedDataAssets.withCount(
                unusedDataAssets
                    .getCount()
                    .withSixtyDays((double) unusedDataAssets.getCount().getSixtyDays() + 1));
            unusedDataAssets.withSize(
                unusedDataAssets
                    .getSize()
                    .withSixtyDays((double) unusedDataAssets.getSize().getSixtyDays() + tableSize));
          } else {
            frequentlyUsedDataAssets.withCount(
                frequentlyUsedDataAssets
                    .getCount()
                    .withSixtyDays(
                        (double) frequentlyUsedDataAssets.getCount().getSixtyDays() + 1));
            frequentlyUsedDataAssets.withSize(
                frequentlyUsedDataAssets
                    .getSize()
                    .withSixtyDays(
                        (double) frequentlyUsedDataAssets.getSize().getSixtyDays() + tableSize));
          }
        }

        Double totalSize = aggregatedCostAnalysisData.totalSize() + tableSize;
        Double totalCount = aggregatedCostAnalysisData.totalCount() + 1;

        CostAnalysisWorkflow.AggregatedCostAnalysisData newAggregatedCostAnalysisData =
            new CostAnalysisWorkflow.AggregatedCostAnalysisData(
                totalSize, totalCount, unusedDataAssets, frequentlyUsedDataAssets);
        aggregatedCostAnalysisDataMap
            .get(entityType)
            .get(serviceType)
            .put(serviceName, newAggregatedCostAnalysisData);
      }
      updateStats(input.size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.size())
              .withFailedCount(input.size())
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Aggregated Cost Analysis Processor Encounter Failure: %s", e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[AggregatedCostAnalysisProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.size());
      throw new SearchIndexException(error);
    }
    return aggregatedCostAnalysisReportDataList;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public StepStats getStats() {
    return stats;
  }
}
