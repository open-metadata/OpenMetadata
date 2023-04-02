/*
 *  Copyright 2022 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.jobs.reindexing;

import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.ENTITY_TYPE_KEY;
import static org.openmetadata.service.jobs.reindexing.ReindexingUtil.getUpdatedStats;

import com.fasterxml.jackson.core.JsonProcessingException;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import lombok.extern.slf4j.Slf4j;
import org.elasticsearch.action.bulk.BulkRequest;
import org.elasticsearch.action.update.UpdateRequest;
import org.elasticsearch.common.xcontent.XContentType;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexDefinition;
import org.openmetadata.service.elasticsearch.ElasticSearchIndexFactory;
import org.openmetadata.service.exception.ProcessorException;
import org.openmetadata.service.jobs.interfaces.Processor;
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.ResultList;

@Slf4j
public class EsEntitiesProcessor implements Processor<ResultList<? extends EntityInterface>, BulkRequest> {
  private final StepStats stats = new StepStats();

  @Override
  public BulkRequest process(ResultList<? extends EntityInterface> input, Map<String, Object> contextData)
      throws ProcessorException {
    String entityType = (String) contextData.get(ENTITY_TYPE_KEY);
    if (CommonUtil.nullOrEmpty(entityType)) {
      throw new IllegalArgumentException("[EsEntitiesProcessor] entityType cannot be null or empty.");
    }

    LOG.debug(
        "[EsEntitiesProcessor] Processing a Batch of Size: {}, EntityType: {} ", input.getData().size(), entityType);
    BulkRequest requests;
    try {
      requests = buildBulkRequests(entityType, input.getData());
      LOG.debug(
          "[EsEntitiesProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.getData().size(),
          input.getData().size(),
          0);
      updateStats(input.getData().size(), 0);
    } catch (JsonProcessingException e) {
      LOG.debug(
          "[EsEntitiesProcessor] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          input.getData().size(),
          0,
          input.getData().size());
      updateStats(0, input.getData().size());
      throw new ProcessorException("[EsEntitiesProcessor] Batch encountered Exception. Failing Completely.", e);
    }
    return requests;
  }

  private BulkRequest buildBulkRequests(String entityType, List<? extends EntityInterface> entities)
      throws JsonProcessingException {
    BulkRequest bulkRequests = new BulkRequest();
    for (EntityInterface entity : entities) {
      UpdateRequest request = getUpdateRequest(entityType, entity);
      bulkRequests.add(request);
    }
    return bulkRequests;
  }

  public static UpdateRequest getUpdateRequest(String entityType, EntityInterface entity)
      throws JsonProcessingException {
    ElasticSearchIndexDefinition.ElasticSearchIndexType indexType =
        ElasticSearchIndexDefinition.getIndexMappingByEntityType(entityType);
    UpdateRequest updateRequest = new UpdateRequest(indexType.indexName, entity.getId().toString());
    updateRequest.doc(
        JsonUtils.pojoToJson(
            Objects.requireNonNull(ElasticSearchIndexFactory.buildIndex(entityType, entity)).buildESDoc()),
        XContentType.JSON);
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
