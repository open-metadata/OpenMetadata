package org.openmetadata.service.apps.bundles.changeEvent;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.DestinationHealth;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.entity.events.SubscriptionStatus;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.events.scheduled.EventSubscriptionScheduler;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.AlertTelemetry;
import org.quartz.JobBuilder;
import org.quartz.JobDataMap;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;

/**
 * The one value this release keeps in a job's data. No server of this release reads it. A server
 * of the previous release does: it refuses to run a job without the alert in its data, and it
 * trusts an offset key there before the position row. So the data holds exactly the alert, and
 * any offset or gap key an older server left behind is dropped before anything is sent.
 */
@Slf4j
public final class CopyForOlderServers {

  private CopyForOlderServers() {}

  public static JobDataMap dataFor(EventSubscription alert, Map<String, DestinationHealth> health) {
    EventSubscription copy = JsonUtils.deepCopy(alert, EventSubscription.class);
    for (SubscriptionDestination destination : listOrEmpty(copy.getDestinations())) {
      DestinationHealth known = health.get(destination.getId().toString());
      destination.setStatusDetails(known == null ? null : withoutTimes(known.getStatus()));
    }
    JobDataMap data = new JobDataMap();
    data.put(AbstractEventConsumer.ALERT_INFO_KEY, JsonUtils.pojoToJson(copy));
    return data;
  }

  /**
   * False only when sending would be unsafe: the stored data holds a key an older server would
   * trust over the position row, and it could not be dropped.
   */
  public static boolean ensure(
      Scheduler scheduler, EventSubscription alert, Map<String, DestinationHealth> health) {
    JobKey jobKey =
        new JobKey(alert.getId().toString(), EventSubscriptionScheduler.ALERT_JOB_GROUP);
    boolean safe = true;
    try {
      // Read now, not from the snapshot Quartz took when the trigger fired: an older server may
      // have replaced the job since, with an offset it read before this tick commits.
      JobDetail stored = scheduler.getJobDetail(jobKey);
      if (stored != null) {
        safe = rewriteIfDifferent(scheduler, stored, dataFor(alert, health));
      }
    } catch (SchedulerException e) {
      LOG.warn("Could not read the job data of alert {}", alert.getId(), e);
      safe = false;
    }
    return safe;
  }

  /** True when the stored job data was not the copy and has been rewritten. */
  public static boolean rewriteIfStale(
      Scheduler scheduler, EventSubscription alert, Map<String, DestinationHealth> health)
      throws SchedulerException {
    JobKey jobKey =
        new JobKey(alert.getId().toString(), EventSubscriptionScheduler.ALERT_JOB_GROUP);
    JobDetail stored = scheduler.getJobDetail(jobKey);
    JobDataMap wanted = dataFor(alert, health);
    boolean stale =
        stored != null && !wanted.getWrappedMap().equals(stored.getJobDataMap().getWrappedMap());
    if (stale) {
      scheduler.addJob(sameJobWith(stored, wanted), true, true);
      removeIfTheAlertWentAway(scheduler, jobKey);
    }
    return stale;
  }

  private static boolean rewriteIfDifferent(
      Scheduler scheduler, JobDetail stored, JobDataMap wanted) {
    boolean safe = true;
    if (!wanted.getWrappedMap().equals(stored.getJobDataMap().getWrappedMap())) {
      try {
        scheduler.addJob(sameJobWith(stored, wanted), true, true);
        removeIfTheAlertWentAway(scheduler, stored.getKey());
      } catch (SchedulerException e) {
        LOG.warn("Could not rewrite the job data of {}", stored.getKey(), e);
        AlertTelemetry.absorbed(AlertTelemetry.JOB_DATA_REWRITE_FAILED);
        safe = !holdsStaleKeys(stored.getJobDataMap());
      }
    }
    return safe;
  }

  // Quartz can only replace a job, not update one that still exists. A delete or a disable that
  // lands between the read and the write would therefore bring the job back, so the row is asked
  // once more and the job removed again.
  private static void removeIfTheAlertWentAway(Scheduler scheduler, JobKey jobKey)
      throws SchedulerException {
    EventSubscription current = AlertRows.readOrNull(UUID.fromString(jobKey.getName()));
    if (current == null || Boolean.FALSE.equals(current.getEnabled())) {
      scheduler.deleteJob(jobKey);
    }
  }

  private static JobDetail sameJobWith(JobDetail stored, JobDataMap data) {
    return JobBuilder.newJob(stored.getJobClass())
        .withIdentity(stored.getKey())
        .usingJobData(data)
        .build();
  }

  private static boolean holdsStaleKeys(JobDataMap data) {
    return data.containsKey(AbstractEventConsumer.ALERT_OFFSET_KEY)
        || data.containsKey(AbstractEventConsumer.ALERT_PENDING_GAP_SINCE_KEY);
  }

  // The copy changes only when a status changes, so a tick that merely moved "last successful at"
  // rewrites nothing and stays off the job store's lock.
  private static SubscriptionStatus withoutTimes(SubscriptionStatus status) {
    return new SubscriptionStatus()
        .withStatus(status.getStatus())
        .withLastFailedStatusCode(status.getLastFailedStatusCode())
        .withLastFailedReason(status.getLastFailedReason());
  }
}
