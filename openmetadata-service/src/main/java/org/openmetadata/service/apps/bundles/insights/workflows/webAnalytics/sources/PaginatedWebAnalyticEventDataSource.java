package org.openmetadata.service.apps.bundles.insights.workflows.webAnalytics.sources;

import static org.openmetadata.schema.system.IndexingError.ErrorSource.READER;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.getUpdatedStats;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.glassfish.jersey.internal.util.ExceptionUtils;
import org.openmetadata.schema.analytics.WebAnalyticEventData;
import org.openmetadata.schema.analytics.type.WebAnalyticEventType;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.exception.SearchIndexException;
import org.openmetadata.service.jdbi3.ListFilter;
import org.openmetadata.service.jdbi3.WebAnalyticEventRepository;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
@Getter
public class PaginatedWebAnalyticEventDataSource
    implements Source<ResultList<WebAnalyticEventData>> {
  private final String name;
  private final int batchSize;
  private final Long startTs;
  private final Long endTs;
  private final int totalRecords;
  private final String entityType = Entity.WEB_ANALYTIC_EVENT;

  @Getter
  private final WebAnalyticEventRepository repository =
      (WebAnalyticEventRepository) Entity.getEntityRepository(entityType);

  private final String eventType = WebAnalyticEventType.PAGE_VIEW.toString();
  private final List<String> readerErrors = new ArrayList<>();
  private final StepStats stats = new StepStats();
  private String lastFailedCursor = null;
  private final AtomicReference<String> cursor = new AtomicReference<>(RestUtil.encodeCursor("0"));
  private final AtomicReference<Boolean> isDone = new AtomicReference<>(false);

  public PaginatedWebAnalyticEventDataSource(int batchSize, Long startTs, Long endTs) {
    this.batchSize = batchSize;
    this.startTs = startTs;
    this.endTs = endTs;
    this.name =
        String.format(
            "[WebAnalyticsWorkflow] Event Data Source %s",
            TimestampUtils.timestampToString(startTs, "YYYY-MM-dd"));
    this.totalRecords = repository.listWebAnalyticEventDataCount(eventType, startTs, endTs, false);
    this.stats.withTotalRecords(totalRecords).withSuccessRecords(0).withFailedRecords(0);
  }

  @Override
  public ResultList<WebAnalyticEventData> readNext(Map<String, Object> contextData)
      throws SearchIndexException {
    ResultList<WebAnalyticEventData> data = null;
    if (Boolean.FALSE.equals(isDone.get())) {
      data = read(cursor.get());
      cursor.set(data.getPaging().getAfter());
      if (cursor.get() == null) {
        isDone.set(true);
      }
    }
    return data;
  }

  @Override
  public ResultList<WebAnalyticEventData> readWithCursor(String currentCursor)
      throws SearchIndexException {
    LOG.debug("[PaginatedEntityTimeSeriesSource] Fetching a Batch of Size: {} ", batchSize);
    ResultList<WebAnalyticEventData> result;
    try {
      result =
          repository.listWebAnalyticEventDataWithOffset(
              currentCursor, eventType, batchSize, startTs, endTs, false, true);
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

  private ResultList<WebAnalyticEventData> read(String cursor) throws SearchIndexException {
    LOG.debug("[PaginatedEntityTimeSeriesSource] Fetching a Batch of Size: {} ", batchSize);
    ResultList<WebAnalyticEventData> result;
    try {
      result =
          repository.listWebAnalyticEventDataWithOffset(
              cursor, eventType, batchSize, startTs, endTs, false, true);
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
  public ListFilter getFilter() {
    return null;
  }

  @Override
  public void updateStats(int currentSuccess, int currentFailed) {
    getUpdatedStats(stats, currentSuccess, currentFailed);
  }

  @Override
  public AtomicReference<Boolean> isDone() {
    return isDone;
  }
}
