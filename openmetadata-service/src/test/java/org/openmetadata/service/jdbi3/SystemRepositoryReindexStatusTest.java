/*
 *  Copyright 2024 Collate.
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
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.SystemRepository.ReindexStatus;
import org.openmetadata.service.jdbi3.SystemRepository.SearchReindexStatus;
import org.openmetadata.service.search.IndexMappingVersionTracker.MappingDriftState;

class SystemRepositoryReindexStatusTest {

  @Test
  void staleEntityWithLiveIndexIsReportedPending() {
    Map<String, MappingDriftState> drift = Map.of("table", MappingDriftState.STALE);
    ReindexStatus status = SystemRepository.classifyReindexStatus(drift, Set.of("table"));
    assertEquals(1, status.stalePending().size());
    assertTrue(status.stalePending().contains("table"));
  }

  @Test
  void missingIndexIsSkippedSoItIsNotDoubleReported() {
    Map<String, MappingDriftState> drift = Map.of("table", MappingDriftState.STALE);
    ReindexStatus status = SystemRepository.classifyReindexStatus(drift, Set.of());
    assertTrue(status.stalePending().isEmpty());
    assertEquals(0, status.untrackedCount());
  }

  @Test
  void untrackedEntityWithLiveIndexIsNotedNotFailed() {
    Map<String, MappingDriftState> drift = Map.of("table", MappingDriftState.UNTRACKED);
    ReindexStatus status = SystemRepository.classifyReindexStatus(drift, Set.of("table"));
    assertTrue(status.stalePending().isEmpty());
    assertEquals(1, status.untrackedCount());
  }

  @Test
  void currentEntityProducesNoFinding() {
    Map<String, MappingDriftState> drift = Map.of("table", MappingDriftState.CURRENT);
    ReindexStatus status = SystemRepository.classifyReindexStatus(drift, Set.of("table"));
    assertTrue(status.stalePending().isEmpty());
    assertEquals(0, status.untrackedCount());
  }

  @Test
  void stalePendingIsReturnedInSortedOrder() {
    Map<String, MappingDriftState> drift =
        Map.of(
            "topic", MappingDriftState.STALE,
            "chart", MappingDriftState.STALE,
            "dashboard", MappingDriftState.STALE);
    ReindexStatus status =
        SystemRepository.classifyReindexStatus(drift, Set.of("topic", "chart", "dashboard"));
    assertEquals(List.of("chart", "dashboard", "topic"), status.stalePending());
  }

  @Test
  void reindexMessageCleanStateMentionsNoOrphansAndHealthyCluster() {
    SearchReindexStatus status = new SearchReindexStatus(List.of(), 0, List.of(), List.of(), true);
    String message = SystemRepository.buildReindexStatusMessage(status);
    assertTrue(message.contains("All deployed indexes were built from the current code mappings."));
    assertTrue(message.toLowerCase().contains("no orphan indexes"));
    assertTrue(message.toLowerCase().contains("cluster healthy"));
  }

  @Test
  void reindexMessageReportsStaleMissingOrphanAndDegradedCluster() {
    SearchReindexStatus status =
        new SearchReindexStatus(
            List.of("dashboard"), 0, List.of("glossary"), List.of("topic_rebuild_1"), false);
    String message = SystemRepository.buildReindexStatusMessage(status);
    assertTrue(message.contains("reindex is required"));
    assertTrue(message.contains("dashboard"));
    assertTrue(message.contains("glossary"));
    assertTrue(message.contains("topic_rebuild_1"));
    assertTrue(message.toLowerCase().contains("orphan"));
    assertTrue(message.toLowerCase().contains("degraded"));
  }

  @Test
  void reindexMessageMentionsUntrackedNoteWhenClean() {
    SearchReindexStatus status = new SearchReindexStatus(List.of(), 3, List.of(), List.of(), true);
    String message = SystemRepository.buildReindexStatusMessage(status);
    assertTrue(message.contains("3"));
    assertTrue(message.toLowerCase().contains("version-tracked"));
  }
}
