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
import org.openmetadata.schema.analytics.ReportData;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.exception.ReaderException;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.RestUtil;
import org.openmetadata.service.util.ResultList;
import org.openmetadata.service.workflows.interfaces.Source;

@Slf4j
public class PaginatedDataInsightReader implements Source<ResultList<ReportData>> {
  private final CollectionDAO dao;
  @Getter private final String entityType;
  @Getter private final int batchSize;
  private final StepStats stats = new StepStats();
  private String cursor = null;
  @Getter private boolean isDone = false;

  public PaginatedDataInsightReader(CollectionDAO dao, String entityType, int batchSize) {
    this.dao = dao;
    this.entityType = entityType;
    this.batchSize = batchSize;
  }

  @Override
  public ResultList<ReportData> readNext(Map<String, Object> contextData) throws ReaderException {
    if (!isDone) {
      ResultList<ReportData> data = read(cursor);
      cursor = data.getPaging().getAfter();
      if (cursor == null) {
        isDone = true;
      }
      return data;
    } else {
      return null;
    }
  }

  @Override
  public void reset() {
    cursor = null;
    isDone = false;
  }

  private ResultList<ReportData> read(String afterCursor) throws ReaderException {
    LOG.debug("[DataInsightReader] Fetching a Batch of Size: {} ", batchSize);
    ResultList<ReportData> result;
    try {
      result = getReportDataPagination(entityType, batchSize, afterCursor);
      LOG.debug(
          "[DataInsightReader] Batch Stats :- Submitted : {} Success: {} Failed: {}",
          batchSize,
          result.getData().size(),
          0);
      updateStats(result.getData().size(), result.getErrors().size());
    } catch (Exception ex) {
      LOG.debug("[DataInsightReader] Batch Stats :- Submitted : {} Success: {} Failed: {}", batchSize, 0, batchSize);
      updateStats(0, batchSize);
      throw new ReaderException("[EntitiesReader] Batch encountered Exception. Failing Completely.", ex);
    }

    return result;
  }

  public ResultList<ReportData> getReportDataPagination(String entityFQN, int limit, String after) {
    int reportDataCount = dao.entityExtensionTimeSeriesDao().listCount(entityFQN);
    List<CollectionDAO.ReportDataRow> reportDataList =
        dao.entityExtensionTimeSeriesDao()
            .getAfterExtension(entityFQN, limit + 1, after == null ? "0" : RestUtil.decodeCursor(after));
    return getAfterExtensionList(reportDataList, after, limit, reportDataCount);
  }

  private ResultList<ReportData> getAfterExtensionList(
      List<CollectionDAO.ReportDataRow> reportDataRowList, String after, int limit, int total) {
    String beforeCursor;
    String afterCursor = null;
    beforeCursor = after == null ? null : reportDataRowList.get(0).getRowNum();
    if (reportDataRowList.size() > limit) {
      reportDataRowList.remove(limit);
      afterCursor = reportDataRowList.get(limit - 1).getRowNum();
    }
    List<ReportData> reportDataList = new ArrayList<>();
    for (CollectionDAO.ReportDataRow reportDataRow : reportDataRowList) {
      reportDataList.add(reportDataRow.getReportData());
    }
    return new ResultList<>(reportDataList, beforeCursor, afterCursor, total);
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
