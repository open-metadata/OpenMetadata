package org.openmetadata.service.search.openSearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.indexes.ReportDataIndexes;
import org.openmetadata.service.exception.ProcessorException;
import org.openmetadata.service.search.IndexUtil;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Processor;
import org.opensearch.action.bulk.BulkRequest;
import org.opensearch.action.update.UpdateRequest;
import org.opensearch.common.xcontent.XContentType;

@Slf4j
public class OpenSearchDataInsightProcessor implements Processor<BulkRequest, ResultList<ReportData>> {
  private final StepStats stats = new StepStats();

  @Override
  public BulkRequest process(ResultList<ReportData> input, Map<String, Object> contextData) throws ProcessorException {
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (CommonUtil.nullOrEmpty(entityType)) {
      throw new IllegalArgumentException("[EsDataInsightProcessor] entityType cannot be null or empty.");
    }

    LOG.debug(
        "[EsDataInsightProcessor] Processing a Batch of Size: {}, EntityType: {} ", input.getData().size(), entityType);
    BulkRequest requests;
    try {
      requests = buildBulkRequests(entityType, input.getData());
      LOG.debug(
          "[EsDataInsightProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.getData().size(),
          input.getData().size(),
          0);
      updateStats(input.getData().size(), 0);
    } catch (JsonProcessingException e) {
      LOG.debug(
          "[EsDataInsightProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.getData().size(),
          0,
          input.getData().size());
      updateStats(0, input.getData().size());
      throw new ProcessorException("[EsDataInsightProcessor] Batch encountered Exception. Failing Completely.", e);
    }
    return requests;
  }

  private BulkRequest buildBulkRequests(String entityType, List<ReportData> entities) throws JsonProcessingException {
    BulkRequest bulkRequests = new BulkRequest();
    for (ReportData reportData : entities) {
      UpdateRequest request = getUpdateRequest(entityType, reportData);
      bulkRequests.add(request);
    }
    return bulkRequests;
  }

  private UpdateRequest getUpdateRequest(String entityType, ReportData reportData) throws JsonProcessingException {
    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType = IndexUtil.getIndexMappingByEntityType(entityType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, reportData.getId().toString());
    updateRequest.doc(JsonUtils.pojoToJson(new ReportDataIndexes(reportData).buildESDoc()), XContentType.JSON);
    updateRequest.docAsUpsert(true);
    return updateRequest;
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
