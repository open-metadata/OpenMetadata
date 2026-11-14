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
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeFalse;

import java.time.Clock;
import java.time.Duration;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.Test;
import org.openmetadata.it.bootstrap.ForkedServerNode;
import org.openmetadata.it.bootstrap.ForkedServerNode.Settings;
import org.openmetadata.it.util.RdfTestUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.rdf.RdfLiveWriteStore;

/**
 * A server with RDF off records it in {@code rdf_projection_health} when it starts, when its stop
 * begins and at the end of its stop (#36440). The server here is a second process on the suite's
 * database, so every mark comes from its real lifecycle: nothing in this class writes them.
 */
@Tag("multi-node")
class RdfDisabledMarkLifecycleIT {
  private static final Duration SHUTDOWN_GRACE = Duration.ofSeconds(60);

  @Test
  void aServerWithRdfOffRecordsItWhenItStartsAndTwiceWhenItStops() {
    assumeFalse(RdfTestUtils.isRdfEnabled(), "The forked server copies the suite's RDF setting");
    final RdfLiveWriteStore health = new RdfLiveWriteStore(Entity.getJdbi(), Clock.systemUTC());
    final long failureVersionBeforeStart = health.failureVersion();

    final ForkedServerNode server = ForkedServerNode.start(Settings.DEFAULT);
    final long failureVersionAfterStart;
    final boolean stoppedByItself;
    try {
      failureVersionAfterStart = health.failureVersion();
      stoppedByItself = server.stopWithin(SHUTDOWN_GRACE);
    } finally {
      server.close();
    }

    assertTrue(
        failureVersionAfterStart >= failureVersionBeforeStart + 1, "the start was not recorded");
    assertTrue(stoppedByItself, "the server had to be killed, so its stop hooks may not have run");
    assertTrue(
        health.failureVersion() >= failureVersionAfterStart + 2,
        "the stop was not recorded both when it began and at its end");
  }
}
