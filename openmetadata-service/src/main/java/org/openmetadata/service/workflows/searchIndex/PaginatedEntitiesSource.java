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
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityDAO;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
@Getter
public class PaginatedEntitiesSource implements Source<ResultList<? extends EntityInterface>> {
  private String name = "PaginatedEntitiesSource";
  private final int batchSize;
  private final String entityType;
  private final List<String> fields;
  private final List<String> readerErrors = new ArrayList<>();
  private final StepStats stats = new StepStats();
  private final ListFilter filter;
  private String lastFailedCursor = null;
  private final AtomicReference<String> cursor = new AtomicReference<>(RestUtil.encodeCursor("0"));
  private final AtomicReference<Boolean> isDone = new AtomicReference<>(false);

  public PaginatedEntitiesSource(String entityType, int batchSize, List<String> fields) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.filter = new ListFilter(Include.ALL);
    this.stats
        .withTotalRecords(Entity.getEntityRepository(entityType).getDao().listTotalCount())
        .withSuccessRecords(0)
        .withFailedRecords(0);
  }

  public PaginatedEntitiesSource(
      String entityType, int batchSize, List<String> fields, ListFilter filter) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.filter = filter;
    this.stats
        .withTotalRecords(Entity.getEntityRepository(entityType).getDao().listCount(filter))
        .withSuccessRecords(0)
        .withFailedRecords(0);
  }

  public PaginatedEntitiesSource withName(String name) {
    this.name = name;
    return this;
  }

  @Override
  public ResultList<? extends EntityInterface> readNext(Map<String, Object> contextData)
      throws SearchIndexException {
    ResultList<? extends EntityInterface> data = null;
    if (Boolean.FALSE.equals(isDone.get())) {
      data = read(cursor.get());
      cursor.set(data.getPaging().getAfter());
      if (cursor.get() == null) {
        isDone.set(true);
      }
    }
    return data;
  }

  private ResultList<? extends EntityInterface> read(String cursor) throws SearchIndexException {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result;
    try {
      EntityDAO<?> entityDAO = entityRepository.getDao();
      result =
          entityRepository.listWithOffset(
              entityDAO::listAfter,
              entityDAO::listCount,
              filter,
              batchSize,
              cursor,
              true,
              Entity.getFields(entityType, fields),
              null);

      // Filter out EntityNotFoundExceptions from errors - these are expected when relationships
      // point to deleted entities and should not be counted as failures
      List<EntityError> realErrors = new ArrayList<>();
      if (!result.getErrors().isEmpty()) {
        for (EntityError error : result.getErrors()) {
          // Skip entities with missing relationships - these will be garbage collected separately
          if (error.getMessage() != null && error.getMessage().contains("Not found")) {
            LOG.debug("Skipping entity due to missing relationship: {}", error.getMessage());
          } else {
            realErrors.add(error);
          }
        }

        if (!realErrors.isEmpty()) {
          lastFailedCursor = this.cursor.get();
        }

        if (result.getPaging().getAfter() == null) {
          this.cursor.set(null);
          this.isDone.set(true);
        } else {
          this.cursor.set(result.getPaging().getAfter());
        }

        // Update stats with only real errors, not missing relationship errors
        updateStats(result.getData().size(), realErrors.size());

        // Update the result to only include real errors
        result.setErrors(realErrors);
        return result;
      }

      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- %n Submitted : {} Success: {} Failed: {}",
          batchSize, result.getData().size(), result.getErrors().size());
      updateStats(result.getData().size(), result.getErrors().size());
    } catch (Exception e) {
      LOG.error("Error reading batch for entityType: {} at cursor: {}", entityType, cursor, e);
      lastFailedCursor = this.cursor.get();
      int remainingRecords =
          stats.getTotalRecords() - stats.getFailedRecords() - stats.getSuccessRecords();
      int submittedRecords;
      if (remainingRecords - batchSize <= 0) {
        submittedRecords = remainingRecords;
        updateStats(0, remainingRecords);
        this.cursor.set(null);
        this.isDone.set(true);
      } else {
        submittedRecords = batchSize;
        String decodedCursor = RestUtil.decodeCursor(cursor);
        this.cursor.set(
            RestUtil.encodeCursor(String.valueOf(Integer.parseInt(decodedCursor) + batchSize)));
        updateStats(0, batchSize);
      }
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(READER)
              .withSubmittedCount(submittedRecords)
              .withSuccessCount(0)
              .withFailedCount(submittedRecords)
              .withMessage(
                  String.format(
                      "Failed to read batch for entityType: %s. Error: %s",
                      entityType, e.getMessage()))
              .withLastFailedCursor(lastFailedCursor)
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(indexingError.getMessage());
      throw new SearchIndexException(indexingError);
    }
    return result;
  }

  public ResultList<? extends EntityInterface> readWithCursor(String currentCursor)
      throws SearchIndexException {
    LOG.debug("[PaginatedEntitiesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityRepository<?> entityRepository = Entity.getEntityRepository(entityType);
    ResultList<? extends EntityInterface> result;
    try {
      EntityDAO<?> entityDAO = entityRepository.getDao();
      result =
          entityRepository.listWithOffset(
              entityDAO::listAfter,
              entityDAO::listCount,
              filter,
              batchSize,
              currentCursor,
              true,
              Entity.getFields(entityType, fields),
              null);

      // Filter out EntityNotFoundExceptions from errors - same as in read() method
      if (!result.getErrors().isEmpty()) {
        List<EntityError> realErrors = new ArrayList<>();
        for (EntityError error : result.getErrors()) {
          if (error.getMessage() != null && error.getMessage().contains("Not found")) {
            LOG.debug("Skipping entity due to missing relationship: {}", error.getMessage());
          } else {
            realErrors.add(error);
          }
        }
        result.setErrors(realErrors);
      }

      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- %n Submitted : {} Success: {} Failed: {}",
          batchSize, result.getData().size(), result.getErrors().size());

    } catch (Exception e) {
      LOG.error(
          "Error reading batch for entityType: {} with cursor: {}", entityType, currentCursor, e);
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(READER)
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Failed to read batch for entityType: %s. Error: %s",
                      entityType, e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(indexingError.getMessage());
      throw new SearchIndexException(indexingError);
    }
    return result;
  }

  @Override
  public void reset() {
    cursor.set(null);
    isDone.set(Boolean.FALSE);
  }

  @Override
  public AtomicReference<Boolean> isDone() {
    return isDone;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }
}
