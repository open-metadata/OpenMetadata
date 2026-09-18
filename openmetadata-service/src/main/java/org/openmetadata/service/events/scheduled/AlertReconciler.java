package org.openmetadata.service.events.scheduled;

import static org.openmetadata.service.events.scheduled.EventSubscriptionScheduler.ALERT_JOB_GROUP;
import static org.openmetadata.service.events.scheduled.EventSubscriptionScheduler.ALERT_TRIGGER_GROUP;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import io.micrometer.core.instrument.Metrics;
import java.util.LinkedHashSet;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.changeEvent.AlertPublisher;
import org.openmetadata.service.apps.bundles.changeEvent.CopyForOlderServers;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.AlertLedger;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.JobDetail;
import org.quartz.JobKey;
import org.quartz.Scheduler;
import org.quartz.SchedulerException;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;
import org.quartz.TriggerKey;
import org.quartz.impl.matchers.GroupMatcher;

/**
 * Repairs what can go wrong between restarts: a save whose scheduler call failed, a trigger stuck
 * in ERROR or frozen in the past, a job or rows left behind by a deleted alert, job data that is
 * no longer the copy for older servers. It runs inside each server, not as a scheduled job, so it
 * has no job class another release could fail to load. Every repair is idempotent and counted: a
 * reconciler that repairs the same thing every round is hiding a fault somewhere else.
 */
@Slf4j
final class AlertReconciler {

  static final long PERIOD_SECONDS = 600;
  // A job or a row younger than this may belong to a create another server has not finished.
  static final long ORPHAN_MIN_AGE_MS = TimeUnit.MINUTES.toMillis(5);
  private static final String REPAIRS_METRIC = "alert_reconciler_repairs";
  private static final String HEALTHY = "healthy";
  private static final int REMEMBERED_VERDICTS = 1000;

  record Verdict(long at, String found) {}

  private final Cache<UUID, Verdict> lastVerdicts =
      Caffeine.newBuilder().maximumSize(REMEMBERED_VERDICTS).build();

  private final Scheduler scheduler;
  private int repairsThisRound;
  private final long misfireThresholdMs;
  private final ScheduledExecutorService executor =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "alert-reconciler");
            thread.setDaemon(true);
            return thread;
          });

  AlertReconciler(Scheduler scheduler, long misfireThresholdMs) {
    this.scheduler = scheduler;
    this.misfireThresholdMs = misfireThresholdMs;
  }

  // Each server starts at a random offset, so a cluster does not reconcile in step.
  void start() {
    long firstRun = ThreadLocalRandom.current().nextLong(PERIOD_SECONDS);
    executor.scheduleWithFixedDelay(
        this::reconcileQuietly, firstRun, PERIOD_SECONDS, TimeUnit.SECONDS);
  }

  void stop() {
    executor.shutdownNow();
  }

  private void reconcileQuietly() {
    PerRequestContextCleaner.clear();
    try {
      reconcile();
    } catch (RuntimeException | SchedulerException e) {
      LOG.warn("Alert reconcile skipped this round", e);
    } finally {
      PerRequestContextCleaner.clear();
    }
  }

  void reconcile() throws SchedulerException {
    if (scheduler.isStarted() && !scheduler.isInStandbyMode()) {
      long now = Entity.getCollectionDAO().eventSubscriptionDAO().databaseTimeMillis();
      repairsThisRound = 0;
      for (String id : everyKnownId()) {
        reconcileOne(UUID.fromString(id), now);
      }
      LOG.info("Alert reconcile finished with {} repairs", repairsThisRound);
    }
  }

  private Set<String> everyKnownId() throws SchedulerException {
    Set<String> ids = new LinkedHashSet<>();
    Entity.getCollectionDAO().eventSubscriptionDAO().listAllEventsSubscriptions().stream()
        .map(json -> JsonUtils.readTree(json).get("id").asText())
        .forEach(ids::add);
    scheduler.getJobKeys(GroupMatcher.jobGroupEquals(ALERT_JOB_GROUP)).stream()
        .map(JobKey::getName)
        .forEach(ids::add);
    ids.addAll(AlertRecord.alertIdsWithRows());
    return ids;
  }

  private void reconcileOne(UUID id, long now) throws SchedulerException {
    // Read right before acting: a race with an edit is then harmless.
    EventSubscription alert = AlertRows.readOrNull(id);
    if (alert == null) {
      removeLeftovers(id, now);
    } else if (Boolean.FALSE.equals(alert.getEnabled())) {
      removeJobOfDisabled(id);
    } else {
      repairEnabled(alert, now);
    }
  }

  private void removeLeftovers(UUID id, long now) throws SchedulerException {
    if (olderThanMinimumAge(id, now)) {
      JobKey jobKey = jobKey(id);
      if (scheduler.checkExists(jobKey)) {
        scheduler.deleteJob(jobKey);
        count("job without an alert");
      }
      if (AlertRecord.alertIdsWithRows().contains(id.toString())) {
        AlertRecord.forget(id);
        count("rows without an alert");
      }
    }
  }

  private boolean olderThanMinimumAge(UUID id, long now) throws SchedulerException {
    Trigger trigger = scheduler.getTrigger(triggerKey(id));
    long jobSince = trigger == null ? 0L : trigger.getStartTime().getTime();
    Long rowsWrittenAt = AlertRecord.positionOrLatest(id).getTimestamp();
    long rowsSince = rowsWrittenAt == null ? 0L : rowsWrittenAt;
    return now - Math.max(jobSince, rowsSince) > ORPHAN_MIN_AGE_MS;
  }

  private void removeJobOfDisabled(UUID id) throws SchedulerException {
    if (scheduler.checkExists(jobKey(id))) {
      scheduler.deleteJob(jobKey(id));
      count("job of a disabled alert");
    }
  }

  Verdict lastVerdict(UUID alertId) {
    return lastVerdicts.getIfPresent(alertId);
  }

  private void repairEnabled(EventSubscription alert, long now) throws SchedulerException {
    Optional<String> unhealthy = whyUnhealthy(alert, now);
    lastVerdicts.put(alert.getId(), new Verdict(now, unhealthy.orElse(HEALTHY)));
    if (unhealthy.isPresent()) {
      EventSubscriptionScheduler.ensureScheduled(alert);
      count(unhealthy.get());
    } else {
      Optional<AlertLedger> ledger = AlertRecord.open(alert);
      boolean rewritten =
          ledger.isPresent()
              && CopyForOlderServers.rewriteIfStale(scheduler, alert, ledger.get().health());
      if (rewritten) {
        count("stale job data");
      }
    }
  }

  private Optional<String> whyUnhealthy(EventSubscription alert, long now)
      throws SchedulerException {
    JobDetail job = scheduler.getJobDetail(jobKey(alert.getId()));
    Trigger trigger = scheduler.getTrigger(triggerKey(alert.getId()));
    String reason = null;
    if (job == null || !hasAcceptedClass(job, alert)) {
      reason = "missing job";
    } else if (trigger == null || !repeatsEvery(trigger, alert.getPollInterval())) {
      reason = "missing trigger";
    } else if (scheduler.getTriggerState(trigger.getKey()) == Trigger.TriggerState.ERROR) {
      reason = "trigger in ERROR";
    } else if (isFrozen(trigger, alert, now)) {
      reason = "frozen trigger";
    } else if (AlertRecord.open(alert).isEmpty()) {
      reason = "missing position row";
    }
    return Optional.ofNullable(reason);
  }

  // The class the alert names, or AlertPublisher, which every release has and which runs the
  // consumer the row names whatever class the job was stored with.
  private static boolean hasAcceptedClass(JobDetail job, EventSubscription alert) {
    String stored = job.getJobClass().getCanonicalName();
    String named =
        Optional.ofNullable(alert.getClassName()).orElse(AlertPublisher.class.getCanonicalName());
    return stored.equals(named) || stored.equals(AlertPublisher.class.getCanonicalName());
  }

  private static boolean repeatsEvery(Trigger trigger, Integer pollIntervalSeconds) {
    return trigger instanceof SimpleTrigger simple
        && pollIntervalSeconds != null
        && simple.getRepeatInterval() == TimeUnit.SECONDS.toMillis(pollIntervalSeconds);
  }

  // A trigger whose own tick is running is healthy however old its fire time looks.
  private boolean isFrozen(Trigger trigger, EventSubscription alert, long now)
      throws SchedulerException {
    boolean running = scheduler.getTriggerState(trigger.getKey()) == Trigger.TriggerState.BLOCKED;
    long oldestHealthyFireTime =
        now - TimeUnit.SECONDS.toMillis(alert.getPollInterval()) - misfireThresholdMs;
    boolean late =
        trigger.getNextFireTime() == null
            || trigger.getNextFireTime().getTime() < oldestHealthyFireTime;
    return !running && late;
  }

  private static JobKey jobKey(UUID id) {
    return new JobKey(id.toString(), ALERT_JOB_GROUP);
  }

  private static TriggerKey triggerKey(UUID id) {
    return new TriggerKey(id.toString(), ALERT_TRIGGER_GROUP);
  }

  private void count(String reason) {
    repairsThisRound++;
    LOG.info("Alert reconciler repaired: {}", reason);
    Metrics.counter(REPAIRS_METRIC, "reason", reason).increment();
  }
}
