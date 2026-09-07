/*
 *  Copyright 2026 Collate.
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.CALLS_REAL_METHODS;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Relationship.CONTAINS;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;

/**
 * The scope clause shared by every ingestion-pipeline listing.
 *
 * <p>{@code serviceType} is the parent service category, which lives in {@code
 * entity_relationship.fromEntity} rather than on the pipeline row, so it has to be a join rather
 * than a {@link ListFilter} condition. The count, the unordered page and the displayName-ordered
 * page all build that join from one method for a reason: if the ordered query considered a different
 * set of rows than the count, {@code paging.total} would disagree with the rows returned, and the
 * last page would be silently short.
 *
 * <p>The ordered queries append {@code AND (displayNameSort <op> :afterDisplayName OR ...)} directly
 * onto this string, so it must always terminate in a WHERE clause — an invariant nothing else
 * enforces, and one that fails as a SQL syntax error only at runtime.
 */
class IngestionPipelineSortConditionTest {
  private static final String TABLE = "ingestion_pipeline_entity";
  private static final String WHERE = "WHERE ";
  private static final String CURSOR_PREDICATE =
      " AND (ingestion_pipeline_entity.displayNameSort > :afterDisplayName)";

  private CollectionDAO.IngestionPipelineDAO dao() {
    return mock(CollectionDAO.IngestionPipelineDAO.class, CALLS_REAL_METHODS);
  }

  private ListFilter filterWithServiceType() {
    return new ListFilter(Include.NON_DELETED).addQueryParam("serviceType", "databaseService");
  }

  private int countWhereClauses(String sql) {
    int count = 0;
    int from = sql.indexOf(WHERE);
    while (from >= 0) {
      count++;
      from = sql.indexOf(WHERE, from + WHERE.length());
    }
    return count;
  }

  @Test
  void test_serviceTypeJoin_joinsEntityRelationshipAndPinsTheContainsRelation() {
    String condition = dao().serviceTypeJoinCondition(filterWithServiceType());

    assertTrue(
        condition.startsWith("INNER JOIN entity_relationship ON " + TABLE + ".id ="),
        "expected the serviceType filter to be expressed as a join, got: " + condition);
    // The relation ordinal is inlined rather than bound; if the literal stops matching CONTAINS the
    // listing silently scopes to the wrong relationship type.
    assertTrue(
        condition.endsWith("entity_relationship.relation = " + CONTAINS.ordinal()),
        "expected the CONTAINS ordinal to be inlined, got: " + condition);
  }

  /**
   * The cursor predicate is appended with {@code AND}, so a condition that did not already open a
   * WHERE clause would produce {@code ... AND (...)} with no WHERE at all.
   */
  @Test
  void test_serviceTypeJoin_terminatesInASingleWhereClauseTheCursorCanExtend() {
    String composed = dao().serviceTypeJoinCondition(filterWithServiceType()) + CURSOR_PREDICATE;

    assertEquals(1, countWhereClauses(composed), "composed SQL: " + composed);
    assertTrue(
        composed.indexOf(WHERE) < composed.indexOf(" AND ("),
        "cursor predicate must extend the WHERE clause, not precede it: " + composed);
  }

  @Test
  void test_displayNameSortCondition_reusesTheServiceTypeJoinVerbatim() {
    ListFilter filter = filterWithServiceType();

    assertEquals(dao().serviceTypeJoinCondition(filter), dao().displayNameSortCondition(filter));
  }

  /**
   * Without {@code serviceType} there is nothing to join, so the ordered listing must fall back to
   * exactly the condition the unordered listing uses — same rows, different order.
   */
  @Test
  void test_displayNameSortCondition_fallsBackToThePlainFilterConditionWithoutServiceType() {
    ListFilter filter = new ListFilter(Include.NON_DELETED);

    String condition = dao().displayNameSortCondition(filter);

    assertEquals(filter.getCondition(), condition);
    assertTrue(condition.startsWith(WHERE), "expected a WHERE clause, got: " + condition);
    assertEquals(1, countWhereClauses(condition + CURSOR_PREDICATE));
  }

  /**
   * Columns stay table-qualified only on the serviceType variant, which joins {@code
   * entity_relationship} — that table brings its own {@code json} and {@code deleted} columns, so an
   * unqualified {@code deleted} would be ambiguous and fail at runtime. The plain branch has no join
   * and must stay unqualified (see the pipelineType regression below).
   */
  @Test
  void test_displayNameSortCondition_qualifiesColumnsOnlyWhenJoiningForServiceType() {
    String condition = dao().displayNameSortCondition(filterWithServiceType());

    assertTrue(condition.contains(TABLE + "."), "expected qualified columns, got: " + condition);
  }

  /**
   * The plain branch sorts a single table, so it must reuse the unqualified {@code getCondition()}
   * the default listing uses — which resolves {@code pipelineType} against the generated STORED
   * column. Qualifying it (the old bug) rewrote the filter as {@code
   * ingestion_pipeline_entity.JSON_UNQUOTE(...)}, which MySQL parses as a routine call and rejects
   * with "execute command denied ... for routine". The generated column is dialect-safe and indexed.
   */
  @Test
  void test_displayNameSortCondition_filtersPipelineTypeOnTheGeneratedColumnNotJsonExtraction() {
    ListFilter filter =
        new ListFilter(Include.NON_DELETED).addQueryParam("pipelineType", "application");

    String condition = dao().displayNameSortCondition(filter);

    assertTrue(
        condition.contains("pipelineType IN ("),
        "expected the generated pipelineType column, got: " + condition);
    assertFalse(
        condition.contains(TABLE + ".JSON_UNQUOTE"),
        "must not qualify the JSON extraction onto the table (MySQL routine-call bug): "
            + condition);
  }
}
