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

import java.util.ArrayList;
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
import org.openmetadata.service.util.JsonUtils;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
public class PaginatedEntitiesSource implements Source<ResultList<? extends EntityInterface>> {
  @Getter private final int batchSize;
  @Getter private final String entityType;
  @Getter private final List<String> fields;
  @Getter private final List<String> readerErrors = new ArrayList<>();
  @Getter private final StepStats stats = new StepStats();
  private String lastFailedCursor = null;
  private String cursor = RestUtil.encodeCursor("0");
  @Getter private boolean isDone = false;

  public PaginatedEntitiesSource(String entityType, int batchSize, List<String> fields) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats
        .withTotalRecords(Entity.getEntityRepository(entityType).getDao().listTotalCount())
        .withSuccessRecords(0)
        .withFailedRecords(0);
  }

  @Override
  public ResultList<? extends EntityInterface> readNext(Map<String, Object> contextData) throws SourceException {
    ResultList<? extends EntityInterface> data = null;
    if (!isDone) {
      data = read(cursor);
      cursor = data.getPaging().getAfter();
      if (cursor == null) {
        isDone = true;
      }
    }
    return data;
  }

  private ResultList<? extends EntityInterface> read(String cursor) throws SourceException {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result = null;
    try {
      result =
          entityRepository.listAfterWithSkipFailure(
              null, Entity.getFields(entityType, fields), new ListFilter(Include.ALL), batchSize, cursor);
      if (!result.getErrors().isEmpty()) {
        lastFailedCursor = this.cursor;
        String errMsg =
            String.format(
                "[PaginatedEntitiesSource] Encountered Failures. Marked After Cursor : %s, Batch Stats :- Submitted : %s Success: %s Failed: %s, Errors : %s",
                this.lastFailedCursor,
                batchSize,
                result.getData().size(),
                result.getErrors().size(),
                JsonUtils.pojoToJson(result.getErrors()));
        LOG.error(errMsg);
        throw new SourceException(errMsg);
      }

      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          batchSize,
          result.getData().size(),
          result.getErrors().size());
      updateStats(result.getData().size(), result.getErrors().size());
    } catch (Exception e) {
      lastFailedCursor = this.cursor;
      if (result != null) {
        if (result.getPaging().getAfter() == null) {
          isDone = true;
        } else {
          this.cursor = result.getPaging().getAfter();
        }
        updateStats(result.getData().size(), result.getErrors().size());
      } else {
        String errMsg =
            String.format(
                "[PaginatedEntitiesSource] Encountered Failures. Marked After Cursor : %s, Batch Stats :- Submitted : %s Success: %s Failed: %s, Errors : %s",
                this.lastFailedCursor, batchSize, 0, batchSize, "No Relationship Issue , Json Processing or DB issue.");
        LOG.debug(errMsg);
        updateStats(0, batchSize);
      }

      throw new SourceException(e);
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

  public String getLastFailedCursor() {
    return lastFailedCursor;
  }

  public void setCursor(String cursor) {
    this.cursor = cursor;
  }
}
