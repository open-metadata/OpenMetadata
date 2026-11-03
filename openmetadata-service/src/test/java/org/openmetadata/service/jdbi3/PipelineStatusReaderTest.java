/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.jdbi3.PipelineRepository.PIPELINE_STATUS_EXTENSION;
import static org.openmetadata.service.jdbi3.PipelineStatusReader.MAX_PAGE_JSON_LENGTH;
import static org.openmetadata.service.jdbi3.PipelineStatusReader.MAX_STATUS_JSON_LENGTH;

import java.util.List;
import java.util.NavigableMap;
import java.util.TreeMap;
import java.util.stream.LongStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.Timeout;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.type.Status;
import org.openmetadata.schema.type.StatusType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.TimestampedJson;
import org.openmetadata.service.jdbi3.PipelineStatusReader.StatusListing;
import org.openmetadata.service.util.RestUtil;

/**
 * Pages of a pipeline's statuses over a stand-in for the time-series table that answers the
 * bounded statements the reader may use, as their SQL would. Any other statement returns nothing,
 * so a reader that fell back to loading the whole range would fail these tests.
 */
class PipelineStatusReaderTest {

  private static final String FQN = "airflow.nightly_load";

  private final NavigableMap<Long, String> rows = new TreeMap<>();
  private PipelineStatusReader reader;

  @BeforeEach
  void setUp() {
    EntityTimeSeriesDAO dao = mock(EntityTimeSeriesDAO.class);
    when(dao.listTimestampedBetweenTimestamps(
            eq(FQN),
            eq(PIPELINE_STATUS_EXTENSION),
            anyLong(),
            anyLong(),
            anyInt(),
            any(),
            anyInt()))
        .thenAnswer(
            call ->
                slice(
                    call.getArgument(2),
                    call.getArgument(3),
                    call.getArgument(4),
                    call.getArgument(5),
                    call.getArgument(6)));
    when(dao.countBetweenTimestamps(
            eq(FQN), eq(PIPELINE_STATUS_EXTENSION), anyLong(), anyLong(), anyInt()))
        .thenAnswer(
            call -> matching(call.getArgument(2), call.getArgument(3), call.getArgument(4)).size());
    reader = new PipelineStatusReader(dao, FQN);
  }

  @Test
  void pagesNewestFirstAndFollowsAfterToTheEnd() {
    storeStatuses(1, 60, StatusType.Successful);

    ResultList<PipelineStatus> first = list(25, null, null);
    ResultList<PipelineStatus> second = list(25, null, first.getPaging().getAfter());
    ResultList<PipelineStatus> third = list(25, null, second.getPaging().getAfter());

    assertEquals(descending(60, 36), timestamps(first));
    assertNull(first.getPaging().getBefore());
    assertEquals(descending(35, 11), timestamps(second));
    assertEquals("35", decode(second.getPaging().getBefore()));
    assertEquals(descending(10, 1), timestamps(third));
    assertNull(third.getPaging().getAfter());
    assertEquals(60, third.getPaging().getTotal());
  }

  @Test
  void beforeReturnsThePageNextToTheCursorNotTheNewestOne() {
    storeStatuses(1, 60, StatusType.Successful);

    ResultList<PipelineStatus> page = list(25, RestUtil.encodeCursor("10"), null);

    assertEquals(descending(35, 11), timestamps(page));
    assertEquals("35", decode(page.getPaging().getBefore()));
    assertEquals("11", decode(page.getPaging().getAfter()));
  }

  @Test
  void withoutLimitAPageHoldsEverythingThatFits() {
    storeStatuses(1, 10, StatusType.Successful);

    ResultList<PipelineStatus> page = list(null, null, null);

    assertEquals(descending(10, 1), timestamps(page));
    assertNull(page.getPaging().getAfter());
  }

  @Test
  void aPageEndsOnceItHoldsItsJsonBudgetAndPointsToTheRest() {
    LongStream.rangeClosed(1, 5)
        .forEach(ts -> store(statusWithTaskNameOf(ts, MAX_PAGE_JSON_LENGTH / 3)));

    ResultList<PipelineStatus> first = list(100, null, null);
    ResultList<PipelineStatus> second = list(100, null, first.getPaging().getAfter());

    assertEquals(List.of(5L, 4L), timestamps(first));
    assertEquals(List.of(3L, 2L), timestamps(second));
    assertEquals(5, first.getPaging().getTotal());
  }

  @Test
  void aStatusLargerThanTheCapIsExcludedBeforeItIsRead() {
    storeStatuses(1, 3, StatusType.Successful);
    store(statusWithTaskNameOf(2, MAX_STATUS_JSON_LENGTH + 1));

    ResultList<PipelineStatus> page = list(null, null, null);

    assertEquals(List.of(3L, 1L), timestamps(page));
    assertEquals(2, page.getPaging().getTotal());
  }

  @Test
  void aStatusLargerThanAPageButUnderTheCapComesBackAlone() {
    store(statusWithTaskNameOf(1, MAX_PAGE_JSON_LENGTH + 1));
    storeStatuses(2, 3, StatusType.Successful);

    ResultList<PipelineStatus> first = list(null, null, null);
    ResultList<PipelineStatus> second = list(null, null, first.getPaging().getAfter());

    assertEquals(List.of(3L, 2L), timestamps(first));
    assertEquals(List.of(1L), timestamps(second));
  }

  @Test
  void aFilterPagesTheMatchesAndCountsThemAcrossTheRange() {
    LongStream.rangeClosed(1, 60)
        .forEach(ts -> store(status(ts, ts % 2 == 0 ? StatusType.Failed : StatusType.Successful)));
    PipelineStatusFilter failedOnly = PipelineStatusFilter.of("Failed", null, null, null);

    ResultList<PipelineStatus> first = reader.list(listing(10, null, null), failedOnly);
    ResultList<PipelineStatus> second =
        reader.list(listing(10, null, first.getPaging().getAfter()), failedOnly);

    assertEquals(List.of(60L, 58L, 56L, 54L, 52L, 50L, 48L, 46L, 44L, 42L), timestamps(first));
    assertEquals(40L, timestamps(second).getFirst());
    assertEquals(30, first.getPaging().getTotal());
  }

  @Test
  void aTaskSearchKeepsOnlyTheMatchingTasks() {
    store(
        status(1, StatusType.Successful)
            .withTaskStatus(
                List.of(
                    new Status().withName("load_orders").withExecutionStatus(StatusType.Successful),
                    new Status().withName("notify").withExecutionStatus(StatusType.Successful))));

    ResultList<PipelineStatus> page =
        reader.list(listing(10, null, null), PipelineStatusFilter.of(null, "ORDERS", null, null));

    assertEquals(
        List.of("load_orders"),
        page.getData().getFirst().getTaskStatus().stream().map(Status::getName).toList());
  }

  @Test
  void limitZeroReturnsOnlyTheTotal() {
    storeStatuses(1, 5, StatusType.Successful);

    ResultList<PipelineStatus> page = list(0, null, null);

    assertEquals(List.of(), page.getData());
    assertEquals(5, page.getPaging().getTotal());
  }

  @Test
  @Timeout(10)
  void aStatusAtTheSmallestTimestampEndsTheScan() {
    LongStream.range(0, 25).forEach(offset -> store(status(Long.MIN_VALUE + offset, null)));

    ResultList<PipelineStatus> page =
        reader.list(
            new StatusListing(Long.MIN_VALUE, Long.MAX_VALUE, null, null, null),
            PipelineStatusFilter.NONE);

    assertEquals(25, page.getData().size());
  }

  private ResultList<PipelineStatus> list(Integer limit, String before, String after) {
    return reader.list(listing(limit, before, after), PipelineStatusFilter.NONE);
  }

  private static StatusListing listing(Integer limit, String before, String after) {
    return new StatusListing(0, Long.MAX_VALUE, limit, before, after);
  }

  private void storeStatuses(long first, long last, StatusType statusType) {
    LongStream.rangeClosed(first, last).forEach(ts -> store(status(ts, statusType)));
  }

  private void store(PipelineStatus status) {
    rows.put(status.getTimestamp(), JsonUtils.pojoToJson(status));
  }

  private static PipelineStatus status(long timestamp, StatusType statusType) {
    return new PipelineStatus().withTimestamp(timestamp).withExecutionStatus(statusType);
  }

  private static PipelineStatus statusWithTaskNameOf(long timestamp, int nameLength) {
    return status(timestamp, StatusType.Successful)
        .withTaskStatus(List.of(new Status().withName("t".repeat(nameLength))));
  }

  private List<TimestampedJson> slice(
      long from, long to, int maxJsonLength, OrderBy order, int limit) {
    NavigableMap<Long, String> range = matching(from, to, maxJsonLength);
    NavigableMap<Long, String> ordered = order == OrderBy.DESC ? range.descendingMap() : range;
    return ordered.entrySet().stream()
        .limit(limit)
        .map(row -> new TimestampedJson(row.getKey(), row.getValue()))
        .toList();
  }

  /** Mirrors the DAO's SQL: a range read excludes any row longer than the cap. */
  private NavigableMap<Long, String> matching(long from, long to, int maxJsonLength) {
    NavigableMap<Long, String> matched = new TreeMap<>();
    range(from, to).forEach((ts, json) -> addIfWithinCap(matched, ts, json, maxJsonLength));
    return matched;
  }

  private static void addIfWithinCap(
      NavigableMap<Long, String> matched, Long timestamp, String json, int maxJsonLength) {
    if (json.length() <= maxJsonLength) {
      matched.put(timestamp, json);
    }
  }

  private NavigableMap<Long, String> range(long from, long to) {
    return from > to ? new TreeMap<>() : rows.subMap(from, true, to, true);
  }

  private static List<Long> timestamps(ResultList<PipelineStatus> page) {
    return page.getData().stream().map(PipelineStatus::getTimestamp).toList();
  }

  private static List<Long> descending(long newest, long oldest) {
    return LongStream.rangeClosed(oldest, newest).map(ts -> newest + oldest - ts).boxed().toList();
  }

  private static String decode(String cursor) {
    return RestUtil.decodeCursor(cursor);
  }
}
