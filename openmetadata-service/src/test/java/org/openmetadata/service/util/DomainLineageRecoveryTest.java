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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.params.provider.Arguments.arguments;

import java.util.List;
import java.util.Set;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.service.util.DomainLineageRecovery.State;
import org.openmetadata.service.util.DomainLineageRecovery.Status;

class DomainLineageRecoveryTest {

  /** drift, rebuilt, reindexed: what each recovery step, run in any order, leaves due. */
  static Stream<Arguments> versions() {
    return Stream.of(
        arguments(0, 0, 0, Status.HEALTHY),
        arguments(1, 0, 0, Status.REBUILD_REQUIRED),
        // A reindex run before the rebuild records the rebuilt version it started from: 0.
        arguments(1, 0, 0, Status.REBUILD_REQUIRED),
        arguments(1, 1, 0, Status.REINDEX_REQUIRED),
        arguments(1, 1, 1, Status.HEALTHY),
        // A write over the cap after both steps makes a rebuild due again.
        arguments(2, 1, 1, Status.REBUILD_REQUIRED),
        // A rebuild that started at drift 1 while a second write landed clears only the first.
        arguments(2, 1, 0, Status.REBUILD_REQUIRED),
        arguments(2, 2, 1, Status.REINDEX_REQUIRED),
        arguments(2, 2, 2, Status.HEALTHY));
  }

  @ParameterizedTest
  @MethodSource("versions")
  void theStatusFollowsTheVersions(long drift, long rebuilt, long reindexed, Status expected) {
    State state = new State(drift, rebuilt, reindexed, 0, 0, 0, 0, null);

    assertEquals(expected, state.status());
  }

  @Test
  void aStateNeverWrittenIsHealthy() {
    assertEquals(Status.HEALTHY, State.NEVER_DRIFTED.status());
  }

  @Test
  void onlyAReindexOfDomainsAndDataProductsClearsTheDomainView() {
    assertTrue(DomainLineageRecovery.reindexCoversDomainLineage(Set.of("all")));
    assertTrue(
        DomainLineageRecovery.reindexCoversDomainLineage(Set.of("domain", "dataProduct", "table")));
    assertFalse(DomainLineageRecovery.reindexCoversDomainLineage(Set.of("domain")));
    assertFalse(DomainLineageRecovery.reindexCoversDomainLineage(Set.of("dataProduct")));
    assertFalse(DomainLineageRecovery.reindexCoversDomainLineage(List.of("table")));
  }

  @Test
  void theOperatorMessageNamesTheCommandsThatClearWhatIsDue() {
    String rebuild =
        DomainLineageRecovery.describe(new State(1, 0, 0, 10, 10, 0, 0, "databaseService s1"));
    String reindex = DomainLineageRecovery.describe(new State(1, 1, 0, 10, 10, 20, 0, null));

    assertTrue(rebuild.contains(DomainLineageRecovery.REBUILD_COMMAND), rebuild);
    assertTrue(rebuild.contains(DomainLineageRecovery.REINDEX_COMMAND), rebuild);
    assertTrue(rebuild.contains("databaseService s1"), rebuild);
    assertFalse(reindex.contains(DomainLineageRecovery.REBUILD_COMMAND), reindex);
    assertTrue(reindex.contains(DomainLineageRecovery.REINDEX_COMMAND), reindex);
  }
}
