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

import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
public class PaginatedEntitiesSource implements Source<ResultList<? extends EntityInterface>> {
  @Getter private final int batchSize;
  @Getter private final String entityType;
  @Getter private final List<String> fields;
  private final StepStats stats = new StepStats();
  private String lastFailedCursor = null;

  private String cursor = RestUtil.encodeCursor("0");
  @Getter private boolean isDone = false;

  public PaginatedEntitiesSource(String entityType, int batchSize, List<String> fields) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats.setTotalRecords(Entity.getEntityRepository(entityType).getDao().listTotalCount());
  }

  @Override
  public ResultList<? extends EntityInterface> readNext(Map<String, Object> contextData) {
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

  private ResultList<? extends EntityInterface> read(String cursor) {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result;
    result =
        entityRepository.listAfterWithSkipFailure(
            null, Entity.getFields(entityType, fields), new ListFilter(Include.ALL), batchSize, cursor);
    if (!result.getErrors().isEmpty()) {
      lastFailedCursor = this.cursor;
      result
          .getErrors()
          .forEach(
              error ->
                  LOG.error(
                      "[PaginatedEntitiesSource] Failed in getting Record, After Cursor : {} , RECORD: {}",
                      result.getPaging().getAfter(),
                      error));
    }

    LOG.debug(
        "[PaginatedEntitiesSource] Batch Stats :- Submitted : {} Success: {} Failed: {}",
        batchSize,
        result.getData().size(),
        result.getErrors().size());
    updateStats(result.getData().size(), result.getErrors().size());
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

  public String getLastFailedCursor() {
    return lastFailedCursor;
  }

  public void setCursor(String cursor) {
    this.cursor = cursor;
  }
}
