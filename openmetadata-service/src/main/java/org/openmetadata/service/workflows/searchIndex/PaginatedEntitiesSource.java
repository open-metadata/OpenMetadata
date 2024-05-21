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

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import lombok.Getter;
import lombok.Setter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
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
  @Getter private final List<String> readerErrors = new ArrayList<>();
  @Getter private final StepStats stats = new StepStats();
  @Getter private String lastFailedCursor = null;
  @Setter private String cursor = RestUtil.encodeCursor("0");
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
  public ResultList<? extends EntityInterface> readNext(Map<String, Object> contextData)
      throws SearchIndexException {
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

  private ResultList<? extends EntityInterface> read(String cursor) throws SearchIndexException {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result;
    try {
      result =
          entityRepository.listAfterWithSkipFailure(
              null,
              Entity.getFields(entityType, fields),
              new ListFilter(Include.ALL),
              batchSize,
              cursor);
      if (!result.getErrors().isEmpty()) {
        lastFailedCursor = this.cursor;
        if (result.getPaging().getAfter() == null) {
          isDone = true;
        } else {
          this.cursor = result.getPaging().getAfter();
        }
        // updateStats(result.getData().size(), result.getErrors().size());
        return result;
      }

      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- %n Submitted : {} Success: {} Failed: {}",
          batchSize, result.getData().size(), result.getErrors().size());
      // updateStats(result.getData().size(), result.getErrors().size());
    } catch (Exception e) {
      lastFailedCursor = this.cursor;
      int remainingRecords =
          stats.getTotalRecords() - stats.getFailedRecords() - stats.getSuccessRecords();
      int submittedRecords;
      if (remainingRecords - batchSize <= 0) {
        submittedRecords = remainingRecords;
        updateStats(0, remainingRecords);
        this.cursor = null;
        this.isDone = true;
      } else {
        submittedRecords = batchSize;
        String decodedCursor = RestUtil.decodeCursor(cursor);
        this.cursor =
            RestUtil.encodeCursor(String.valueOf(Integer.parseInt(decodedCursor) + batchSize));
        updateStats(0, batchSize);
      }
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(READER)
              .withSubmittedCount(submittedRecords)
              .withSuccessCount(0)
              .withFailedCount(submittedRecords)
              .withMessage(
                  "Issues in Reading A Batch For Entities. No Relationship Issue , Json Processing or DB issue.")
              .withLastFailedCursor(lastFailedCursor)
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(indexingError.getMessage());
      throw new SearchIndexException(indexingError);
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
}
