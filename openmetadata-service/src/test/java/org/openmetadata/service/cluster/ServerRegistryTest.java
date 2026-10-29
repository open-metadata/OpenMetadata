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
package org.openmetadata.service.cluster;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Who counts as alive, and who as supporting a capability, from check-ins and registrations. */
class ServerRegistryTest {
  private static final long NOW = 1_793_300_000_000L;
  private static final long INTERVAL = 7_500;
  private static final List<String> ALL = List.of(ServerCapability.RDF_LIVE_WRITE_PAUSE.name());

  @Test
  void aLiveServerThatNeverRegisteredIsOlderThanTheRegistry() {
    assertEquals(
        Set.of("old (not registered: older than the server registry)"),
        lacking(List.of(checkIn("old", NOW)), Map.of()));
  }

  @Test
  void everyLiveServerRegisteredWithTheCapabilityLacksNothing() {
    assertTrue(
        lacking(
                List.of(checkIn("a", NOW), checkIn("b", NOW - 5_000)),
                Map.of("a", current(ALL), "b", current(ALL)))
            .isEmpty());
  }

  @Test
  void aServerThatStoppedCheckingInIsNotWaitedFor() {
    assertTrue(lacking(List.of(checkIn("gone", NOW - 10 * 60_000)), Map.of()).isEmpty());
  }

  @Test
  void aRegistrationThatStoppedHeartbeatingNoLongerCounts() {
    final ServerRegistry.Registration stale =
        new ServerRegistry.Registration("2.1.0", ALL, NOW - 10 * 60_000);

    assertEquals(
        Set.of("a (version 2.1.0)"), lacking(List.of(checkIn("a", NOW)), Map.of("a", stale)));
  }

  @Test
  void aServerWithoutTheCapabilityIsReportedWithItsVersion() {
    assertEquals(
        Set.of("a (version 2.1.0)"),
        lacking(List.of(checkIn("a", NOW)), Map.of("a", current(List.of()))));
  }

  private static Set<String> lacking(
      final List<ServerRegistry.CheckIn> checkIns,
      final Map<String, ServerRegistry.Registration> registrations) {
    return ServerRegistry.lacking(
        checkIns, registrations, ServerCapability.RDF_LIVE_WRITE_PAUSE, NOW);
  }

  private static ServerRegistry.CheckIn checkIn(final String instance, final long at) {
    return new ServerRegistry.CheckIn(instance, at, INTERVAL);
  }

  private static ServerRegistry.Registration current(final List<String> capabilities) {
    return new ServerRegistry.Registration("2.1.0", capabilities, NOW - 1_000);
  }
}
