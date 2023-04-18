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

package org.openmetadata.service.workflows.searchIndex;

import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SourceException;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
public class PaginatedEntitiesSource implements Source<ResultList<? extends EntityInterface>> {
  @Getter private final int batchSize;
  @Getter private final String entityType;
  @Getter private final List<String> fields;
  private final StepStats stats = new StepStats();
  private String cursor = null;
  @Getter private boolean isDone = false;

  PaginatedEntitiesSource(String entityType, int batchSize, List<String> fields) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats.setTotalRecords(Entity.getEntityRepository(entityType).dao.listTotalCount());
  }

  @Override
  public ResultList<? extends EntityInterface> readNext(Map<String, Object> contextData) throws SourceException {
    if (!isDone) {
      ResultList<? extends EntityInterface> data = read(cursor);
      cursor = data.getPaging().getAfter();
      if (cursor == null) {
        isDone = true;
      }
      return data;
    } else {
      return null;
    }
  }

  private ResultList<? extends EntityInterface> read(String cursor) throws SourceException {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result;
    try {
      result =
          entityRepository.listAfterWithSkipFailure(
              null, Entity.getFields(entityType, fields), new ListFilter(Include.ALL), batchSize, cursor);
      if (result.getErrors().size() > 0) {
        result
            .getErrors()
            .forEach(
                (error) ->
                    LOG.error("[PaginatedEntitiesSource] Failed in getting Record, RECORD: {}", error.toString()));
      }

      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          batchSize,
          result.getData().size(),
          result.getErrors().size());
      updateStats(result.getData().size(), result.getErrors().size());

    } catch (IOException e) {
      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- Submitted : {} Success: {} Failed: {}", batchSize, 0, batchSize);
      if (stats.getTotalRecords() - stats.getProcessedRecords() <= batchSize) {
        isDone = true;
        updateStats(0, stats.getTotalRecords() - stats.getProcessedRecords());
      } else {
        updateStats(0, batchSize);
      }
      throw new SourceException("[PaginatedEntitiesSource] Batch encountered Exception. Failing Completely.", e);
    }

    return result;
  }

  @Override
  public void reset() {
    cursor = null;
    isDone = false;
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
