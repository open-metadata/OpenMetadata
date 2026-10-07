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
  private static volatile SettingsChangeWatcher running;

  private final SettingsFingerprintSource fingerprints;
  private final SettingsRefresher refresher;
  private final Duration interval;
  private final Map<SettingsType, SeenRow> seenRows = new EnumMap<>(SettingsType.class);
  private final Map<SettingsType, String> refreshErrors = new EnumMap<>(SettingsType.class);
  private ScheduledExecutorService scheduler;

  /**
   * @param jsonHash the hash of the stored value
   * @param appliedJsonHash the hash of the value the last reconciliation wrote
   */
  private record SeenRow(String jsonHash, String appliedJsonHash) {
    static SeenRow of(SettingsFingerprint fingerprint) {
      String appliedJsonHash =
          DeploymentSnapshot.parse(fingerprint.snapshot())
              .map(DeploymentSnapshot::meta)
              .map(DeploymentSnapshot.Meta::appliedJsonHash)
              .orElse(null);
      return new SeenRow(fingerprint.jsonHash(), appliedJsonHash);
    }
  }

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

  @Override
  public void start() {
    rememberCurrentHashes();
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
    return Optional.ofNullable(refreshErrors.get(settingsType));
  }

  private synchronized void rememberCurrentHashes() {
    for (SettingsFingerprint fingerprint : fingerprints.list()) {
      settingsTypeOf(fingerprint).ifPresent(type -> seenRows.put(type, SeenRow.of(fingerprint)));
    }
  }

  /**
   * The row is recorded before refreshing: a refresh that fails is not retried on every poll, only
   * after the next change.
   */
  private void onFingerprint(SettingsType settingsType, SettingsFingerprint fingerprint) {
    SeenRow current = SeenRow.of(fingerprint);
    SeenRow previous = seenRows.put(settingsType, current);
    boolean changed = previous != null && !previous.jsonHash().equals(current.jsonHash());
    if (changed && !isWrittenByReconciliation(previous, current)) {
      refresh(settingsType);
    }
  }

  private void refresh(SettingsType settingsType) {
    try {
      refresher.refresh(settingsType);
      refreshErrors.remove(settingsType);
      LOG.info("Applied {} changed on another server or by the CLI", settingsType.value());
    } catch (RuntimeException failure) {
      // A failed refresh keeps the last working value; the error is shown on the settings source.
      refreshErrors.put(settingsType, failure.getMessage());
      LOG.error("Could not apply the changed {}", settingsType.value(), failure);
    }
  }

  /**
   * A reconciliation marks the value it writes. The mark alone is not enough: an admin who undoes
   * a change returns the setting to a value a reconciliation once wrote, without a new mark.
   */
  private static boolean isWrittenByReconciliation(SeenRow previous, SeenRow current) {
    return current.jsonHash().equals(current.appliedJsonHash())
        && !current.appliedJsonHash().equals(previous.appliedJsonHash());
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
