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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.zaxxer.hikari.HikariDataSource;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.HikariCPDataSourceFactory.PoolWorkload;

/**
 * {@link HikariCPDataSourceFactory#buildSubsystemPool} is the single door through which the Quartz
 * job stores and the Flowable engine now reach the database, so every setting it forwards from
 * yaml is a setting those subsystems used to silently lose.
 *
 * <p>None of these tests open a socket: buildSubsystemPool defers the first physical connect past
 * pool construction.
 */
class HikariCPDataSourceFactorySubsystemPoolTest {

  private static HikariCPDataSourceFactory factory() {
    HikariCPDataSourceFactory factory = new HikariCPDataSourceFactory();
    factory.setUrl("jdbc:postgresql://localhost:5432/openmetadata_db");
    factory.setUser("openmetadata_user");
    factory.setPassword("openmetadata_password");
    factory.setDriverClass("org.postgresql.Driver");
    return factory;
  }

  @Test
  void appliesTheRequestedNameAndSize() {
    try (HikariDataSource pool =
        factory()
            .buildSubsystemPool("some-subsystem-pool", 7, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals("some-subsystem-pool", pool.getPoolName());
      assertEquals(7, pool.getMaximumPoolSize());
      // Background subsystems idle for long stretches; holding a full complement of warm
      // connections open just to serve a cron tick wastes database sessions.
      assertEquals(1, pool.getMinimumIdle());
    }
  }

  @Test
  void sizeIsIndependentOfTheRequestPool() {
    HikariCPDataSourceFactory factory = factory();
    factory.setMaxSize(100);

    try (HikariDataSource pool =
        factory.buildSubsystemPool("bounded-pool", 12, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals(
          12,
          pool.getMaximumPoolSize(),
          "a subsystem pool must not inherit the request pool's size, or every subsystem "
              + "multiplies the server's session footprint");
    }
  }

  @Test
  void inheritsTopLevelConnectionTimeoutFromYaml() {
    HikariCPDataSourceFactory factory = factory();
    factory.setConnectionTimeout(45_000L);

    try (HikariDataSource pool =
        factory.buildSubsystemPool("timeout-pool", 4, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals(45_000L, pool.getConnectionTimeout());
    }
  }

  @Test
  void inheritsNestedConnectionTimeoutFromYaml() {
    // openmetadata.yaml accepts connectionTimeout either as a top-level database field or nested
    // under database.properties. Both shapes must reach a subsystem pool or ops-side tuning
    // applies to request traffic only.
    HikariCPDataSourceFactory factory = factory();
    factory.setProperties(Map.of("connectionTimeout", "45000"));

    try (HikariDataSource pool =
        factory.buildSubsystemPool("timeout-pool", 4, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals(45_000L, pool.getConnectionTimeout());
    }
  }

  @Test
  void appliesTransactionIsolationOnlyWhenRequested() {
    try (HikariDataSource isolated =
            factory()
                .buildSubsystemPool(
                    "isolated-pool",
                    4,
                    "TRANSACTION_READ_COMMITTED",
                    PoolWorkload.SHORT_STATEMENTS);
        HikariDataSource dflt =
            factory().buildSubsystemPool("default-pool", 4, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals("TRANSACTION_READ_COMMITTED", isolated.getTransactionIsolation());
      assertNull(dflt.getTransactionIsolation(), "null must leave the driver default in place");
    }
  }

  @Test
  void handsOutAnIndependentPoolPerCall() {
    // Each subsystem owns its connections: API traffic must not be able to starve a Quartz
    // cluster check-in, and a Flowable command holding a connection across a REST call must not
    // be able to starve API traffic.
    try (HikariDataSource first =
            factory().buildSubsystemPool("first-pool", 4, null, PoolWorkload.SHORT_STATEMENTS);
        HikariDataSource second =
            factory().buildSubsystemPool("second-pool", 4, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertNotSame(first, second);
    }
  }

  @Test
  void shortStatementWorkloadKeepsTheProtectiveDefaults() {
    // Quartz job-store operations are short and returned promptly. A hung query or an unreturned
    // connection is a real problem when the pool holds a dozen connections, so both guards stay.
    try (HikariDataSource pool =
        factory().buildSubsystemPool("quartz-pool", 12, null, PoolWorkload.SHORT_STATEMENTS)) {
      assertEquals(60_000L, pool.getLeakDetectionThreshold());
      assertEquals("300", pool.getDataSourceProperties().getProperty("socketTimeout"));
    }
  }

  @Test
  void longCheckoutWorkloadDisablesLeakDetectionButKeepsSocketTimeout() {
    // A Flowable command can hold a connection past 60s while its service task calls the REST API
    // or search. Leak detection measures checkout duration, so it would log alarming "connection
    // leak" traces for correct behaviour. The individual reads are still short, so the socket
    // timeout remains useful and stays.
    try (HikariDataSource pool =
        factory().buildSubsystemPool("runtime-pool", 24, null, PoolWorkload.LONG_CHECKOUTS)) {
      assertEquals(0L, pool.getLeakDetectionThreshold(), "0 disables HikariCP leak detection");
      assertEquals("300", pool.getDataSourceProperties().getProperty("socketTimeout"));
    }
  }

  @Test
  void longStatementWorkloadAlsoClearsTheSocketTimeout() {
    // Flowable's schema upgrade issues DDL that can legitimately exceed five minutes against a
    // large ACT_HI_* table. Inheriting socketTimeout=300 would sever that statement and leave the
    // migration half-applied.
    try (HikariDataSource pool =
        factory().buildSubsystemPool("migration-pool", 10, null, PoolWorkload.LONG_STATEMENTS)) {
      assertEquals(0L, pool.getLeakDetectionThreshold());
      assertEquals(
          "0",
          pool.getDataSourceProperties().getProperty("socketTimeout"),
          "0 means no socket timeout, so long DDL is not severed mid-migration");
    }
  }

  @Test
  void operatorSocketTimeoutStillWinsOverTheLongStatementRelaxation() {
    // The relaxation is a default, not an override: an operator who wants a bound on migration
    // DDL must still be able to set one.
    HikariCPDataSourceFactory factory = factory();
    factory.setProperties(Map.of("socketTimeout", "900"));

    try (HikariDataSource pool =
        factory.buildSubsystemPool("migration-pool", 10, null, PoolWorkload.LONG_STATEMENTS)) {
      assertEquals("900", pool.getDataSourceProperties().getProperty("socketTimeout"));
    }
  }
}
