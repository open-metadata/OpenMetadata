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

import static org.openmetadata.service.jdbi3.PipelineRepository.PIPELINE_STATUS_EXTENSION;

import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.openmetadata.schema.entity.data.PipelineStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.ResultList;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.OrderBy;
import org.openmetadata.service.jdbi3.EntityTimeSeriesDAO.TimestampedJson;
import org.openmetadata.service.util.RestUtil;

/**
 * Reads a pipeline's stored statuses a page at a time.
 *
 * <p>Neither the number of statuses a pipeline has nor the size of one is bounded by its writer, and
 * a parsed status can take tens of times its stored size. So a range is read in small batches, and
 * nothing is kept beyond the page being returned: at most {@code limit} statuses and at most {@link
 * #MAX_PAGE_JSON_LENGTH} characters of their JSON, whichever comes first. A page cut short carries
 * the cursor to the rest, so a client that follows cursors still sees every status.
 *
 * <p>Two bounds keep one request's heap small even under concurrency. The reader only ever holds one
 * {@link #READ_BATCH_SIZE}-row batch plus the page it is building, and the batch read excludes any
 * row larger than {@link #MAX_STATUS_JSON_LENGTH}: writes have been capped at that size since this
 * reader was added, but a status stored before the cap could otherwise be loaded whole here and
 * parsed into many times its size. Such a row is skipped in SQL rather than transferred; it can be
 * removed by a migration.
 */
final class PipelineStatusReader {

  /** The largest status that may be stored, and the largest one a page returns on its own. */
  static final int MAX_STATUS_JSON_LENGTH = 1024 * 1024;

  /** A page ends here even when {@code limit} is larger or absent, bounding one request's heap. */
  static final int MAX_PAGE_JSON_LENGTH = 512 * 1024;

  private static final int READ_BATCH_SIZE = 8;

  private final EntityTimeSeriesDAO timeSeriesDao;
  private final String pipelineFqn;

  PipelineStatusReader(EntityTimeSeriesDAO timeSeriesDao, String pipelineFqn) {
    this.timeSeriesDao = timeSeriesDao;
    this.pipelineFqn = pipelineFqn;
  }

  /**
   * A page of a listing.
   *
   * @param limit the most statuses to return, or null for as many as fit one page
   * @param before return the statuses newer than this cursor
   * @param after return the statuses older than this cursor
   */
  record StatusListing(long startTs, long endTs, Integer limit, String before, String after) {
    int pageSize() {
      return limit == null ? Integer.MAX_VALUE : limit;
    }
  }

  /** One page of the listing, newest first, with the total of statuses the filter matches. */
  ResultList<PipelineStatus> list(StatusListing listing, PipelineStatusFilter filter) {
    Page page = readPage(Window.of(listing), listing.pageSize(), filter);
    return page.toResultList(total(listing, filter));
  }

  /** The newest statuses in the range that fit one page, newest first. */
  List<PipelineStatus> listNewest(long startTs, long endTs) {
    Window window = new Window(startTs, endTs, OrderBy.DESC, false);
    return readPage(window, Integer.MAX_VALUE, PipelineStatusFilter.NONE).newestFirst();
  }

  private Page readPage(Window window, int pageSize, PipelineStatusFilter filter) {
    PageBuilder page = new PageBuilder(pageSize);
    scan(window, row -> offerRow(page, filter, row));
    return page.build(window);
  }

  /**
   * An unfiltered page that is already full by count has its next row waiting, so the scan stops
   * without parsing it. A filtered page cannot: whether the next row belongs to it is known only
   * once parsed, so the original per-row parse is kept there.
   */
  private static boolean offerRow(
      PageBuilder page, PipelineStatusFilter filter, TimestampedJson row) {
    if (filter.isEmpty() && page.isFull()) {
      return page.noteHasMore();
    }
    return filter
        .apply(JsonUtils.readValue(row.json(), PipelineStatus.class))
        .map(match -> page.offer(match, row.json().length()))
        .orElse(true);
  }

  private int total(StatusListing listing, PipelineStatusFilter filter) {
    return filter.isEmpty()
        ? timeSeriesDao.countBetweenTimestamps(
            pipelineFqn,
            PIPELINE_STATUS_EXTENSION,
            listing.startTs(),
            listing.endTs(),
            MAX_STATUS_JSON_LENGTH)
        : countMatches(listing, filter);
  }

  /** A filter has to inspect every status, so this reads the whole range, keeping none of it. */
  private int countMatches(StatusListing listing, PipelineStatusFilter filter) {
    AtomicInteger matches = new AtomicInteger();
    scan(
        new Window(listing.startTs(), listing.endTs(), OrderBy.DESC, false),
        row -> {
          filter
              .apply(JsonUtils.readValue(row.json(), PipelineStatus.class))
              .ifPresent(match -> matches.incrementAndGet());
          return true;
        });
    return matches.get();
  }

  /** Visits the window's statuses in its order, a batch at a time, until the visitor stops. */
  private void scan(Window window, RowVisitor visitor) {
    Window remaining = window;
    boolean scanning = !remaining.isEmpty();
    while (scanning) {
      List<TimestampedJson> batch =
          timeSeriesDao.listTimestampedBetweenTimestamps(
              pipelineFqn,
              PIPELINE_STATUS_EXTENSION,
              remaining.from(),
              remaining.to(),
              MAX_STATUS_JSON_LENGTH,
              remaining.order(),
              READ_BATCH_SIZE);
      boolean isBatchFull = batch.size() == READ_BATCH_SIZE;
      scanning = visitBatch(batch, visitor) && isBatchFull;
      remaining = scanning ? remaining.past(batch.getLast().timestamp()) : remaining;
      scanning = scanning && !remaining.isEmpty();
    }
  }

  private boolean visitBatch(List<TimestampedJson> batch, RowVisitor visitor) {
    boolean keepScanning = true;
    for (int index = 0; keepScanning && index < batch.size(); index++) {
      keepScanning = visitor.visit(batch.get(index));
    }
    return keepScanning;
  }

  @FunctionalInterface
  private interface RowVisitor {
    /** Visits one stored row; returning false ends the scan. */
    boolean visit(TimestampedJson row);
  }

  /**
   * The part of the range a page is read from, in the order it is read. A page after a cursor reads
   * older statuses newest first; a page before one reads newer statuses oldest first, so the statuses
   * next to the cursor come first, and is reversed once read.
   */
  private record Window(long from, long to, OrderBy order, boolean followsCursor) {

    private static final Window EMPTY = new Window(1, 0, OrderBy.DESC, true);

    static Window of(StatusListing listing) {
      Window window = new Window(listing.startTs(), listing.endTs(), OrderBy.DESC, false);
      if (listing.before() != null) {
        window = newerThan(decode(listing.before()), listing);
      } else if (listing.after() != null) {
        window = olderThan(decode(listing.after()), listing);
      }
      return window;
    }

    boolean isEmpty() {
      return from > to;
    }

    boolean readsNewerFirst() {
      return order == OrderBy.ASC;
    }

    /** What is left of the window once the status at {@code timestamp} has been read. */
    Window past(long timestamp) {
      boolean readsOlder = order == OrderBy.DESC;
      boolean isAtEnd = timestamp == (readsOlder ? Long.MIN_VALUE : Long.MAX_VALUE);
      long nextFrom = readsOlder ? from : timestamp + 1;
      long nextTo = readsOlder ? timestamp - 1 : to;
      return isAtEnd ? EMPTY : new Window(nextFrom, nextTo, order, followsCursor);
    }

    private static Window newerThan(long cursor, StatusListing listing) {
      return cursor == Long.MAX_VALUE
          ? EMPTY
          : new Window(Math.max(listing.startTs(), cursor + 1), listing.endTs(), OrderBy.ASC, true);
    }

    private static Window olderThan(long cursor, StatusListing listing) {
      return cursor == Long.MIN_VALUE
          ? EMPTY
          : new Window(
              listing.startTs(), Math.min(listing.endTs(), cursor - 1), OrderBy.DESC, true);
    }

    private static long decode(String cursor) {
      return Long.parseLong(RestUtil.decodeCursor(cursor));
    }
  }

  /** Collects a page while its window is scanned; see the class comment for its bounds. */
  private static final class PageBuilder {
    private final int pageSize;
    private final List<PipelineStatus> statuses = new ArrayList<>();
    private long jsonLength;
    private boolean hasMore;

    PageBuilder(int pageSize) {
      this.pageSize = pageSize;
    }

    boolean isFull() {
      return statuses.size() >= pageSize;
    }

    /** Records that a status lies past the page without taking it, then ends the scan. */
    boolean noteHasMore() {
      hasMore = true;
      return false;
    }

    /** Takes a match into the page; false once the page is full, a further match showing more. */
    boolean offer(PipelineStatus status, int statusJsonLength) {
      boolean fits =
          statuses.size() < pageSize
              && (statuses.isEmpty() || jsonLength + statusJsonLength <= MAX_PAGE_JSON_LENGTH);
      if (fits) {
        statuses.add(status);
        jsonLength += statusJsonLength;
      } else {
        hasMore = true;
      }
      return fits;
    }

    Page build(Window window) {
      List<PipelineStatus> newestFirst = window.readsNewerFirst() ? statuses.reversed() : statuses;
      return new Page(List.copyOf(newestFirst), hasMore, window);
    }
  }

  /**
   * A page and where it sits in the range. Statuses lie past the page in the direction it was read
   * exactly when the scan found more; in the other direction exactly when it followed a cursor, whose
   * own status is one of them.
   */
  private record Page(List<PipelineStatus> newestFirst, boolean hasMore, Window window) {

    ResultList<PipelineStatus> toResultList(int total) {
      boolean hasNewer = window.readsNewerFirst() ? hasMore : window.followsCursor();
      boolean hasOlder = window.readsNewerFirst() ? window.followsCursor() : hasMore;
      boolean isEmpty = newestFirst.isEmpty();
      String before = hasNewer && !isEmpty ? timestampOf(newestFirst.getFirst()) : null;
      String after = hasOlder && !isEmpty ? timestampOf(newestFirst.getLast()) : null;
      return new ResultList<>(newestFirst, before, after, total);
    }

    private static String timestampOf(PipelineStatus status) {
      return String.valueOf(status.getTimestamp());
    }
  }
}
