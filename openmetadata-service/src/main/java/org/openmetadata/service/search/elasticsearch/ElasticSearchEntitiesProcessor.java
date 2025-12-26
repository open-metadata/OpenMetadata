package org.openmetadata.service.search.elasticsearch;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import es.co.elastic.clients.elasticsearch.core.bulk.BulkOperation;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.workflows.interfaces.Processor;

@Slf4j
public class ElasticSearchEntitiesProcessor
    implements Processor<List<BulkOperation>, ResultList<? extends EntityInterface>> {
  private final StepStats stats = new StepStats();

  public ElasticSearchEntitiesProcessor(int total) {
    this.stats.withTotalRecords(total).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public List<BulkOperation> process(
      ResultList<? extends EntityInterface> input, Map<String, Object> contextData)
      throws SearchIndexException {
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (CommonUtil.nullOrEmpty(entityType)) {
      throw new IllegalArgumentException(
          "[EsEntitiesProcessor] entityType cannot be null or empty.");
    }

    LOG.debug(
        "[EsEntitiesProcessor] Processing a Batch of Size: {}, EntityType: {} ",
        input.getData().size(),
        entityType);
    List<BulkOperation> operations;
    try {
      operations = buildBulkOperations(entityType, input.getData());
      LOG.debug(
          "[EsEntitiesProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.getData().size(),
          input.getData().size(),
          0);
      updateStats(input.getData().size(), 0);
    } catch (Exception e) {
      IndexingError error =
          new IndexingError()
              .withErrorSource(IndexingError.ErrorSource.PROCESSOR)
              .withSubmittedCount(input.getData().size())
              .withFailedCount(input.getData().size())
              .withSuccessCount(0)
              .withMessage(
                  "Entities Processor Encountered Failure. Converting requests to BulkOperation.")
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug("[EsEntitiesProcessor] Failed. Details: {}", JsonUtils.pojoToJson(error));
      updateStats(0, input.getData().size());
      throw new SearchIndexException(error);
    }
    return operations;
  }

  private static List<BulkOperation> buildBulkOperations(
      String entityType, List<? extends EntityInterface> entities) {
    List<BulkOperation> operations = new ArrayList<>();
    for (EntityInterface entity : entities) {
      BulkOperation operation = getUpdateOperation(entityType, entity);
      operations.add(operation);
    }
    return operations;
  }

  public static BulkOperation getUpdateOperation(String entityType, EntityInterface entity) {
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
                        .action(a -> a.docAsUpsert(true).doc(EsUtils.toJsonData(doc)))));
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
