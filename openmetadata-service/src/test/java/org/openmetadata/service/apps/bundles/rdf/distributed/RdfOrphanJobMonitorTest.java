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
package org.openmetadata.service.apps.bundles.rdf.distributed;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

@DisplayName("RdfOrphanJobMonitor")
class RdfOrphanJobMonitorTest {

  @Test
  @DisplayName("each sweep delegates recovery to the coordinator")
  void sweepDelegatesToCoordinator() {
    DistributedRdfIndexCoordinator coordinator = mock(DistributedRdfIndexCoordinator.class);
    RdfOrphanJobMonitor monitor = new RdfOrphanJobMonitor(coordinator);

    monitor.checkForOrphanedJobs();
    monitor.checkForOrphanedJobs();

    verify(coordinator, times(2)).performStartupRecovery();
  }

  @Test
  @DisplayName("a failing sweep is contained so the schedule keeps running")
  void sweepSwallowsRecoveryFailures() {
    // scheduleAtFixedRate cancels the task permanently if a run throws, which would
    // silently stop orphan recovery on this server until the next restart.
    DistributedRdfIndexCoordinator coordinator = mock(DistributedRdfIndexCoordinator.class);
    doThrow(new IllegalStateException("database unavailable"))
        .when(coordinator)
        .performStartupRecovery();
    RdfOrphanJobMonitor monitor = new RdfOrphanJobMonitor(coordinator);

    assertDoesNotThrow(monitor::checkForOrphanedJobs);
    assertDoesNotThrow(monitor::checkForOrphanedJobs);

    verify(coordinator, times(2)).performStartupRecovery();
  }

  @Test
  @DisplayName("start is idempotent and shutdown is safe in any order")
  void lifecycleIsIdempotent() {
    DistributedRdfIndexCoordinator coordinator = mock(DistributedRdfIndexCoordinator.class);
    RdfOrphanJobMonitor monitor = new RdfOrphanJobMonitor(coordinator);

    assertDoesNotThrow(monitor::shutdown);
    assertDoesNotThrow(monitor::start);
    assertDoesNotThrow(monitor::start);
    assertDoesNotThrow(monitor::shutdown);
    assertDoesNotThrow(monitor::shutdown);
  }
}
