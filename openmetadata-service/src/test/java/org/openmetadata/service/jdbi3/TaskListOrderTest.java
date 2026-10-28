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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.jdbi3.TaskListOrder.CreatedAtPage;

class TaskListOrderTest {

  @Test
  void unsetSortOrderListsNewestFirst() {
    assertEquals(TaskListOrder.NEWEST_FIRST, TaskListOrder.fromParam(null));
    assertEquals(TaskListOrder.NEWEST_FIRST, TaskListOrder.fromParam(""));
    assertEquals(TaskListOrder.NEWEST_FIRST, TaskListOrder.fromParam("DESC"));
    assertEquals(TaskListOrder.OLDEST_FIRST, TaskListOrder.fromParam("asc"));
  }

  @Test
  void unknownSortOrderIsRejected() {
    assertThrows(BadRequestException.class, () -> TaskListOrder.fromParam("sideways"));
  }

  @Test
  void onlyFiltersTheEndpointsMarkedPageByCreationTime() {
    ListFilter plain = new ListFilter();
    ListFilter sorted = TaskListOrder.OLDEST_FIRST.applyTo(new ListFilter());

    assertFalse(TaskListOrder.isRequestedBy(plain), "Reindex listings keep the name keyset");
    assertTrue(TaskListOrder.isRequestedBy(sorted));
    assertEquals(TaskListOrder.OLDEST_FIRST, TaskListOrder.of(sorted));
  }

  @Test
  void firstNewestPageAdmitsEveryRow() {
    CreatedAtPage page = TaskListOrder.NEWEST_FIRST.after("", "");

    assertEquals(new CreatedAtPage(Long.MAX_VALUE, "", "<", "DESC", "DESC"), page);
  }

  @Test
  void firstOldestPageAdmitsEveryRow() {
    CreatedAtPage page = TaskListOrder.OLDEST_FIRST.after(null, null);

    assertEquals(new CreatedAtPage(Long.MIN_VALUE, "", ">", "ASC", "ASC"), page);
  }

  @Test
  void previousNewestPageWalksBackTowardTheNewerRows() {
    CreatedAtPage page = TaskListOrder.NEWEST_FIRST.before("1793107007319", "id-1");

    assertEquals(new CreatedAtPage(1793107007319L, "id-1", ">", "ASC", "DESC"), page);
  }

  @Test
  void nameCursorFromBeforeCreationTimePagingIsRejected() {
    assertThrows(
        BadRequestException.class, () -> TaskListOrder.NEWEST_FIRST.after("TASK-00012", "id-1"));
  }
}
