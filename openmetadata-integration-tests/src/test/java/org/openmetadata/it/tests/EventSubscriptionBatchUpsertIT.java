/*
 *  Copyright 2025 Collate
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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.EventSubscriptionDAOs.EventSubscriptionDAO;

/**
 * Regression test for {@code EventSubscriptionDAO.batchUpsertSuccessfulChangeEvents}.
 *
 * <p>When an alert fans an event out to multiple destination types, the same
 * {@code (change_event_id, event_subscription_id)} pair was added to the batch more than once. With
 * the Postgres JDBC driver's {@code reWriteBatchedInserts=true}, the batch collapses into a single
 * multi-row {@code INSERT ... ON CONFLICT (...) DO UPDATE}, and Postgres aborts the whole statement
 * with "ON CONFLICT DO UPDATE command cannot affect row a second time" — so no success records were
 * persisted. This guard must run under a Postgres profile to exercise that path; on MySQL it still
 * verifies the dedup invariant.
 */
@Execution(ExecutionMode.CONCURRENT)
public class EventSubscriptionBatchUpsertIT {

  private static EventSubscriptionDAO dao() {
    return Entity.getCollectionDAO().eventSubscriptionDAO();
  }

  private static String json(String changeEventId) {
    return "{\"id\":\"" + changeEventId + "\"}";
  }

  @Test
  void duplicateKeysInBatchDoNotFailAndCollapseToOneRow() {
    String subscriptionId = UUID.randomUUID().toString();
    String changeEventId = UUID.randomUUID().toString();
    long timestamp = System.currentTimeMillis();
    try {
      assertDoesNotThrow(
          () ->
              dao()
                  .batchUpsertSuccessfulChangeEvents(
                      List.of(changeEventId, changeEventId),
                      List.of(subscriptionId, subscriptionId),
                      List.of(json(changeEventId), json(changeEventId)),
                      List.of(timestamp, timestamp)));
      assertEquals(1L, dao().getSuccessfulRecordCount(subscriptionId));
    } finally {
      dao().deleteSuccessfulChangeEventBySubscriptionId(subscriptionId);
    }
  }

  @Test
  void mixedBatchKeepsOneRowPerDistinctKey() {
    String subscriptionId = UUID.randomUUID().toString();
    String changeEventA = UUID.randomUUID().toString();
    String changeEventB = UUID.randomUUID().toString();
    long timestamp = System.currentTimeMillis();
    try {
      dao()
          .batchUpsertSuccessfulChangeEvents(
              List.of(changeEventA, changeEventB, changeEventA),
              List.of(subscriptionId, subscriptionId, subscriptionId),
              List.of(json(changeEventA), json(changeEventB), json(changeEventA)),
              List.of(timestamp, timestamp, timestamp));
      assertEquals(2L, dao().getSuccessfulRecordCount(subscriptionId));
    } finally {
      dao().deleteSuccessfulChangeEventBySubscriptionId(subscriptionId);
    }
  }
}
