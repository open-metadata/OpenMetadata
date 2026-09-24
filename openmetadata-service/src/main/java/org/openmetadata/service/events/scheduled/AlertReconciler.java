package org.openmetadata.service.events.scheduled;

import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ThreadLocalRandom;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.entity.events.EventSubscription;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.subscription.AlertRows;
import org.openmetadata.service.events.subscription.ledger.AlertRecord;
import org.openmetadata.service.util.PerRequestContextCleaner;
import org.quartz.SchedulerException;
import org.quartz.SimpleTrigger;
import org.quartz.Trigger;

/**
 * Repairs what can go wrong between restarts: a save whose scheduler call failed, a trigger stuck
 * in ERROR or frozen in the past, a job or rows left behind by a deleted alert. It runs inside
 * each server, not as a scheduled job, so it has no job class another release could fail to load.
 * Every repair is idempotent and counted: a reconciler that repairs the same thing every round is
 * hiding a fault somewhere else.
 *
 * <p>It acts only on keys that name an alert. Any other key in the stores it reads is reported and
 * left alone, and one it cannot read never costs the rest of the round. Every round is counted by
 * outcome, so a round that fails, or stops coming, is visible.
 */
@Slf4j
final class AlertReconciler {

  static final long PERIOD_SECONDS = 600;
  // A job or a row younger than this may belong to a create another server has not finished.
  static final long ORPHAN_MIN_AGE_MS = TimeUnit.MINUTES.toMillis(5);
  private static final String HEALTHY = "healthy";
  private static final int REMEMBERED_VERDICTS = 1000;
  private static final int KEYS_SHOWN_PER_STORE = 20;

  record Verdict(long at, String found) {}

  private final Cache<UUID, Verdict> lastVerdicts =
      Caffeine.newBuilder().maximumSize(REMEMBERED_VERDICTS).build();

  private final AlertJobView jobs;
  private final long misfireThresholdMs;
  // Only touched inside a round, and rounds hold this object's lock.
  private int repairsThisRound;
  private int failuresThisRound;
  private final ScheduledExecutorService executor =
      Executors.newSingleThreadScheduledExecutor(
          runnable -> {
            Thread thread = new Thread(runnable, "alert-reconciler");
            thread.setDaemon(true);
            return thread;
          });

  AlertReconciler(AlertJobView jobs, long misfireThresholdMs) {
    this.jobs = jobs;
    this.misfireThresholdMs = misfireThresholdMs;
  }

  // Each server starts at a random offset, so a cluster does not reconcile in step.
  void start() {
    ReconcilerMetrics.started(System.currentTimeMillis());
    long firstRun = ThreadLocalRandom.current().nextLong(PERIOD_SECONDS);
    executor.scheduleWithFixedDelay(
        this::runScheduledRound, firstRun, PERIOD_SECONDS, TimeUnit.SECONDS);
  }

  void stop() {
    executor.shutdownNow();
  }

  // An executor never runs a periodic task again once it throws, so nothing may leave a round.
  void runScheduledRound() {
    try {
      reconcileOnCleanThread();
    } catch (Throwable failure) { // NOSONAR: see above
      roundFailed(failure);
    }
  }

  private void reconcileOnCleanThread() throws SchedulerException {
    PerRequestContextCleaner.clear();
    try {
      reconcile();
    } finally {
      PerRequestContextCleaner.clear();
    }
  }

  // A round cut short by stop() is not a failure of the reconciler.
  private void roundFailed(Throwable failure) {
    if (!executor.isShutdown()) {
      ReconcilerMetrics.failed();
      LOG.warn("Alert reconcile round failed", failure);
    }
  }

  synchronized ReconcileRound reconcile() throws SchedulerException {
    long now = Entity.getCollectionDAO().eventSubscriptionDAO().databaseTimeMillis();
    Inventory inventory = inventory();
    repairsThisRound = 0;
    failuresThisRound = 0;
    for (UUID id : inventory.ids) {
      reconcileQuietly(id, now);
    }
    ReconcileRound round = inventory.round(repairsThisRound, failuresThisRound);
    ReconcilerMetrics.finished(round);
    logRound(round);
    return round;
  }

  private Inventory inventory() throws SchedulerException {
    Inventory inventory = new Inventory();
    Entity.getCollectionDAO()
        .eventSubscriptionDAO()
        .listAllIds()
        .forEach(id -> inventory.add(ReconcileRound.ALERTS, id, AlertJobs.alertIdOf(id)));
    jobs.jobKeys()
        .forEach(
            key -> inventory.add(ReconcileRound.JOBS, key.getName(), AlertJobs.alertIdOf(key)));
    AlertRecord.alertIdsWithRows()
        .forEach(id -> inventory.add(ReconcileRound.LEDGER, id, AlertJobs.alertIdOf(id)));
    return inventory;
  }

  // One alert that cannot be repaired must not cost the rest of the round.
  private void reconcileQuietly(UUID id, long now) {
    try {
      reconcileOne(id, now);
    } catch (SchedulerException | RuntimeException e) {
      failuresThisRound++;
      LOG.warn("Alert {} not reconciled this round", id, e);
    }
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
      if (jobs.exists(id)) {
        AlertJobs.converge(id);
        count("job without an alert");
      }
      if (AlertRecord.hasRows(id)) {
        AlertRecord.forget(id);
        count("rows without an alert");
      }
    }
  }

  private boolean olderThanMinimumAge(UUID id, long now) throws SchedulerException {
    long jobSince = jobs.trigger(id).map(trigger -> trigger.getStartTime().getTime()).orElse(0L);
    Long rowsWrittenAt = AlertRecord.positionOrLatest(id).getTimestamp();
    long rowsSince = rowsWrittenAt == null ? 0L : rowsWrittenAt;
    return now - Math.max(jobSince, rowsSince) > ORPHAN_MIN_AGE_MS;
  }

  private void removeJobOfDisabled(UUID id) throws SchedulerException {
    if (jobs.exists(id)) {
      AlertJobs.converge(id);
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
      AlertJobs.converge(alert.getId());
      count(unhealthy.get());
    }
  }

  private Optional<String> whyUnhealthy(EventSubscription alert, long now)
      throws SchedulerException {
    Trigger trigger = jobs.trigger(alert.getId()).orElse(null);
    String reason = null;
    if (!jobs.hasCurrentJobClass(alert.getId())) {
      reason = "missing job";
    } else if (trigger == null || !repeatsEvery(trigger, alert.getPollInterval())) {
      reason = "missing trigger";
    } else if (jobs.triggerState(alert.getId()) == Trigger.TriggerState.ERROR) {
      reason = "trigger in ERROR";
    } else if (isFrozen(trigger, alert, now)) {
      reason = "frozen trigger";
    } else if (AlertRecord.open(alert).isEmpty()) {
      reason = "missing position row";
    }
    return Optional.ofNullable(reason);
  }

  private static boolean repeatsEvery(Trigger trigger, Integer pollIntervalSeconds) {
    return trigger instanceof SimpleTrigger simple
        && pollIntervalSeconds != null
        && simple.getRepeatInterval() == TimeUnit.SECONDS.toMillis(pollIntervalSeconds);
  }

  // A trigger whose own tick is running is healthy however old its fire time looks.
  private boolean isFrozen(Trigger trigger, EventSubscription alert, long now)
      throws SchedulerException {
    boolean running = jobs.triggerState(alert.getId()) == Trigger.TriggerState.BLOCKED;
    long oldestHealthyFireTime =
        now - TimeUnit.SECONDS.toMillis(alert.getPollInterval()) - misfireThresholdMs;
    boolean late =
        trigger.getNextFireTime() == null
            || trigger.getNextFireTime().getTime() < oldestHealthyFireTime;
    return !running && late;
  }

  private void count(String reason) {
    repairsThisRound++;
    LOG.info("Alert reconciler repaired: {}", reason);
    ReconcilerMetrics.repaired(reason);
  }

  private static void logRound(ReconcileRound round) {
    if (round.outcome() == ReconcileRound.Outcome.COMPLETED && round.foreignKeyCount() == 0) {
      LOG.info(
          "Alert reconcile completed: {} alerts, {} repaired", round.alerts(), round.repaired());
    } else {
      LOG.warn(
          "Alert reconcile {}: {} alerts, {} repaired, {} not reconciled; keys that name no alert,"
              + " left alone: {}",
          round.outcome().tag(),
          round.alerts(),
          round.repaired(),
          round.failed(),
          shown(round.foreignKeys()));
    }
  }

  private static String shown(Map<String, List<String>> foreignKeys) {
    return foreignKeys.entrySet().stream()
        .map(store -> store.getKey() + " " + store.getValue().size() + listed(store.getValue()))
        .collect(Collectors.joining(", "));
  }

  private static String listed(List<String> keys) {
    return keys.isEmpty()
        ? ""
        : keys.stream()
            .limit(KEYS_SHOWN_PER_STORE)
            .map(AlertJobs::printable)
            .collect(Collectors.joining(", ", " [", "]"));
  }

  /** The alert ids a round works through, and the keys it read that name no alert. */
  private static final class Inventory {
    private final Set<UUID> ids = new LinkedHashSet<>();
    private final Map<String, List<String>> foreign = new LinkedHashMap<>();

    Inventory() {
      ReconcileRound.STORES.forEach(store -> foreign.put(store, new ArrayList<>()));
    }

    void add(String store, String key, Optional<UUID> alertId) {
      alertId.ifPresentOrElse(ids::add, () -> foreign.get(store).add(key));
    }

    ReconcileRound round(int repaired, int failed) {
      ReconcileRound.Outcome outcome =
          failed == 0 ? ReconcileRound.Outcome.COMPLETED : ReconcileRound.Outcome.PARTIAL;
      return new ReconcileRound(outcome, ids.size(), repaired, failed, foreign);
    }
  }
}
