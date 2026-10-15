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
package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import org.junit.jupiter.api.Test;

class ByQueryPolicyTest {
  private static final long STARTED_AT = 1_700_000_000_000L;
  private static final String QUERY = "{\"term\":{\"service.id\":\"s1\"}}";
  private static final ByQueryPolicy.Target TARGET =
      new ByQueryPolicy.Target("update-by-query", List.of("table_search_index"), () -> QUERY);

  private final List<String> events = new ArrayList<>();
  private final List<SearchRepairScope> repairs = new ArrayList<>();
  private final ByQueryPolicy policy =
      new ByQueryPolicy(() -> STARTED_AT, (scope, reason) -> repairs.add(scope));

  @Test
  void theTargetsAreRefreshedBeforeTheRequestSeesThem() throws IOException {
    policy.apply(TARGET, () -> events.add("refresh"), attempts(ByQueryOutcome.COMPLETE));

    assertEquals(List.of("refresh", "attempt"), events);
    assertTrue(repairs.isEmpty());
  }

  @Test
  void conflictsAreRetriedAgainstAFreshRefresh() throws IOException {
    policy.apply(
        TARGET,
        () -> events.add("refresh"),
        attempts(conflicts(4), conflicts(1), ByQueryOutcome.COMPLETE));

    assertEquals(List.of("refresh", "attempt", "refresh", "attempt", "refresh", "attempt"), events);
    assertTrue(repairs.isEmpty(), "the last attempt finished the job");
  }

  @Test
  void conflictsLeftAfterTheLastAttemptAreRepairedAndThrown() {
    final IncompleteSearchUpdateException thrown =
        assertThrows(
            IncompleteSearchUpdateException.class,
            () ->
                policy.apply(TARGET, () -> {}, attempts(conflicts(3), conflicts(2), conflicts(1))));

    assertTrue(thrown.getMessage().contains("1 version conflict(s)"));
    assertEquals(
        List.of(new SearchRepairScope(List.of("table_search_index"), QUERY, STARTED_AT)), repairs);
  }

  @Test
  void documentFailuresAreNotRetriedButRepaired() {
    assertThrows(
        IncompleteSearchUpdateException.class,
        () ->
            policy.apply(
                TARGET,
                () -> {},
                attempts(new ByQueryOutcome(2, List.of("mapper_parsing_exception"), false))));

    assertEquals(List.of("attempt"), events, "a failed document would fail again");
    assertEquals(1, repairs.size());
  }

  @Test
  void aTaskStillRunningAfterTheWaitIsRepaired() {
    assertThrows(
        IncompleteSearchUpdateException.class,
        () -> policy.apply(TARGET, () -> {}, attempts(ByQueryOutcome.stillRunning())));

    assertEquals(1, repairs.size());
  }

  @Test
  void aRequestThatFailsOutrightIsRepairedAndRethrown() {
    final IOException unreachable = new IOException("connection refused");

    final IOException thrown =
        assertThrows(
            IOException.class,
            () ->
                policy.apply(
                    TARGET,
                    () -> {},
                    () -> {
                      throw unreachable;
                    }));

    assertSame(unreachable, thrown);
    assertEquals(STARTED_AT, repairs.getFirst().notRewrittenSince());
  }

  @Test
  void aFailedRefreshIsRepairedLikeAFailedRequest() {
    assertThrows(
        IOException.class,
        () ->
            policy.apply(
                TARGET,
                () -> {
                  throw new IOException("cluster unavailable");
                },
                attempts(ByQueryOutcome.COMPLETE)));

    assertEquals(1, repairs.size());
    assertTrue(events.isEmpty(), "nothing was sent");
  }

  private ByQueryPolicy.Attempt attempts(final ByQueryOutcome... outcomes) {
    final Deque<ByQueryOutcome> remaining = new ArrayDeque<>(List.of(outcomes));
    return () -> {
      events.add("attempt");
      return remaining.removeFirst();
    };
  }

  private static ByQueryOutcome conflicts(final long count) {
    return new ByQueryOutcome(count, List.of(), false);
  }
}
