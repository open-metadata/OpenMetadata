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

import java.time.Duration;
import java.util.EnumMap;
import java.util.Map;
import org.awaitility.Awaitility;
import org.jdbi.v3.core.Jdbi;
import org.testcontainers.containers.GenericContainer;

/** One container per SQL backend per test JVM; fixtures still own separate databases. */
final class SqlTestContainers {
  private static final Map<RdfTestDatabase.Backend, GenericContainer<?>> CONTAINERS =
      new EnumMap<>(RdfTestDatabase.Backend.class);

  private SqlTestContainers() {}

  static synchronized Jdbi connect(final RdfTestDatabase.Backend backend, final String database) {
    final GenericContainer<?> container =
        CONTAINERS.computeIfAbsent(backend, SqlTestContainers::start);
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    final String url =
        "jdbc:"
            + (mysql ? "mysql" : "postgresql")
            + "://"
            + container.getHost()
            + ":"
            + container.getMappedPort(mysql ? 3306 : 5432)
            + "/"
            + database
            + (mysql ? "?allowPublicKeyRetrieval=true&useSSL=false" : "");
    return Jdbi.create(url, mysql ? "root" : "postgres", "rdf-test");
  }

  private static GenericContainer<?> start(final RdfTestDatabase.Backend backend) {
    final boolean mysql = backend == RdfTestDatabase.Backend.MYSQL;
    final var container =
        new GenericContainer<>(mysql ? "mysql:8.0" : "postgres:15")
            .withExposedPorts(mysql ? 3306 : 5432)
            .withEnv("POSTGRES_PASSWORD", "rdf-test")
            .withEnv("POSTGRES_DB", "rdf")
            .withEnv("MYSQL_ROOT_PASSWORD", "rdf-test")
            .withEnv("MYSQL_DATABASE", "rdf")
            .withStartupTimeout(Duration.ofMinutes(3));
    container.start();
    Runtime.getRuntime().addShutdownHook(new Thread(container::close));
    return container;
  }

  static void awaitReady(final Jdbi jdbi) {
    Awaitility.await()
        .atMost(Duration.ofMinutes(2))
        .ignoreExceptions()
        .until(
            () ->
                jdbi.withHandle(handle -> handle.createQuery("SELECT 1").mapTo(Integer.class).one())
                    == 1);
  }
}
