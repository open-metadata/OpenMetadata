package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.steps;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.apps.bundles.insights.stats.StepResult;
import org.openmetadata.service.apps.bundles.insights.stats.WorkflowStatsCollector;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.openmetadata.service.workflows.interfaces.Sink;
import org.openmetadata.service.workflows.interfaces.TaggedOperation;
import org.openmetadata.service.workflows.searchIndex.PaginatedEntitiesSource;

@Slf4j
public final class DeltaProcessingStep {

  private final DataInsightsEntityEnricherProcessor enricher;
  private final Processor entityProcessor;
  private final Sink searchIndexSink;

  public DeltaProcessingStep(
      DataInsightsEntityEnricherProcessor enricher,
      Processor entityProcessor,
      Sink searchIndexSink) {
    this.enricher = enricher;
    this.entityProcessor = entityProcessor;
    this.searchIndexSink = searchIndexSink;
  }

  @SuppressWarnings("unchecked")
  public void execute(
      PaginatedEntitiesSource source,
      Map<String, Object> contextData,
      WorkflowStatsCollector stats) {
    int totalSuccess = 0;
    int totalFailed = 0;
    List<String> errors = new ArrayList<>();
    String keysetCursor = null;

    while (true) {
      try {
        ResultList<? extends EntityInterface> batch = source.readNextKeyset(keysetCursor);
        keysetCursor = batch.getPaging().getAfter();

        if (!batch.getData().isEmpty()) {
          List<TaggedOperation<?>> taggedOps = new ArrayList<>();
          int batchSuccess = 0;
          int batchFailed = 0;

          for (EntityInterface entity : batch.getData()) {
            try {
              List<Map<String, Object>> enriched = enricher.enrichSingle(entity, contextData);
              List<?> ops = (List<?>) entityProcessor.process(enriched, contextData);
              EntityReference ref = entity.getEntityReference();
              for (Object op : ops) {
                taggedOps.add(new TaggedOperation<>(op, ref));
              }
              batchSuccess++;
            } catch (Exception e) {
              batchFailed++;
              errors.add(entity.getFullyQualifiedName() + ": " + e.getMessage());
            }
          }

          if (!taggedOps.isEmpty()) {
            searchIndexSink.write(taggedOps);
          }
          totalSuccess += batchSuccess;
          totalFailed += batchFailed;
          source.updateStats(batchSuccess, batchFailed);
        }

        if (keysetCursor == null) break;
      } catch (SearchIndexException ex) {
        int failed = ex.getIndexingError().getFailedCount() != null
            ? ex.getIndexingError().getFailedCount() : 1;
        totalFailed += failed;
        errors.add(source.getEntityType() + ": " + ex.getMessage());
        source.updateStats(
            ex.getIndexingError().getSuccessCount() != null
                ? ex.getIndexingError().getSuccessCount() : 0,
            failed);
        break;
      }
    }

    stats.record(
        new StepResult("delta-" + source.getEntityType(), totalSuccess, totalFailed, errors));
  }
}
