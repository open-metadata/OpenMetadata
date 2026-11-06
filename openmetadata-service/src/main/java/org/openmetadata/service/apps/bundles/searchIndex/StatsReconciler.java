package org.openmetadata.service.apps.bundles.searchIndex;

import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;
import org.openmetadata.service.Entity;

@Slf4j
public class StatsReconciler {

  private StatsReconciler() {}

  public static Stats reconcile(Stats stats) {
    if (stats == null) {
      return null;
    }

    StepStats readerStats = stats.getReaderStats();
    StepStats processStats = stats.getProcessStats();
    StepStats sinkStats = stats.getSinkStats();
    StepStats jobStats = stats.getJobStats();

    if (readerStats == null || sinkStats == null || jobStats == null) {
      LOG.warn("Cannot reconcile stats - missing readerStats, sinkStats, or jobStats");
      return stats;
    }

    int readerTotal = safeGet(readerStats.getTotalRecords());
    int readerFailed = safeGet(readerStats.getFailedRecords());
    int readerWarnings = safeGet(readerStats.getWarningRecords());
    int processFailed = processStats != null ? safeGet(processStats.getFailedRecords()) : 0;
    int processWarnings = processStats != null ? safeGet(processStats.getWarningRecords()) : 0;
    int sinkSuccess = safeGet(sinkStats.getSuccessRecords());
    int sinkFailed = safeGet(sinkStats.getFailedRecords());
    int sinkWarnings = safeGet(sinkStats.getWarningRecords());
    int jobWarnings = Math.max(readerWarnings, Math.max(processWarnings, sinkWarnings));

    // Reconcile entity-level totals (exclude TABLE_COLUMN — columns are indexed as a
    // side effect of table processing and should not inflate the job-level totals)
    if (stats.getEntityStats() != null
        && stats.getEntityStats().getAdditionalProperties() != null) {
      int reconciledTotal = 0;
      for (Map.Entry<String, StepStats> entry :
          stats.getEntityStats().getAdditionalProperties().entrySet()) {
        StepStats es = entry.getValue();
        int actual =
            safeGet(es.getSuccessRecords())
                + safeGet(es.getFailedRecords())
                + safeGet(es.getWarningRecords());
        if (actual > safeGet(es.getTotalRecords())) {
          es.setTotalRecords(actual);
        }
        if (!Entity.TABLE_COLUMN.equals(entry.getKey())) {
          reconciledTotal += safeGet(es.getTotalRecords());
        }
      }
      if (reconciledTotal > readerTotal) {
        readerStats.setTotalRecords(reconciledTotal);
        readerTotal = reconciledTotal;
      }
    }

    int jobFailed = readerFailed + processFailed + sinkFailed;
    int jobTotal = readerTotal;

    jobStats.setTotalRecords(jobTotal);
    jobStats.setSuccessRecords(sinkSuccess);
    jobStats.setFailedRecords(jobFailed);
    jobStats.setWarningRecords(jobWarnings);

    int computedTotal = sinkSuccess + jobFailed + jobWarnings;
    if (computedTotal != jobTotal && jobTotal > 0) {
      LOG.warn(
          "Stats discrepancy detected: total={}, success+failed+warnings={}. "
              + "Reader: total={}, failed={}, warnings={}. Process: failed={}. Sink: success={}, failed={}, warnings={}",
          jobTotal,
          computedTotal,
          readerTotal,
          readerFailed,
          readerWarnings,
          processFailed,
          sinkSuccess,
          sinkFailed,
          sinkWarnings);
    }

    return stats;
  }

  public static StepStats reconcileToJobStats(
      StepStats readerStats, StepStats processStats, StepStats sinkStats) {
    if (readerStats == null && sinkStats == null) {
      return new StepStats()
          .withTotalRecords(0)
          .withSuccessRecords(0)
          .withFailedRecords(0)
          .withWarningRecords(0);
    }

    int readerTotal = readerStats != null ? safeGet(readerStats.getTotalRecords()) : 0;
    int readerFailed = readerStats != null ? safeGet(readerStats.getFailedRecords()) : 0;
    int readerWarnings = readerStats != null ? safeGet(readerStats.getWarningRecords()) : 0;
    int processFailed = processStats != null ? safeGet(processStats.getFailedRecords()) : 0;
    int processWarnings = processStats != null ? safeGet(processStats.getWarningRecords()) : 0;
    int sinkSuccess = sinkStats != null ? safeGet(sinkStats.getSuccessRecords()) : 0;
    int sinkFailed = sinkStats != null ? safeGet(sinkStats.getFailedRecords()) : 0;
    int sinkWarnings = sinkStats != null ? safeGet(sinkStats.getWarningRecords()) : 0;
    int jobWarnings = Math.max(readerWarnings, Math.max(processWarnings, sinkWarnings));

    return new StepStats()
        .withTotalRecords(readerTotal)
        .withSuccessRecords(sinkSuccess)
        .withFailedRecords(readerFailed + processFailed + sinkFailed)
        .withWarningRecords(jobWarnings);
  }

  public static boolean validateInvariants(Stats stats) {
    if (stats == null) {
      return true;
    }

    StepStats jobStats = stats.getJobStats();
    if (jobStats == null) {
      return true;
    }

    int total = safeGet(jobStats.getTotalRecords());
    int success = safeGet(jobStats.getSuccessRecords());
    int failed = safeGet(jobStats.getFailedRecords());
    int warnings = safeGet(jobStats.getWarningRecords());

    boolean balanced = (total == success + failed + warnings);
    boolean successValid = success <= total;
    boolean failedValid = failed <= total;
    boolean warningsValid = warnings <= total;

    if (!balanced || !successValid || !failedValid || !warningsValid) {
      LOG.warn(
          "Stats invariant violation: total={}, success={}, failed={}, warnings={}, "
              + "balanced={}, successValid={}, failedValid={}, warningsValid={}",
          total,
          success,
          failed,
          warnings,
          balanced,
          successValid,
          failedValid,
          warningsValid);
    }

    return balanced && successValid && failedValid && warningsValid;
  }

  public static Stats fixInvariants(Stats stats) {
    if (stats == null || stats.getJobStats() == null) {
      return stats;
    }

    StepStats jobStats = stats.getJobStats();
    int success = safeGet(jobStats.getSuccessRecords());
    int failed = safeGet(jobStats.getFailedRecords());
    int warnings = safeGet(jobStats.getWarningRecords());

    int computedTotal = success + failed + warnings;
    if (safeGet(jobStats.getTotalRecords()) != computedTotal) {
      LOG.info(
          "Fixing stats total: was {}, setting to {} (success={}, failed={}, warnings={})",
          jobStats.getTotalRecords(),
          computedTotal,
          success,
          failed,
          warnings);
      jobStats.setTotalRecords(computedTotal);
    }

    return stats;
  }

  private static int safeGet(Integer value) {
    return value != null ? value : 0;
  }
}
