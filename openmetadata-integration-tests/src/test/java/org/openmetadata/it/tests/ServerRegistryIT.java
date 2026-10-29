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

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Clock;
import java.util.EnumMap;
import java.util.Map;
import java.util.Set;
import org.jdbi.v3.core.Jdbi;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.openmetadata.service.cluster.ServerCapability;
import org.openmetadata.service.cluster.ServerRegistry;

/**
 * The server registry against real MySQL and PostgreSQL. A server that checks in to the Quartz
 * cluster without registering, as every server from before the registry does, is waited for until
 * it stops checking in.
 */
@Tag("rdf")
@EnabledIfSystemProperty(named = "enableRdf", matches = "true")
@Execution(ExecutionMode.SAME_THREAD)
public class ServerRegistryIT {
  private static final String SCHEDULER = "AppScheduler";
  private static final Map<RdfTestDatabase.Backend, RdfTestDatabase> DATABASES =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  @BeforeAll
  static void startDatabases() {
    for (RdfTestDatabase.Backend backend : RdfTestDatabase.Backend.values()) {
      DATABASES.put(backend, new RdfTestDatabase(backend));
    }
  }

  @AfterAll
  static void stopDatabases() {
    DATABASES.values().forEach(RdfTestDatabase::close);
    DATABASES.clear();
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aServerOlderThanTheRegistryIsWaitedForUntilItStopsCheckingIn(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = clean(backend);
    checkIn(jdbi, "upgraded-server");
    checkIn(jdbi, "old-server");
    final ServerRegistry registry = registry(jdbi, "upgraded-server", "2.1.0");
    registry.start();
    try {
      assertEquals(
          Set.of("old-server (not registered: older than the server registry)"),
          registry.serversLacking(ServerCapability.RDF_LIVE_WRITE_PAUSE));

      stopCheckingIn(jdbi, "old-server");

      assertEquals(Set.of(), registry.serversLacking(ServerCapability.RDF_LIVE_WRITE_PAUSE));
    } finally {
      registry.stop();
    }
  }

  @ParameterizedTest
  @EnumSource(RdfTestDatabase.Backend.class)
  void aRestartedServerKeepsOneRegistrationWithItsCurrentVersion(
      final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = clean(backend);
    checkIn(jdbi, "server");
    final ServerRegistry before = registry(jdbi, "server", "2.1.0");
    before.start();
    before.stop();

    final ServerRegistry after = registry(jdbi, "server", "2.1.1");
    after.start();
    try {
      assertEquals(
          "2.1.1",
          jdbi.withHandle(
              handle ->
                  handle
                      .createQuery("SELECT version FROM server_registry")
                      .mapTo(String.class)
                      .one()));
    } finally {
      after.stop();
    }
  }

  private static ServerRegistry registry(
      final Jdbi jdbi, final String instance, final String version) {
    return new ServerRegistry(
        jdbi,
        Clock.systemUTC(),
        () -> new ServerRegistry.ClusterIdentity(SCHEDULER, instance),
        instance,
        version);
  }

  private static Jdbi clean(final RdfTestDatabase.Backend backend) {
    final Jdbi jdbi = DATABASES.get(backend).jdbi();
    jdbi.useHandle(
        handle -> {
          handle.execute("DELETE FROM QRTZ_SCHEDULER_STATE");
          handle.execute("DELETE FROM server_registry");
        });
    return jdbi;
  }

  private static void checkIn(final Jdbi jdbi, final String instance) {
    jdbi.useHandle(
        handle ->
            handle
                .createUpdate(
                    "INSERT INTO QRTZ_SCHEDULER_STATE (SCHED_NAME, INSTANCE_NAME,"
                        + " LAST_CHECKIN_TIME, CHECKIN_INTERVAL) VALUES (:scheduler, :instance,"
                        + " :now, 7500)")
                .bind("scheduler", SCHEDULER)
                .bind("instance", instance)
                .bind("now", System.currentTimeMillis())
                .execute());
  }

  private static void stopCheckingIn(final Jdbi jdbi, final String instance) {
    jdbi.useHandle(
        handle ->
            handle
                .createUpdate(
                    "UPDATE QRTZ_SCHEDULER_STATE SET LAST_CHECKIN_TIME = :longAgo"
                        + " WHERE INSTANCE_NAME = :instance")
                .bind("longAgo", System.currentTimeMillis() - 3_600_000)
                .bind("instance", instance)
                .execute());
  }
}
