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

import java.lang.annotation.Annotation;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;
import java.lang.reflect.Method;
import java.lang.reflect.Parameter;
import java.lang.reflect.Type;
import java.util.Arrays;
import java.util.Locale;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizerFactory;
import org.jdbi.v3.sqlobject.customizer.SqlStatementCustomizingAnnotation;
import org.jdbi.v3.sqlobject.customizer.SqlStatementParameterCustomizer;
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
  NEWEST_FIRST(TaskListOrder.DESC, "<", Long.MAX_VALUE),
  OLDEST_FIRST(TaskListOrder.ASC, ">", Long.MIN_VALUE);

  public static final String SORT_FIELD = "createdAt";
  public static final String ASC = "asc";
  public static final String DESC = "desc";

  private final String param;
  private final String direction;
  private final String afterOperator;
  // A first page has no cursor; this bound lets every row through the keyset comparison.
  private final long openBound;

  TaskListOrder(String param, String afterOperator, long openBound) {
    this.param = param;
    this.direction = param.toUpperCase(Locale.ROOT);
    this.afterOperator = afterOperator;
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
                          "sortOrder must be '%s' or '%s', got '%s'".formatted(ASC, DESC, value)));
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
   * The page that precedes the cursor row. It is the next page of the opposite order — walked that
   * way so LIMIT keeps the rows nearest the cursor — handed back in this order.
   */
  CreatedAtPage before(String cursorCreatedAt, String cursorId) {
    final TaskListOrder opposite = this == NEWEST_FIRST ? OLDEST_FIRST : NEWEST_FIRST;
    return new CreatedAtPage(
        parseCursor(cursorCreatedAt),
        cursorId,
        opposite.afterOperator,
        opposite.direction,
        direction);
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

  /**
   * Supplies one {@link CreatedAtPage} to a createdAt keyset query: the comparison operator and the
   * two sort directions as the {@code <op>}, {@code <scanDir>} and {@code <pageDir>} template
   * attributes, and the cursor row as {@code :cursorCreatedAt} and {@code :cursorId}.
   */
  @Retention(RetentionPolicy.RUNTIME)
  @Target({ElementType.PARAMETER})
  @SqlStatementCustomizingAnnotation(BindPage.Factory.class)
  public @interface BindPage {

    class Factory implements SqlStatementCustomizerFactory {
      @Override
      public SqlStatementParameterCustomizer createForParameter(
          Annotation annotation,
          Class<?> sqlObjectType,
          Method method,
          Parameter param,
          int index,
          Type type) {
        return (stmt, arg) -> {
          // Jdbi's customizer SPI passes the argument as Object; BindPage is only declared on
          // CreatedAtPage parameters, so the cast is the shape check the SPI leaves us.
          final CreatedAtPage page = (CreatedAtPage) arg;
          stmt.define("op", page.operator())
              .define("scanDir", page.scanDirection())
              .define("pageDir", page.pageDirection())
              .bind("cursorCreatedAt", page.createdAt())
              .bind("cursorId", page.id());
        };
      }
    }
  }
}
