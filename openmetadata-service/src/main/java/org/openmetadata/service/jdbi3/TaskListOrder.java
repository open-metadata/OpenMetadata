/*
 *  Copyright 2026 Collate
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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Arrays;
import org.openmetadata.service.exception.BadRequestException;

/**
 * Creation-time order the task list endpoints page in. Task names are zero-padded sequence numbers
 * compared as text, so name order stops matching creation order past TASK-99999 and on installs
 * whose 2.0 migration numbered every suggestion before any thread task; createdAt does not.
 *
 * <p>Only the REST list endpoints ask for it, through {@link #applyTo(ListFilter)}. A listing that
 * never does — the search reindex, which seeds its cursors by name — keeps the name keyset.
 * ADR:2026-10-28-task-lists-page-newest-first-by-creation-time
 */
public enum TaskListOrder {
  NEWEST_FIRST("desc", "DESC", "ASC", "<", ">", Long.MAX_VALUE),
  OLDEST_FIRST("asc", "ASC", "DESC", ">", "<", Long.MIN_VALUE);

  public static final String SORT_FIELD = "createdAt";

  private final String param;
  private final String direction;
  private final String reverseDirection;
  private final String afterOperator;
  private final String beforeOperator;
  // A first page has no cursor; this bound lets every row through the keyset comparison.
  private final long openBound;

  TaskListOrder(
      String param,
      String direction,
      String reverseDirection,
      String afterOperator,
      String beforeOperator,
      long openBound) {
    this.param = param;
    this.direction = direction;
    this.reverseDirection = reverseDirection;
    this.afterOperator = afterOperator;
    this.beforeOperator = beforeOperator;
    this.openBound = openBound;
  }

  public static TaskListOrder fromParam(String value) {
    TaskListOrder order = NEWEST_FIRST;
    if (!nullOrEmpty(value)) {
      order =
          Arrays.stream(values())
              .filter(candidate -> candidate.param.equalsIgnoreCase(value))
              .findFirst()
              .orElseThrow(
                  () ->
                      BadRequestException.of(
                          "sortOrder must be 'asc' or 'desc', got '%s'".formatted(value)));
    }
    return order;
  }

  static boolean isRequestedBy(ListFilter filter) {
    return SORT_FIELD.equals(filter.getSortField());
  }

  static TaskListOrder of(ListFilter filter) {
    return fromParam(filter.getSortOrder());
  }

  public ListFilter applyTo(ListFilter filter) {
    return filter.withSort(SORT_FIELD, param);
  }

  /** The page that follows the cursor row in this order. */
  CreatedAtPage after(String cursorCreatedAt, String cursorId) {
    return new CreatedAtPage(
        parseCursor(cursorCreatedAt), cursorId, afterOperator, direction, direction);
  }

  /**
   * The page that precedes the cursor row: walked in the reverse order so LIMIT keeps the rows
   * nearest the cursor, then handed back in this order.
   */
  CreatedAtPage before(String cursorCreatedAt, String cursorId) {
    return new CreatedAtPage(
        parseCursor(cursorCreatedAt), cursorId, beforeOperator, reverseDirection, direction);
  }

  private long parseCursor(String cursorCreatedAt) {
    long createdAt = openBound;
    if (!nullOrEmpty(cursorCreatedAt)) {
      try {
        createdAt = Long.parseLong(cursorCreatedAt);
      } catch (NumberFormatException e) {
        // Cursors issued before task lists paged by creation time carry the task name instead.
        throw BadRequestException.of(
            "Task list cursor '%s' is not a creation-time cursor; list again from the first page"
                .formatted(cursorCreatedAt));
      }
    }
    return createdAt;
  }

  /**
   * One keyset page over (createdAt, id). {@code operator} compares rows against the cursor,
   * {@code scanDirection} orders the rows LIMIT picks from and {@code pageDirection} the rows
   * returned.
   */
  record CreatedAtPage(
      long createdAt, String id, String operator, String scanDirection, String pageDirection) {
    CreatedAtPage {
      id = id == null ? "" : id;
    }
  }
}
