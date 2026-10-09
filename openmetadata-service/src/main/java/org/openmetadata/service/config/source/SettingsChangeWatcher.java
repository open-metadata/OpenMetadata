/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.config.source;

import io.dropwizard.lifecycle.Managed;
import java.time.Duration;
import java.util.Arrays;
import java.util.EnumMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.SettingsType;

/**
 * Notices settings changed by another server, the CLI or an administration job, and refreshes
 * this server, so a change made on one server does not leave the others on the old value until
 * they restart (#30882).
 *
 * <p>The database is polled, so this works without Redis; with Redis, writers also publish a nudge
 * that triggers a poll right away. A change written by another server's start-up reconciliation is
 * not followed: every server applies its own deployment configuration when it starts, the way a
 * rolling update replaces servers one by one.
 */
@Slf4j
public final class SettingsChangeWatcher implements Managed {
  /** About five minutes between retries at the default interval. */
  private static final int MAX_POLLS_BETWEEN_RETRIES = 31;

  private static volatile SettingsChangeWatcher running;

  private final SettingsFingerprintSource fingerprints;
  private final SettingsRefresher refresher;
  private final Duration interval;
  private final Map<SettingsType, SeenRow> seenRows = new EnumMap<>(SettingsType.class);
  private final Map<SettingsType, RefreshError> refreshErrors = new EnumMap<>(SettingsType.class);
  private boolean baselineTaken;
  private ScheduledExecutorService scheduler;

  /**
   * @param jsonHash the hash of the stored value
   * @param appliedJsonHash the hash of the value the last reconciliation wrote
   */
  private record SeenRow(String jsonHash, String appliedJsonHash) {
    static SeenRow of(SettingsFingerprint fingerprint) {
      return new SeenRow(fingerprint.jsonHash(), fingerprint.appliedJsonHash());
    }
  }

  /**
   * Why the stored value with {@code jsonHash} could not be applied, and how many polls to let pass
   * before trying again.
   */
  private record RefreshError(String jsonHash, String message, int failures, int pollsToSkip) {}

  /** The stored settings' hashes, read from the database. */
  @FunctionalInterface
  public interface SettingsFingerprintSource {
    List<SettingsFingerprint> list();
  }

  public SettingsChangeWatcher(
      SettingsFingerprintSource fingerprints, SettingsRefresher refresher, Duration interval) {
    this.fingerprints = fingerprints;
    this.refresher = refresher;
    this.interval = interval;
  }

  /**
   * Takes the stored values the server is about to load as the baseline. Called right after the
   * start-up reconciliation, before the settings are read, so that a change saved elsewhere while
   * the server starts is applied at the first poll instead of being taken for the loaded value.
   */
  public synchronized void rememberCurrentHashes() {
    for (SettingsFingerprint fingerprint : fingerprints.list()) {
      settingsTypeOf(fingerprint).ifPresent(type -> seenRows.put(type, SeenRow.of(fingerprint)));
    }
    baselineTaken = true;
  }

  @Override
  public void start() {
    if (!baselineTaken) {
      rememberCurrentHashes();
    }
    scheduler =
        Executors.newSingleThreadScheduledExecutor(
            runnable -> {
              Thread thread = new Thread(runnable, "om-settings-change-watcher");
              thread.setDaemon(true);
              return thread;
            });
    long intervalMillis = interval.toMillis();
    scheduler.scheduleWithFixedDelay(
        this::pollSafely, intervalMillis, intervalMillis, TimeUnit.MILLISECONDS);
    running = this;
  }

  @Override
  public void stop() {
    running = null;
    if (scheduler != null) {
      scheduler.shutdownNow();
    }
  }

  /** Polls right away instead of at the next interval; used when another server announces one. */
  public static void requestImmediatePoll() {
    SettingsChangeWatcher watcher = running;
    if (watcher != null && watcher.scheduler != null) {
      watcher.scheduler.execute(watcher::pollSafely);
    }
  }

  /** Why this server could not apply the latest stored value of a setting, if it could not. */
  public static Optional<String> refreshError(SettingsType settingsType) {
    SettingsChangeWatcher watcher = running;
    return watcher == null ? Optional.empty() : watcher.errorOf(settingsType);
  }

  public synchronized void pollNow() {
    for (SettingsFingerprint fingerprint : fingerprints.list()) {
      settingsTypeOf(fingerprint).ifPresent(type -> onFingerprint(type, fingerprint));
    }
  }

  private synchronized Optional<String> errorOf(SettingsType settingsType) {
    return Optional.ofNullable(refreshErrors.get(settingsType)).map(RefreshError::message);
  }

  /**
   * A row counts as seen only once it is applied, so a refresh that fails, for example a security
   * reload that cannot build the new authenticator, is retried at every poll instead of leaving
   * this server on the old value until the next change.
   */
  private void onFingerprint(SettingsType settingsType, SettingsFingerprint fingerprint) {
    SeenRow current = SeenRow.of(fingerprint);
    SeenRow previous = seenRows.get(settingsType);
    if (!needsRefresh(previous, current)
        || (isRetryDue(settingsType, current) && refresh(settingsType, current))) {
      seenRows.put(settingsType, current);
    }
  }

  /**
   * Retries back off: a value that keeps failing, such as a security configuration this server
   * cannot build, must not rebuild authentication at every poll.
   */
  private boolean isRetryDue(SettingsType settingsType, SeenRow row) {
    RefreshError error = refreshErrors.get(settingsType);
    boolean waiting =
        error != null && error.jsonHash().equals(row.jsonHash()) && error.pollsToSkip() > 0;
    if (waiting) {
      refreshErrors.put(
          settingsType,
          new RefreshError(
              error.jsonHash(), error.message(), error.failures(), error.pollsToSkip() - 1));
    }
    return !waiting;
  }

  /** A row created since the last poll, such as SCIM enabled for the first time, is a change. */
  private static boolean needsRefresh(SeenRow previous, SeenRow current) {
    boolean changed = previous == null || !previous.jsonHash().equals(current.jsonHash());
    return changed && !isWrittenByReconciliation(previous, current);
  }

  private boolean refresh(SettingsType settingsType, SeenRow row) {
    boolean applied = false;
    try {
      refresher.refresh(settingsType);
      refreshErrors.remove(settingsType);
      LOG.info("Applied {} after it changed in the database", settingsType.value());
      applied = true;
    } catch (RuntimeException failure) {
      recordFailure(settingsType, row, failure);
    }
    return applied;
  }

  /** A failed refresh keeps the last working value; the error is shown on the settings source. */
  private void recordFailure(SettingsType settingsType, SeenRow row, RuntimeException failure) {
    RefreshError previous = refreshErrors.get(settingsType);
    boolean sameValue = previous != null && previous.jsonHash().equals(row.jsonHash());
    int failures = sameValue ? previous.failures() + 1 : 1;
    int pollsToSkip = Math.min((1 << Math.min(failures - 1, 5)) - 1, MAX_POLLS_BETWEEN_RETRIES);
    refreshErrors.put(
        settingsType,
        new RefreshError(row.jsonHash(), failure.getMessage(), failures, pollsToSkip));
    if (!sameValue) {
      LOG.error("Could not apply the changed {}; retrying", settingsType.value(), failure);
    } else {
      LOG.debug("Still cannot apply the changed {}", settingsType.value(), failure);
    }
  }

  /**
   * A reconciliation marks the value it writes. The mark alone is not enough: an admin who undoes
   * a change returns the setting to a value a reconciliation once wrote, without a new mark.
   */
  private static boolean isWrittenByReconciliation(SeenRow previous, SeenRow current) {
    return current.jsonHash().equals(current.appliedJsonHash())
        && (previous == null || !current.appliedJsonHash().equals(previous.appliedJsonHash()));
  }

  private static Optional<SettingsType> settingsTypeOf(SettingsFingerprint fingerprint) {
    return Arrays.stream(SettingsType.values())
        .filter(type -> type.value().equals(fingerprint.configType()))
        .findFirst();
  }

  private void pollSafely() {
    try {
      pollNow();
    } catch (RuntimeException failure) {
      // An exception escaping a scheduled task cancels every later run; the next tick retries.
      LOG.warn("Could not check the settings for changes", failure);
    }
  }
}
