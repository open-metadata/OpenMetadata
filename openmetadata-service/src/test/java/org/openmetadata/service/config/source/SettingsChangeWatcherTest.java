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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.schema.settings.SettingsType.AUTHENTICATION_CONFIGURATION;
import static org.openmetadata.schema.settings.SettingsType.LOGIN_CONFIGURATION;

import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.settings.SettingsType;

class SettingsChangeWatcherTest {
  private final Map<String, SettingsFingerprint> rows = new ConcurrentHashMap<>();
  private final List<SettingsType> refreshed = new ArrayList<>();
  private SettingsType failingSetting;
  private SettingsChangeWatcher watcher;

  @BeforeEach
  void setUp() {
    put(AUTHENTICATION_CONFIGURATION, "hash-1", null);
    put(LOGIN_CONFIGURATION, "hash-a", null);
    watcher =
        new SettingsChangeWatcher(
            () -> List.copyOf(rows.values()), this::refresh, Duration.ofHours(1));
    watcher.start();
  }

  @AfterEach
  void tearDown() {
    watcher.stop();
  }

  @Test
  void leavesAloneWhatWasStoredWhenTheServerStarted() {
    watcher.pollNow();

    assertTrue(refreshed.isEmpty());
  }

  @Test
  void refreshesASettingChangedOnAnotherServer() {
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);

    watcher.pollNow();

    assertEquals(List.of(AUTHENTICATION_CONFIGURATION), refreshed);
  }

  @Test
  void doesNotFollowAWriteMadeByAnotherServersStartup() {
    put(AUTHENTICATION_CONFIGURATION, "hash-2", snapshotApplying("hash-2"));

    watcher.pollNow();

    assertTrue(refreshed.isEmpty());
  }

  @Test
  void followsAnAdminUndoingAChangeBackToWhatAStartupWrote() {
    put(AUTHENTICATION_CONFIGURATION, "hash-2", snapshotApplying("hash-2"));
    watcher.pollNow();
    put(AUTHENTICATION_CONFIGURATION, "hash-3", snapshotApplying("hash-2"));
    watcher.pollNow();
    put(AUTHENTICATION_CONFIGURATION, "hash-2", snapshotApplying("hash-2"));
    watcher.pollNow();

    assertEquals(List.of(AUTHENTICATION_CONFIGURATION, AUTHENTICATION_CONFIGURATION), refreshed);
  }

  @Test
  void backsOffBetweenRetriesOfAValueThatKeepsFailing() {
    failingSetting = AUTHENTICATION_CONFIGURATION;
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);

    for (int poll = 0; poll < 10; poll++) {
      watcher.pollNow();
    }

    assertEquals(4, refreshed.size());
  }

  @Test
  void retriesAFailedRefreshUntilItApplies() {
    failingSetting = AUTHENTICATION_CONFIGURATION;
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);

    watcher.pollNow();
    watcher.pollNow();

    assertEquals(2, refreshed.size());
    assertEquals(
        "IdP unreachable",
        SettingsChangeWatcher.refreshError(AUTHENTICATION_CONFIGURATION).orElse(""));

    failingSetting = null;
    watcher.pollNow();
    watcher.pollNow();

    assertEquals(3, refreshed.size());
    assertTrue(SettingsChangeWatcher.refreshError(AUTHENTICATION_CONFIGURATION).isEmpty());
  }

  @Test
  void forgetsTheErrorOfAValueRevertedToTheOneRunning() {
    failingSetting = AUTHENTICATION_CONFIGURATION;
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);
    watcher.pollNow();

    put(AUTHENTICATION_CONFIGURATION, "hash-1", null);
    watcher.pollNow();

    assertEquals(1, refreshed.size());
    assertTrue(SettingsChangeWatcher.refreshError(AUTHENTICATION_CONFIGURATION).isEmpty());
  }

  @Test
  void doesNotApplyAgainWhatThisServerWroteAndApplied() {
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);
    SettingsChangeWatcher.acknowledgeLocalWrite(AUTHENTICATION_CONFIGURATION);

    watcher.pollNow();

    assertTrue(refreshed.isEmpty());
  }

  @Test
  void followsAChangeSavedElsewhereAfterThisServersWrite() {
    put(AUTHENTICATION_CONFIGURATION, "hash-2", null);
    SettingsChangeWatcher.acknowledgeLocalWrite(AUTHENTICATION_CONFIGURATION);
    put(AUTHENTICATION_CONFIGURATION, "hash-3", null);

    watcher.pollNow();

    assertEquals(List.of(AUTHENTICATION_CONFIGURATION), refreshed);
  }

  @Test
  void appliesARowCreatedAfterTheStart() {
    put(SettingsType.SCIM_CONFIGURATION, "hash-scim", null);

    watcher.pollNow();

    assertEquals(List.of(SettingsType.SCIM_CONFIGURATION), refreshed);
  }

  @Test
  void aChangeSavedBeforeTheStartIsAppliedAtTheFirstPoll() {
    SettingsChangeWatcher early =
        new SettingsChangeWatcher(
            () -> List.copyOf(rows.values()), this::refresh, Duration.ofHours(1));
    early.rememberCurrentHashes();
    put(LOGIN_CONFIGURATION, "hash-b", null);

    early.start();
    early.pollNow();
    early.stop();

    assertEquals(List.of(LOGIN_CONFIGURATION), refreshed);
  }

  @Test
  void keepsTheLastValueWhenASettingIsDeleted() {
    rows.remove(AUTHENTICATION_CONFIGURATION.value());

    watcher.pollNow();

    assertTrue(refreshed.isEmpty());
  }

  private void refresh(SettingsType settingsType) {
    refreshed.add(settingsType);
    if (settingsType == failingSetting) {
      throw new IllegalStateException("IdP unreachable");
    }
  }

  private void put(SettingsType settingsType, String hash, String appliedJsonHash) {
    rows.put(
        settingsType.value(), new SettingsFingerprint(settingsType.value(), hash, appliedJsonHash));
  }

  /** The mark a start-up reconciliation leaves: the hash of the value it wrote. */
  private static String snapshotApplying(String hash) {
    return hash;
  }
}
