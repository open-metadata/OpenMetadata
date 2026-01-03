/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.apps.bundles.searchIndex.distributed;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class SearchIndexJobTest {

  @Test
  void testProgressPercent_NoRecords() {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).totalRecords(0).processedRecords(0).build();

    assertEquals(0.0, job.getProgressPercent());
  }

  @Test
  void testProgressPercent_PartialProgress() {
    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .totalRecords(1000)
            .processedRecords(250)
            .build();

    assertEquals(25.0, job.getProgressPercent());
  }

  @Test
  void testProgressPercent_Complete() {
    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .totalRecords(1000)
            .processedRecords(1000)
            .build();

    assertEquals(100.0, job.getProgressPercent());
  }

  @Test
  void testIsTerminal_CompletedStatus() {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.COMPLETED).build();

    assertTrue(job.isTerminal());
  }

  @Test
  void testIsTerminal_CompletedWithErrorsStatus() {
    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .status(IndexJobStatus.COMPLETED_WITH_ERRORS)
            .build();

    assertTrue(job.isTerminal());
  }

  @Test
  void testIsTerminal_FailedStatus() {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.FAILED).build();

    assertTrue(job.isTerminal());
  }

  @Test
  void testIsTerminal_StoppedStatus() {
    SearchIndexJob job =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.STOPPED).build();

    assertTrue(job.isTerminal());
  }

  @Test
  void testIsTerminal_NonTerminalStatuses() {
    for (IndexJobStatus status :
        new IndexJobStatus[] {
          IndexJobStatus.INITIALIZING,
          IndexJobStatus.READY,
          IndexJobStatus.RUNNING,
          IndexJobStatus.STOPPING
        }) {
      SearchIndexJob job = SearchIndexJob.builder().id(UUID.randomUUID()).status(status).build();

      assertFalse(job.isTerminal(), "Status " + status + " should not be terminal");
    }
  }

  @Test
  void testIsRunning() {
    SearchIndexJob runningJob =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.RUNNING).build();

    assertTrue(runningJob.isRunning());

    SearchIndexJob notRunningJob =
        SearchIndexJob.builder().id(UUID.randomUUID()).status(IndexJobStatus.READY).build();

    assertFalse(notRunningJob.isRunning());
  }

  @Test
  void testEntityTypeStats_ProgressPercent() {
    SearchIndexJob.EntityTypeStats stats =
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(1000)
            .processedRecords(500)
            .successRecords(450)
            .failedRecords(50)
            .build();

    assertEquals(50.0, stats.getProgressPercent());
  }

  @Test
  void testEntityTypeStats_NoRecords() {
    SearchIndexJob.EntityTypeStats stats =
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("empty")
            .totalRecords(0)
            .processedRecords(0)
            .build();

    assertEquals(0.0, stats.getProgressPercent());
  }

  @Test
  void testBuilderWithStats() {
    Map<String, SearchIndexJob.EntityTypeStats> entityStats = new HashMap<>();
    entityStats.put(
        "table",
        SearchIndexJob.EntityTypeStats.builder()
            .entityType("table")
            .totalRecords(500)
            .processedRecords(100)
            .successRecords(100)
            .failedRecords(0)
            .totalPartitions(5)
            .completedPartitions(1)
            .failedPartitions(0)
            .build());

    SearchIndexJob job =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .status(IndexJobStatus.RUNNING)
            .totalRecords(500)
            .processedRecords(100)
            .successRecords(100)
            .failedRecords(0)
            .entityStats(entityStats)
            .createdBy("admin")
            .createdAt(System.currentTimeMillis())
            .updatedAt(System.currentTimeMillis())
            .build();

    assertEquals(20.0, job.getProgressPercent());
    assertEquals(1, job.getEntityStats().size());
    assertEquals(20.0, job.getEntityStats().get("table").getProgressPercent());
  }

  @Test
  void testToBuilder() {
    long now = System.currentTimeMillis();
    SearchIndexJob original =
        SearchIndexJob.builder()
            .id(UUID.randomUUID())
            .status(IndexJobStatus.RUNNING)
            .totalRecords(1000)
            .processedRecords(500)
            .createdAt(now)
            .updatedAt(now)
            .build();

    SearchIndexJob updated =
        original.toBuilder()
            .processedRecords(750)
            .successRecords(700)
            .failedRecords(50)
            .updatedAt(now + 1000)
            .build();

    // Original should be unchanged
    assertEquals(500, original.getProcessedRecords());

    // Updated should have new values
    assertEquals(750, updated.getProcessedRecords());
    assertEquals(700, updated.getSuccessRecords());
    assertEquals(50, updated.getFailedRecords());

    // Unchanged values should be preserved
    assertEquals(original.getId(), updated.getId());
    assertEquals(original.getTotalRecords(), updated.getTotalRecords());
    assertEquals(original.getStatus(), updated.getStatus());
  }
}
