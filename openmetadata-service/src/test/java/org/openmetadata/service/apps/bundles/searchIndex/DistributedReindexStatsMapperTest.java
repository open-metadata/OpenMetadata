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

package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.jdbi3.CollectionDAO;

class DistributedReindexStatsMapperTest {

  private static final UUID JOB_ID = UUID.fromString("00000000-0000-0000-0000-0000000000f1");

  private CollectionDAO.SearchIndexServerStatsDAO serverStatsDAO;
  private DistributedReindexStatsMapper statsMapper;

  @BeforeEach
  void setUp() {
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    serverStatsDAO = mock(CollectionDAO.SearchIndexServerStatsDAO.class);
    when(collectionDAO.searchIndexServerStatsDAO()).thenReturn(serverStatsDAO);
    statsMapper = new DistributedReindexStatsMapper(collectionDAO);
  }

  @Test
  @DisplayName("A doc skipped for a stale reference stays counted in the process totals")
  void staleReferenceWarningKeepsProcessTotalEqualToReaderTotal() {
    givenAggregatedStats(124, 1, 123, 0, 123);
    Stats stats = newStats();

    statsMapper.updateStats(stats, distributedJob(124, 124, 123), null, null);

    assertEquals(124, stats.getReaderStats().getTotalRecords());
    assertEquals(
        stats.getReaderStats().getTotalRecords(),
        stats.getProcessStats().getTotalRecords(),
        "every record the reader emitted must be accounted for by the process stage");
    assertEquals(123, stats.getProcessStats().getSuccessRecords());
    assertEquals(1, stats.getProcessStats().getWarningRecords());
    assertEquals(0, stats.getProcessStats().getFailedRecords());
  }

  @Test
  @DisplayName("Successfully processed records still balance against the sink")
  void processSuccessBalancesAgainstSinkAfterAWarning() {
    givenAggregatedStats(124, 1, 123, 0, 123);
    Stats stats = newStats();

    statsMapper.updateStats(stats, distributedJob(124, 124, 123), null, null);

    StepStats sink = stats.getSinkStats();
    assertEquals(
        stats.getProcessStats().getSuccessRecords(),
        sink.getSuccessRecords() + sink.getFailedRecords() + sink.getWarningRecords());
  }

  @Test
  @DisplayName("A clean run reports no process warnings")
  void cleanRunReportsNoProcessWarnings() {
    givenAggregatedStats(50, 0, 50, 0, 50);
    Stats stats = newStats();

    statsMapper.updateStats(stats, distributedJob(50, 50, 50), null, null);

    assertEquals(50, stats.getProcessStats().getTotalRecords());
    assertEquals(50, stats.getProcessStats().getSuccessRecords());
    assertEquals(0, stats.getProcessStats().getWarningRecords());
  }

  @Test
  @DisplayName("Process outcomes exceeding the reader hand-off do not produce negative warnings")
  void processOutcomesAboveReaderHandOffClampWarningsToZero() {
    givenAggregatedStats(10, 0, 12, 0, 12);
    Stats stats = newStats();

    statsMapper.updateStats(stats, distributedJob(12, 12, 12), null, null);

    assertEquals(0, stats.getProcessStats().getWarningRecords());
    assertEquals(12, stats.getProcessStats().getTotalRecords());
  }

  private void givenAggregatedStats(
      long readerSuccess,
      long readerWarnings,
      long processSuccess,
      long processFailed,
      long sinkSuccess) {
    when(serverStatsDAO.getAggregatedStats(JOB_ID.toString()))
        .thenReturn(
            new CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats(
                readerSuccess,
                0,
                readerWarnings,
                sinkSuccess,
                0,
                processSuccess,
                processFailed,
                0,
                0,
                0,
                0,
                0,
                0,
                1,
                0));
  }

  private SearchIndexJob distributedJob(
      long totalRecords, long processedRecords, long successRecords) {
    return SearchIndexJob.builder()
        .id(JOB_ID)
        .totalRecords(totalRecords)
        .processedRecords(processedRecords)
        .successRecords(successRecords)
        .failedRecords(0)
        .build();
  }

  private Stats newStats() {
    return new Stats()
        .withJobStats(new StepStats())
        .withReaderStats(new StepStats())
        .withProcessStats(new StepStats())
        .withSinkStats(new StepStats());
  }
}
