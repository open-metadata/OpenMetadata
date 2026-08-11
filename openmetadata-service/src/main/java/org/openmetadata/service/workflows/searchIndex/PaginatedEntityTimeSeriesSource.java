package org.openmetadata.service.workflows.searchIndex;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.partitionErrors;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.EntityTimeSeriesInterface;
import org.openmetadata.schema.system.EntityError;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO;
import org.openmetadata.service.jdbi3.EntityTimeSeriesRepository;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
@Getter
public class PaginatedEntityTimeSeriesSource
    implements Source<ResultList<? extends EntityTimeSeriesInterface>> {
  /** Cap on per-error detail messages emitted to logs to avoid flooding under large batches. */
  private static final int MAX_ERROR_DETAILS_LOGGED = 5;

  private final int batchSize;
  private final String entityType;
  private final List<String> fields;
  private final List<String> readerErrors = new ArrayList<>();
  private final StepStats stats = new StepStats();
  private String lastFailedCursor = null;

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
      String entityType, int batchSize, List<String> fields, int knownTotal) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats.withTotalRecords(knownTotal).withSuccessRecords(0).withFailedRecords(0);
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

  public PaginatedEntityTimeSeriesSource(
      String entityType,
      int batchSize,
      List<String> fields,
      int knownTotal,
      Long startTs,
      Long endTs) {
    this.entityType = entityType;
    this.batchSize = batchSize;
    this.fields = fields;
    this.stats.withTotalRecords(knownTotal).withSuccessRecords(0).withFailedRecords(0);
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
      int warningsCount = filterStaleRelationshipErrors(result);
      LOG.debug(
          "[PaginatedEntityTimeSeriesSource] Batch Stats :- Submitted: {} Success: {} Failed: {} Warnings: {}",
          batchSize,
          result.getData().size(),
          result.getErrors().size(),
          warningsCount);
      updateStats(result.getData().size(), result.getErrors().size(), warningsCount);
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

      int warningsCount = filterStaleRelationshipErrors(result);

      if (!result.getErrors().isEmpty()) {
        int errorCount = result.getErrors().size();
        LOG.warn(
            "[PaginatedEntityTimeSeriesSource] {} real reader error(s) for entityType={}; "
                + "first up to {} shown at DEBUG",
            errorCount,
            entityType,
            MAX_ERROR_DETAILS_LOGGED);
        if (LOG.isDebugEnabled()) {
          result.getErrors().stream()
              .limit(MAX_ERROR_DETAILS_LOGGED)
              .forEach(error -> LOG.debug("Reader error: {}", error.getMessage()));
        }
        lastFailedCursor = this.cursor.get();
        if (result.getPaging().getAfter() == null) {
          this.cursor.set(null);
          isDone.set(true);
        } else {
          this.cursor.set(result.getPaging().getAfter());
        }
        updateStats(result.getData().size(), result.getErrors().size(), warningsCount);
        return result;
      }
      LOG.debug(
          "[PaginatedEntityTimeSeriesSource] Batch Stats :- Submitted: {} Success: {} Failed: {} Warnings: {}",
          batchSize,
          result.getData().size(),
          result.getErrors().size(),
          warningsCount);
      updateStats(result.getData().size(), 0, warningsCount);
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

  public ResultList<? extends EntityTimeSeriesInterface> readNextKeyset(String keysetCursor)
      throws SearchIndexException {
    LOG.debug("[PaginatedEntityTimeSeriesSource] Fetching keyset batch of size: {}", batchSize);
    try {
      EntityTimeSeriesDAO.TimeSeriesCursor cursor =
          EntityTimeSeriesDAO.TimeSeriesCursor.parse(keysetCursor);
      EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> repository =
          getEntityTimeSeriesRepository();
      int cachedTotal = stats.getTotalRecords() != null ? stats.getTotalRecords() : 0;
      ResultList<? extends EntityTimeSeriesInterface> result =
          repository.listAfterKeyset(
              getFilter(),
              batchSize,
              startTs,
              endTs,
              cursor.afterTs(),
              cursor.afterFQNHash(),
              cachedTotal,
              true);

      int warningsCount = filterStaleRelationshipErrors(result);
      int failedCount = result.getErrors() != null ? result.getErrors().size() : 0;
      LOG.debug(
          "[PaginatedEntityTimeSeriesSource] Keyset batch stats — Submitted: {} Success: {} Failed: {} Warnings: {}",
          batchSize,
          result.getData().size(),
          failedCount,
          warningsCount);
      updateStats(result.getData().size(), failedCount, warningsCount);
      return result;
    } catch (Exception e) {
      LOG.error(
          "Error reading keyset batch for entityType: {} with cursor: {}",
          entityType,
          keysetCursor,
          e);
      IndexingError indexingError =
          new IndexingError()
              .withErrorSource(READER)
              .withSuccessCount(0)
              .withMessage(
                  String.format(
                      "Failed to read keyset batch for entityType: %s. Error: %s",
                      entityType, e.getMessage()))
              .withStackTrace(ExceptionUtils.exceptionStackTraceAsString(e));
      throw new SearchIndexException(indexingError);
    }
  }

  public List<String> findBoundaryCursors(int numReaders, int totalRecords) {
    List<String> cursors = new ArrayList<>();
    if (numReaders <= 1 || totalRecords <= 0) {
      return cursors;
    }
    EntityTimeSeriesRepository<? extends EntityTimeSeriesInterface> repository =
        getEntityTimeSeriesRepository();
    ListFilter filter = getFilter();
    int recordsPerReader = totalRecords / numReaders;
    for (int i = 1; i < numReaders; i++) {
      int offset = i * recordsPerReader;
      String cursor = repository.getCursorAtOffset(filter, offset);
      if (cursor != null) {
        cursors.add(cursor);
      }
    }
    return cursors;
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

  public void updateStats(int currentSuccess, int currentFailed, int currentWarnings) {
    getUpdatedStats(stats, currentSuccess, currentFailed, currentWarnings);
  }

  /**
   * Splits the errors on {@code result} into real failures and stale-relationship warnings,
   * mutating {@code result} so its errors list contains only real failures and its warnings count
   * reflects the skipped stale relationships. Returns the warnings count for callers that want to
   * include it in their own logging or stats updates.
   *
   * <p>Stale relationships happen for time-series records (testCaseResolutionStatus,
   * testCaseResult, ...) whose parent entity was hard-deleted out-of-band, or whose parentOf
   * entity_relationship row was lost during a past migration. Such records cannot be indexed but
   * should not fail the entire batch.
   */
  private int filterStaleRelationshipErrors(
      ResultList<? extends EntityTimeSeriesInterface> result) {
    if (result == null) {
      return 0;
    }
    // EntityTimeSeriesRepository.getResultList(...) leaves errors=null on the success path.
    // Normalize so downstream callers (logging, stats) can rely on a non-null list.
    if (result.getErrors() == null) {
      result.setErrors(new ArrayList<>());
    }
    if (result.getErrors().isEmpty()) {
      return 0;
    }
    List<EntityError> warnings = new ArrayList<>();
    List<EntityError> realErrors = partitionErrors(result.getErrors(), warnings);
    if (!warnings.isEmpty()) {
      LOG.debug(
          "[PaginatedEntityTimeSeriesSource] {} stale-relationship warnings for entity type {}",
          warnings.size(),
          entityType);
    }
    result.setErrors(realErrors);
    result.setWarnings(warnings);
    result.setWarningsCount(warnings.size());
    return warnings.size();
  }

  public ListFilter getFilter() {
    ListFilter filter = new ListFilter(Include.ALL);
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
