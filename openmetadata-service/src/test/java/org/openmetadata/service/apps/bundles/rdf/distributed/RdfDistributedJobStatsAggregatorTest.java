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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.rdf.distributed.RdfIndexJob.EntityTypeStats;

class RdfDistributedJobStatsAggregatorTest {

  private final RdfDistributedJobStatsAggregator aggregator =
      new RdfDistributedJobStatsAggregator();

  @Test
  void mapsJobLevelRecordCountsFromJob() {
    RdfIndexJob job =
        RdfIndexJob.builder().totalRecords(1000L).successRecords(950L).failedRecords(50L).build();

    Stats stats = aggregator.toStats(job);

    StepStats jobStats = stats.getJobStats();
    assertNotNull(jobStats);
    assertEquals(1000, jobStats.getTotalRecords());
    assertEquals(950, jobStats.getSuccessRecords());
    assertEquals(50, jobStats.getFailedRecords());
  }

  @Test
  void populatesPerEntityStatsFromEntityStatsMap() {
    EntityTypeStats tableStats =
        EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(300L)
            .successRecords(280L)
            .failedRecords(20L)
            .build();
    EntityTypeStats dashboardStats =
        EntityTypeStats.builder()
            .entityType("dashboard")
            .totalRecords(100L)
            .successRecords(100L)
            .failedRecords(0L)
            .build();

    RdfIndexJob job =
        RdfIndexJob.builder()
            .entityStats(Map.of("table", tableStats, "dashboard", dashboardStats))
            .build();

    Stats stats = aggregator.toStats(job);

    Map<String, StepStats> perEntity = stats.getEntityStats().getAdditionalProperties();
    assertEquals(2, perEntity.size());

    StepStats table = perEntity.get("table");
    assertNotNull(table);
    assertEquals(300, table.getTotalRecords());
    assertEquals(280, table.getSuccessRecords());
    assertEquals(20, table.getFailedRecords());

    StepStats dashboard = perEntity.get("dashboard");
    assertNotNull(dashboard);
    assertEquals(100, dashboard.getTotalRecords());
    assertEquals(100, dashboard.getSuccessRecords());
    assertEquals(0, dashboard.getFailedRecords());
  }

  @Test
  void returnsEmptyEntityStatsWhenJobEntityStatsIsNull() {
    RdfIndexJob job = RdfIndexJob.builder().totalRecords(5L).build();

    Stats stats = aggregator.toStats(job);

    EntityStats entityStats = stats.getEntityStats();
    assertNotNull(entityStats);
    assertTrue(entityStats.getAdditionalProperties().isEmpty());
  }

  @Test
  void clampsValuesAboveIntegerMaxToMaxValue() {
    long overflow = ((long) Integer.MAX_VALUE) + 1000L;
    RdfIndexJob job = RdfIndexJob.builder().totalRecords(overflow).build();

    Stats stats = aggregator.toStats(job);

    assertEquals(Integer.MAX_VALUE, stats.getJobStats().getTotalRecords());
  }

  @Test
  void clampsValuesBelowIntegerMinToMinValue() {
    long underflow = ((long) Integer.MIN_VALUE) - 1000L;
    RdfIndexJob job = RdfIndexJob.builder().successRecords(underflow).build();

    Stats stats = aggregator.toStats(job);

    assertEquals(Integer.MIN_VALUE, stats.getJobStats().getSuccessRecords());
  }

  @Test
  void clampsPerEntityValuesExceedingIntegerRange() {
    long overflow = ((long) Integer.MAX_VALUE) + 42L;
    EntityTypeStats hugeStats =
        EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(overflow)
            .successRecords(overflow)
            .failedRecords(0L)
            .build();

    RdfIndexJob job = RdfIndexJob.builder().entityStats(Map.of("table", hugeStats)).build();

    Stats stats = aggregator.toStats(job);

    StepStats table = stats.getEntityStats().getAdditionalProperties().get("table");
    assertEquals(Integer.MAX_VALUE, table.getTotalRecords());
    assertEquals(Integer.MAX_VALUE, table.getSuccessRecords());
    assertEquals(0, table.getFailedRecords());
  }

  @Test
  void passesThroughExactIntegerBoundaryValues() {
    RdfIndexJob job =
        RdfIndexJob.builder()
            .totalRecords(Integer.MAX_VALUE)
            .failedRecords(Integer.MIN_VALUE)
            .build();

    Stats stats = aggregator.toStats(job);

    assertEquals(Integer.MAX_VALUE, stats.getJobStats().getTotalRecords());
    assertEquals(Integer.MIN_VALUE, stats.getJobStats().getFailedRecords());
  }
}
