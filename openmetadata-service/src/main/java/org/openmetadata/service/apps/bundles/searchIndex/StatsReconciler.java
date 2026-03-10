package org.openmetadata.service.apps.bundles.searchIndex;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.system.Stats;
import org.openmetadata.schema.system.StepStats;

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
    int sinkSuccess = safeGet(sinkStats.getSuccessRecords());
    int sinkFailed = safeGet(sinkStats.getFailedRecords());
    int sinkWarnings = safeGet(sinkStats.getWarningRecords());

    // Reconcile entity-level totals
    if (stats.getEntityStats() != null
        && stats.getEntityStats().getAdditionalProperties() != null) {
      int reconciledTotal = 0;
      for (StepStats es : stats.getEntityStats().getAdditionalProperties().values()) {
        int actual = safeGet(es.getSuccessRecords()) + safeGet(es.getFailedRecords());
        if (actual > safeGet(es.getTotalRecords())) {
          es.setTotalRecords(actual);
        }
        reconciledTotal += safeGet(es.getTotalRecords());
      }
      if (reconciledTotal > readerTotal) {
        readerStats.setTotalRecords(reconciledTotal);
        readerTotal = reconciledTotal;
      }
    }

    int jobSuccess = sinkSuccess;
    int jobFailed = readerFailed + processFailed + sinkFailed;
    int jobTotal = readerTotal;
    int jobWarnings = readerWarnings;

    jobStats.setTotalRecords(jobTotal);
    jobStats.setSuccessRecords(jobSuccess);
    jobStats.setFailedRecords(jobFailed);
    jobStats.setWarningRecords(jobWarnings);

    int computedTotal = jobSuccess + jobFailed;
    if (computedTotal != jobTotal && jobTotal > 0) {
      LOG.warn(
          "Stats discrepancy detected: total={}, success+failed={}. "
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
    int sinkSuccess = sinkStats != null ? safeGet(sinkStats.getSuccessRecords()) : 0;
    int sinkFailed = sinkStats != null ? safeGet(sinkStats.getFailedRecords()) : 0;

    return new StepStats()
        .withTotalRecords(readerTotal)
        .withSuccessRecords(sinkSuccess)
        .withFailedRecords(readerFailed + processFailed + sinkFailed)
        .withWarningRecords(readerWarnings);
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

    boolean balanced = (total == success + failed);
    boolean successValid = success <= total;
    boolean failedValid = failed <= total;

    if (!balanced || !successValid || !failedValid) {
      LOG.warn(
          "Stats invariant violation: total={}, success={}, failed={}, "
              + "balanced={}, successValid={}, failedValid={}",
          total,
          success,
          failed,
          balanced,
          successValid,
          failedValid);
    }

    return balanced && successValid && failedValid;
  }

  public static Stats fixInvariants(Stats stats) {
    if (stats == null || stats.getJobStats() == null) {
      return stats;
    }

    StepStats jobStats = stats.getJobStats();
    int success = safeGet(jobStats.getSuccessRecords());
    int failed = safeGet(jobStats.getFailedRecords());

    int computedTotal = success + failed;
    if (safeGet(jobStats.getTotalRecords()) != computedTotal) {
      LOG.info(
          "Fixing stats total: was {}, setting to {} (success={}, failed={})",
          jobStats.getTotalRecords(),
          computedTotal,
          success,
          failed);
      jobStats.setTotalRecords(computedTotal);
    }

    return stats;
  }

  private static int safeGet(Integer value) {
    return value != null ? value : 0;
  }
}
