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
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
@Getter
public class PaginatedEntityTimeSeriesSource
    implements Source<ResultList<? extends EntityTimeSeriesInterface>> {
  private final int batchSize;
  private final String entityType;
  private final List<String> fields;
  private final List<String> readerErrors = new ArrayList<>();
  private final StepStats stats = new StepStats();
  private String lastFailedCursor = null;

  // Make cursor thread-safe using AtomicReference
  private final AtomicReference<String> cursor = new AtomicReference<>(RestUtil.encodeCursor("0"));

  private final AtomicReference<Boolean> isDone = new AtomicReference<>(false);
  private Long startTs;
  private Long endTs;

  public PaginatedEntityTimeSeriesSource(String entityType, int batchSize, List<String> fields) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats
        .withTotalRecords(getEntityTimeSeriesRepository().getTimeSeriesDao().listCount(getFilter()))
        .withSuccessRecords(0)
        .withFailedRecords(0);
  }

  public PaginatedEntityTimeSeriesSource(
      String entityType, int batchSize, List<String> fields, Long startTs, Long endTs) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats
        .withTotalRecords(getEntityTimeSeriesRepository().getTimeSeriesDao().listCount(getFilter()))
        .withSuccessRecords(0)
        .withFailedRecords(0);
    this.startTs = startTs;
    this.endTs = endTs;
  }

  @Override
  public ResultList<? extends EntityTimeSeriesInterface> readNext(Map<String, Object> contextData)
      throws SearchIndexException {
    ResultList<? extends EntityTimeSeriesInterface> data = null;
    if (Boolean.FALSE.equals(isDone.get())) {
      data = read(cursor.get()); // Use cursor.get() to retrieve the current value
      cursor.set(data.getPaging().getAfter()); // Use cursor.set() to update the value
      if (cursor.get() == null) {
        isDone.set(true);
      }
    }
    return data;
  }

  @Override
  public ResultList<? extends EntityTimeSeriesInterface> readWithCursor(String currentCursor)
      throws SearchIndexException {
    LOG.debug("[PaginatedEntityTimeSeriesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> repository =
        getEntityTimeSeriesRepository();
    ResultList<? extends EntityTimeSeriesInterface> result;
    ListFilter filter = getFilter();
    try {
      if (startTs != null && endTs != null) {
        result =
            repository.listWithOffset(
                currentCursor, filter, batchSize, startTs, endTs, false, true);
      } else {
        result = repository.listWithOffset(currentCursor, filter, batchSize, true);
      }
      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- %n Submitted : {} Success: {} Failed: {}",
          batchSize, result.getData().size(), result.getErrors().size());
    } catch (Exception e) {
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(READER)
              .withSuccessCount(0)
              .withMessage(
                  "Issues in Reading A Batch For Entities. No Relationship Issue , Json Processing or DB issue.")
              .withLastFailedCursor(lastFailedCursor)
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      LOG.debug(indexingError.getMessage());
      throw new SearchIndexException(indexingError);
    }
    return result;
  }

  private ResultList<? extends EntityTimeSeriesInterface> read(String cursor)
      throws SearchIndexException {
    LOG.debug("[PaginatedEntityTimeSeriesSource] Fetching a Batch of Size: {} ", batchSize);
    EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> repository =
        getEntityTimeSeriesRepository();
    ResultList<? extends EntityTimeSeriesInterface> result;
    ListFilter filter = getFilter();
    try {
      if (startTs != null && endTs != null) {
        result = repository.listWithOffset(cursor, filter, batchSize, startTs, endTs, false, true);
      } else {
        result = repository.listWithOffset(cursor, filter, batchSize, true);
      }

      if (!result.getErrors().isEmpty()) {
        lastFailedCursor = this.cursor.get();
        if (result.getPaging().getAfter() == null) {
          isDone.set(true);
        } else {
          this.cursor.set(result.getPaging().getAfter());
        }
        return result;
      }
      LOG.debug(
          "[PaginatedEntitiesSource] Batch Stats :- %n Submitted : {} Success: {} Failed: {}",
          batchSize, result.getData().size(), result.getErrors().size());
    } catch (Exception e) {
      lastFailedCursor = this.cursor.get();
      int remainingRecords =
          stats.getTotalRecords() - stats.getFailedRecords() - stats.getSuccessRecords();
      int submittedRecords;
      if (remainingRecords - batchSize <= 0) {
        submittedRecords = remainingRecords;
        updateStats(0, remainingRecords);
        this.cursor.set(null); // Set cursor to null
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
    cursor.set(null);
    isDone.set(false);
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  public ListFilter getFilter() {
    ListFilter filter = new ListFilter(null);
    if (ReindexingUtil.isDataInsightIndex(entityType)) {
      filter.addQueryParam("entityFQNHash", FullyQualifiedName.buildHash(entityType));
    }
    return filter;
  }

  private EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface>
      getEntityTimeSeriesRepository() {
    if (ReindexingUtil.isDataInsightIndex(entityType)) {
      return Entity.getEntityTimeSeriesRepository(Entity.ENTITY_REPORT_DATA);
    } else {
      return Entity.getEntityTimeSeriesRepository(entityType);
    }
  }

  @Override
  public AtomicReference<Boolean> isDone() {
    return isDone;
  }
}
