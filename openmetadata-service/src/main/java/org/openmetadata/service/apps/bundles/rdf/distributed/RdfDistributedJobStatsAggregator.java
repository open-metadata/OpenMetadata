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

package org.openmetadata.service.apps.bundles.rdf.distributed;

import java.util.Map;
import org.openmetadata.schema.system.EntityStats;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

public class RdfDistributedJobStatsAggregator {
  public Stats toStats(RdfIndexJob job) {
    Stats stats = new Stats();
    stats.setEntityStats(new EntityStats());

    // Timing semantics: readerTimeMs is the keyset read; sinkTimeMs is the FULL
    // RDF write path (translation + storage round trips) — the un-instrumented
    // stage where a 164-hour production run hid at "<1 ms"; processTimeMs is
    // reserved for a future translate/write split. totalTimeMs powers the UI's
    // average-latency computation (totalTimeMs / successRecords).
    long jobReaderTimeMs = 0;
    long jobProcessTimeMs = 0;
    long jobSinkTimeMs = 0;
    if (job.getEntityStats() != null) {
      for (Map.Entry<String, RdfIndexJob.EntityTypeStats> entry : job.getEntityStats().entrySet()) {
        RdfIndexJob.EntityTypeStats entityStats = entry.getValue();
        jobReaderTimeMs += entityStats.getReaderTimeMs();
        jobProcessTimeMs += entityStats.getProcessTimeMs();
        jobSinkTimeMs += entityStats.getSinkTimeMs();
        stats
            .getEntityStats()
            .setAdditionalProperty(
                entry.getKey(),
                new StepStats()
                    .withTotalRecords(safeToInt(entityStats.getTotalRecords()))
                    .withSuccessRecords(safeToInt(entityStats.getSuccessRecords()))
                    .withFailedRecords(safeToInt(entityStats.getFailedRecords()))
                    .withReaderTimeMs(entityStats.getReaderTimeMs())
                    .withProcessTimeMs(entityStats.getProcessTimeMs())
                    .withSinkTimeMs(entityStats.getSinkTimeMs())
                    .withTotalTimeMs(
                        entityStats.getReaderTimeMs()
                            + entityStats.getProcessTimeMs()
                            + entityStats.getSinkTimeMs()));
      }
    }

    StepStats jobStats =
        new StepStats()
            .withTotalRecords(safeToInt(job.getTotalRecords()))
            .withSuccessRecords(safeToInt(job.getSuccessRecords()))
            .withFailedRecords(safeToInt(job.getFailedRecords()))
            .withReaderTimeMs(jobReaderTimeMs)
            .withProcessTimeMs(jobProcessTimeMs)
            .withSinkTimeMs(jobSinkTimeMs)
            .withTotalTimeMs(jobReaderTimeMs + jobProcessTimeMs + jobSinkTimeMs);
    stats.setJobStats(jobStats);

    return stats;
  }

  private int safeToInt(long value) {
    if (value > Integer.MAX_VALUE) {
      return Integer.MAX_VALUE;
    }
    if (value < Integer.MIN_VALUE) {
      return Integer.MIN_VALUE;
    }
    return (int) value;
  }
}
