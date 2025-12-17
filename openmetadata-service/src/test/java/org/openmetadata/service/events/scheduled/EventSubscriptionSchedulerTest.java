/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.events.scheduled;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Field;
import java.util.Map;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

/**
 * Unit tests for EventSubscriptionScheduler clustering configuration.
 *
 * <p>These tests verify that the scheduler is properly configured for clustered execution in
 * multi-server deployments, which prevents duplicate notifications from being sent.
 */
class EventSubscriptionSchedulerTest {

  @Test
  @DisplayName("Scheduler configuration should enable clustering")
  void testClusteringEnabled() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertEquals(
        "true",
        config.get("org.quartz.jobStore.isClustered"),
        "Clustering must be enabled for multi-server deployments");
  }

  @Test
  @DisplayName("Scheduler should use JDBC JobStore for distributed locking")
  void testJdbcJobStoreConfigured() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertEquals(
        "org.quartz.impl.jdbcjobstore.JobStoreTX",
        config.get("org.quartz.jobStore.class"),
        "JDBC JobStore is required for clustering support");
  }

  @Test
  @DisplayName("Scheduler should use AUTO instance ID for unique server identification")
  void testAutoInstanceId() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertEquals(
        "AUTO",
        config.get("org.quartz.scheduler.instanceId"),
        "AUTO instance ID ensures unique identification per server");
  }

  @Test
  @DisplayName("Scheduler should have cluster check-in interval configured")
  void testClusterCheckInInterval() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertNotNull(
        config.get("org.quartz.jobStore.clusterCheckinInterval"),
        "Cluster check-in interval must be configured for failover");

    int checkInInterval =
        Integer.parseInt(config.get("org.quartz.jobStore.clusterCheckinInterval"));
    assertTrue(
        checkInInterval > 0 && checkInInterval <= 60000,
        "Check-in interval should be reasonable (1-60 seconds)");
  }

  @Test
  @DisplayName("Scheduler should use QRTZ_ table prefix")
  void testQuartzTablePrefix() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertEquals(
        "QRTZ_",
        config.get("org.quartz.jobStore.tablePrefix"),
        "Table prefix must match existing Quartz tables");
  }

  @Test
  @DisplayName("Scheduler should have data source configured")
  void testDataSourceConfigured() throws Exception {
    Map<String, String> config = getClusteredSchedulerConfig();

    assertNotNull(
        config.get("org.quartz.jobStore.dataSource"), "Data source must be configured for JDBC");
    assertNotNull(
        config.get("org.quartz.dataSource.omDS.maxConnections"),
        "Max connections must be configured");
  }

  @SuppressWarnings("unchecked")
  private Map<String, String> getClusteredSchedulerConfig() throws Exception {
    Field configField =
        EventSubscriptionScheduler.class.getDeclaredField("CLUSTERED_SCHEDULER_CONFIG");
    configField.setAccessible(true);
    return (Map<String, String>) configField.get(null);
  }
}
