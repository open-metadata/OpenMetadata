package org.openmetadata.service.search.opensearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;
import os.org.opensearch.client.opensearch.core.bulk.BulkOperation;

@Slf4j
public class OpenSearchEntityTimeSeriesProcessor
    implements Processor<BulkOperation, EntityTimeSeriesInterface> {
  private final StepStats stats = new StepStats();

  public OpenSearchEntityTimeSeriesProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public BulkOperation process(EntityTimeSeriesInterface entity, Map<String, Object> contextData)
      throws SearchIndexException {
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (CommonUtil.nullOrEmpty(entityType)) {
      throw new IllegalArgumentException(
          "[OpenSearchDataInsightProcessor] entityType cannot be null or empty.");
    }

    try {
      BulkOperation operation = getUpdateOperation(entityType, entity);
      updateStats(1, 0);
      return operation;
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(1)
              .withFailedCount(1)
              .withSuccessCount(0)
              .withMessage(
                  "Data Insights Processor Encountered Failure. Converting request to BulkOperation.")
              .withStackTrace(
                  org.glassfish.jersey.internal.util.ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(
          "[OpenSearchDataInsightsProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, 1);
      throw new SearchIndexException(error);
    }
  }

  private BulkOperation getUpdateOperation(String entityType, EntityTimeSeriesInterface entity) {
    IndexMapping indexMapping = Entity.getSearchRepository().getIndexMapping(entityType);
    String indexName = indexMapping.getIndexName(Entity.getSearchRepository().getClusterAlias());
    String doc =
        JsonUtils.pojoToJson(
            Objects.requireNonNull(Entity.buildSearchIndex(entityType, entity))
                .buildSearchIndexDoc());

    return BulkOperation.of(
        b ->
            b.update(
                u ->
                    u.index(indexName)
                        .id(entity.getId().toString())
                        .docAsUpsert(true)
                        .document(OsUtils.toJsonData(doc))));
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
