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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.Include;

class BoundedListFilterTest {

  @Test
  void conditionIncludesUpperBoundWithUnqualifiedColumns() {
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, "Foxtrot", "uuid-123");
    String condition = filter.getCondition(null);

    assertTrue(condition.contains("name < :reindexEndName"));
    assertTrue(condition.contains("(name = :reindexEndName AND id <= :reindexEndId)"));
  }

  @Test
  void conditionIncludesUpperBoundWithQualifiedColumns() {
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, "Foxtrot", "uuid-123");
    String condition = filter.getCondition("table_entity");

    assertTrue(condition.contains("table_entity.name < :reindexEndName"));
    assertTrue(
        condition.contains(
            "(table_entity.name = :reindexEndName AND table_entity.id <= :reindexEndId)"));
  }

  @Test
  void queryParamsContainBoundaryValues() {
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, "Foxtrot", "uuid-123");

    assertEquals("Foxtrot", filter.getQueryParams().get("reindexEndName"));
    assertEquals("uuid-123", filter.getQueryParams().get("reindexEndId"));
  }

  @Test
  void conditionPreservesBaseFilterConditions() {
    BoundedListFilter filter = new BoundedListFilter(Include.NON_DELETED, "Foxtrot", "uuid-123");
    String condition = filter.getCondition(null);

    assertTrue(condition.startsWith("WHERE"));
    assertTrue(condition.contains("deleted"));
    assertTrue(condition.contains("reindexEndName"));
  }

  @Test
  void boundaryIsInclusiveOnEndEntity() {
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, "echo", "uuid-end");
    String condition = filter.getCondition(null);

    assertTrue(condition.contains("id <= :reindexEndId"));
    assertFalse(condition.contains("id < :reindexEndId"));
  }

  @Test
  void mixedCaseNamesArePassedThroughToSql() {
    BoundedListFilter filter = new BoundedListFilter(Include.ALL, "Foxtrot", "uuid-abc");
    String condition = filter.getCondition(null);

    assertEquals("Foxtrot", filter.getQueryParams().get("reindexEndName"));
    assertTrue(condition.contains(":reindexEndName"));
  }
}
