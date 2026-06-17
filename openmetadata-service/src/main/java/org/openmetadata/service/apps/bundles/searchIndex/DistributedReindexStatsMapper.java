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

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.searchIndex.distributed.SearchIndexJob;
import org.openmetadata.service.jdbi3.CollectionDAO;

@Slf4j
class DistributedReindexStatsMapper {
  private final CollectionDAO collectionDAO;

  DistributedReindexStatsMapper(CollectionDAO collectionDAO) {
    this.collectionDAO = collectionDAO;
  }

  void updateStats(
      Stats stats,
      SearchIndexJob distributedJob,
      StepStats actualSinkStats,
      StepStats columnStats) {
    if (stats == null) {
      return;
    }

    CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats =
        getAggregatedServerStats(distributedJob);
    StatsSource source = resolveStatsSource(distributedJob, aggregatedStats, actualSinkStats);

    LOG.debug(
        "Stats source: {}, success={}, failed={}",
        source.name(),
        source.successRecords(),
        source.failedRecords());

    updateJobStats(stats, source);
    updateReaderStats(stats, distributedJob, aggregatedStats);
    updateProcessStats(stats, aggregatedStats);
    updateSinkStats(stats, distributedJob, aggregatedStats, source);
    updateVectorStats(stats, aggregatedStats);
    updateEntityStats(stats, distributedJob);
    updateColumnStats(stats, columnStats);

    StatsReconciler.reconcile(stats);
  }

  private CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats getAggregatedServerStats(
      SearchIndexJob distributedJob) {
    try {
      return collectionDAO
          .searchIndexServerStatsDAO()
          .getAggregatedStats(distributedJob.getId().toString());
    } catch (Exception e) {
      LOG.debug("Could not fetch aggregated server stats for job {}", distributedJob.getId(), e);
      return null;
    }
  }

  private StatsSource resolveStatsSource(
      SearchIndexJob distributedJob,
      CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats,
      StepStats actualSinkStats) {
    if (hasAggregatedStageRecords(aggregatedStats)) {
      return new StatsSource(
          "serverStatsTable",
          aggregatedStats.sinkSuccess(),
          aggregatedStats.readerFailed()
              + aggregatedStats.sinkFailed()
              + aggregatedStats.processFailed());
    }
    if (actualSinkStats != null) {
      return new StatsSource(
          "localSink", actualSinkStats.getSuccessRecords(), actualSinkStats.getFailedRecords());
    }
    return new StatsSource(
        "partition-based", distributedJob.getSuccessRecords(), distributedJob.getFailedRecords());
  }

  private boolean hasAggregatedStageRecords(
      CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats) {
    return aggregatedStats != null
        && (aggregatedStats.readerSuccess() > 0
            || aggregatedStats.readerFailed() > 0
            || aggregatedStats.readerWarnings() > 0
            || aggregatedStats.processSuccess() > 0
            || aggregatedStats.processFailed() > 0
            || aggregatedStats.sinkSuccess() > 0
            || aggregatedStats.sinkFailed() > 0
            || aggregatedStats.vectorSuccess() > 0
            || aggregatedStats.vectorFailed() > 0);
  }

  private void updateJobStats(Stats stats, StatsSource source) {
    StepStats jobStats = stats.getJobStats();
    if (jobStats != null) {
      jobStats.setSuccessRecords(saturatedToInt(source.successRecords()));
      jobStats.setFailedRecords(saturatedToInt(source.failedRecords()));
    }
  }

  private void updateReaderStats(
      Stats stats,
      SearchIndexJob distributedJob,
      CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats) {
    StepStats readerStats = stats.getReaderStats();
    if (readerStats == null) {
      return;
    }

    readerStats.setTotalRecords(saturatedToInt(distributedJob.getTotalRecords()));
    long readerFailed = aggregatedStats != null ? aggregatedStats.readerFailed() : 0;
    long readerWarnings = aggregatedStats != null ? aggregatedStats.readerWarnings() : 0;
    long readerSuccess =
        aggregatedStats != null
            ? aggregatedStats.readerSuccess()
            : distributedJob.getTotalRecords() - readerFailed - readerWarnings;
    readerStats.setSuccessRecords(saturatedToInt(readerSuccess));
    readerStats.setFailedRecords(saturatedToInt(readerFailed));
    readerStats.setWarningRecords(saturatedToInt(readerWarnings));
    if (aggregatedStats != null) {
      readerStats.setTotalTimeMs(aggregatedStats.readerTimeMs());
    }
  }

  private void updateProcessStats(
      Stats stats, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats) {
    StepStats processStats = stats.getProcessStats();
    if (processStats == null || aggregatedStats == null) {
      return;
    }

    long processSuccess = aggregatedStats.processSuccess();
    long processFailed = aggregatedStats.processFailed();
    processStats.setTotalRecords(saturatedToInt(processSuccess + processFailed));
    processStats.setSuccessRecords(saturatedToInt(processSuccess));
    processStats.setFailedRecords(saturatedToInt(processFailed));
    processStats.setTotalTimeMs(aggregatedStats.processTimeMs());
  }

  private void updateSinkStats(
      Stats stats,
      SearchIndexJob distributedJob,
      CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats,
      StatsSource source) {
    StepStats sinkStats = stats.getSinkStats();
    if (sinkStats == null) {
      return;
    }

    if (aggregatedStats != null) {
      long sinkSuccess = aggregatedStats.sinkSuccess();
      long sinkFailed = aggregatedStats.sinkFailed();
      sinkStats.setTotalRecords(saturatedToInt(sinkSuccess + sinkFailed));
      sinkStats.setSuccessRecords(saturatedToInt(sinkSuccess));
      sinkStats.setFailedRecords(saturatedToInt(sinkFailed));
      sinkStats.setTotalTimeMs(aggregatedStats.sinkTimeMs());
      return;
    }

    sinkStats.setTotalRecords(saturatedToInt(distributedJob.getTotalRecords()));
    sinkStats.setSuccessRecords(saturatedToInt(source.successRecords()));
    sinkStats.setFailedRecords(saturatedToInt(source.failedRecords()));
  }

  private void updateVectorStats(
      Stats stats, CollectionDAO.SearchIndexServerStatsDAO.AggregatedServerStats aggregatedStats) {
    StepStats vectorStats = stats.getVectorStats();
    if (vectorStats == null || aggregatedStats == null) {
      return;
    }

    long vectorSuccess = aggregatedStats.vectorSuccess();
    long vectorFailed = aggregatedStats.vectorFailed();
    vectorStats.setTotalRecords(saturatedToInt(vectorSuccess + vectorFailed));
    vectorStats.setSuccessRecords(saturatedToInt(vectorSuccess));
    vectorStats.setFailedRecords(saturatedToInt(vectorFailed));
    vectorStats.setTotalTimeMs(aggregatedStats.vectorTimeMs());
  }

  private void updateEntityStats(Stats stats, SearchIndexJob distributedJob) {
    if (distributedJob.getEntityStats() == null || stats.getEntityStats() == null) {
      return;
    }

    for (Map.Entry<String, SearchIndexJob.EntityTypeStats> entry :
        distributedJob.getEntityStats().entrySet()) {
      StepStats entityStats = stats.getEntityStats().getAdditionalProperties().get(entry.getKey());
      if (entityStats != null) {
        SearchIndexJob.EntityTypeStats distributedEntityStats = entry.getValue();
        long success = distributedEntityStats.getSuccessRecords();
        long failed = distributedEntityStats.getFailedRecords();
        long warnings = distributedEntityStats.getWarningRecords();
        long total = distributedEntityStats.getTotalRecords();
        // Rows the planner counted but the reader never produced (deletes between plan and
        // read, ListFilter snapshot drift) — absorb into warnings so total balances against
        // success + failed + warnings. Without this, totalRecords stays at the planner count
        // while the stage counters reflect only what the reader saw, leaving a phantom gap.
        long gap = total - (success + failed + warnings);
        if (gap > 0) {
          warnings += gap;
        }
        entityStats.setTotalRecords(saturatedToInt(total));
        entityStats.setSuccessRecords(saturatedToInt(success));
        entityStats.setFailedRecords(saturatedToInt(failed));
        entityStats.setWarningRecords(saturatedToInt(warnings));
        entityStats.setReaderTimeMs(distributedEntityStats.getReaderTimeMs());
        entityStats.setProcessTimeMs(distributedEntityStats.getProcessTimeMs());
        entityStats.setSinkTimeMs(distributedEntityStats.getSinkTimeMs());
        entityStats.setVectorTimeMs(distributedEntityStats.getVectorTimeMs());
      }
    }
  }

  private void updateColumnStats(Stats stats, StepStats columnStats) {
    if (columnStats == null || stats.getEntityStats() == null) {
      return;
    }

    StepStats existingColumnStats =
        stats.getEntityStats().getAdditionalProperties().get(Entity.TABLE_COLUMN);
    if (existingColumnStats != null) {
      existingColumnStats.setTotalRecords(columnStats.getTotalRecords());
      existingColumnStats.setSuccessRecords(columnStats.getSuccessRecords());
      existingColumnStats.setFailedRecords(columnStats.getFailedRecords());
    }
  }

  private static int saturatedToInt(long value) {
    return (int) Math.min(value, Integer.MAX_VALUE);
  }

  private record StatsSource(String name, long successRecords, long failedRecords) {}
}
