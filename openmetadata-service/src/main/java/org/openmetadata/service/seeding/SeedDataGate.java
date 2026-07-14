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

package org.openmetadata.service.seeding;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.TreeMap;
import java.util.regex.Pattern;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.configuration.StartupChecksums;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.schema.utils.VersionUtils;
import org.openmetadata.service.config.StartupConfiguration;
import org.openmetadata.service.jdbi3.SystemRepository;

@Slf4j
public final class SeedDataGate {
  private static final Pattern SEED_RESOURCES =
      Pattern.compile(".*json/(data|schema/(type|entity))/.*\\.json$");
  private static final String VERSION_RESOURCE = "/catalog/VERSION";
  private static final SeedDataGate INSTANCE = new SeedDataGate();

  private StartupConfiguration configuration = new StartupConfiguration();
  private SystemRepository systemRepository;
  private String serverVersion = "unknown";
  private String seedDataFingerprint;
  private String storedSeedDataFingerprint;
  private String storedSearchTemplateFingerprint;
  private String pendingSearchTemplateFingerprint;
  private String storedServerVersion;
  private boolean seedFailure;
  private boolean searchTemplateFailure;
  private boolean forceSeedData;

  private SeedDataGate() {}

  public static SeedDataGate getInstance() {
    return INSTANCE;
  }

  public synchronized void reset() {
    configuration = new StartupConfiguration();
    systemRepository = null;
    serverVersion = "unknown";
    seedDataFingerprint = null;
    storedSeedDataFingerprint = null;
    storedSearchTemplateFingerprint = null;
    pendingSearchTemplateFingerprint = null;
    storedServerVersion = null;
    seedFailure = false;
    searchTemplateFailure = false;
    forceSeedData = false;
  }

  public synchronized void configure(
      StartupConfiguration startupConfiguration, SystemRepository repository) {
    configuration =
        startupConfiguration == null ? new StartupConfiguration() : startupConfiguration;
    systemRepository = repository;
    forceSeedData = configuration.isForceSeedData();
    seedFailure = false;
    searchTemplateFailure = false;
    pendingSearchTemplateFingerprint = null;
    serverVersion =
        Objects.requireNonNullElse(
            VersionUtils.getOpenMetadataServerVersion(VERSION_RESOURCE).getVersion(), "unknown");
    seedDataFingerprint = calculateSeedDataFingerprint();
    loadStoredChecksums();
    if (!shouldSeed()) {
      LOG.info(
          "Bundled seed fingerprint is unchanged; skipping seed reconciliation. "
              + "Out-of-band seed-row changes are not detected by this gate. Set "
              + "STARTUP_FORCE_SEED_DATA=true for one restart or "
              + "STARTUP_SEED_DATA_GATE_ENABLED=false to reconcile them.");
    }
  }

  public synchronized void forceSeedData() {
    forceSeedData = true;
  }

  /**
   * Returns whether bundled seed resources need reconciliation.
   *
   * <p>The fingerprint intentionally avoids querying every seed table on warm startup. It therefore
   * does not detect rows deleted or modified outside OpenMetadata; operators can force a
   * reconciliation startup with {@code STARTUP_FORCE_SEED_DATA=true} or disable the gate with
   * {@code STARTUP_SEED_DATA_GATE_ENABLED=false}.
   */
  public boolean shouldSeed() {
    return !configuration.isSeedDataGateEnabled()
        || forceSeedData
        || seedDataFingerprint == null
        || !Objects.equals(seedDataFingerprint, storedSeedDataFingerprint);
  }

  public boolean shouldUpdateSearchTemplates(String fingerprint, int createdIndexCount) {
    return !configuration.isSearchTemplateGateEnabled()
        || forceSeedData
        || createdIndexCount > 0
        || !Objects.equals(fingerprint, storedSearchTemplateFingerprint);
  }

  public int getSearchInitParallelism() {
    return Math.max(1, configuration.getSearchInitParallelism());
  }

  public synchronized void recordSearchTemplateFingerprint(String fingerprint) {
    pendingSearchTemplateFingerprint = fingerprint;
    searchTemplateFailure = false;
  }

  public synchronized void recordSearchTemplateFailure() {
    pendingSearchTemplateFingerprint = null;
    searchTemplateFailure = true;
  }

  public synchronized void recordSeedFailure() {
    seedFailure = true;
  }

  public synchronized void stampIfClean() {
    if (systemRepository == null) {
      return;
    }
    String seedFingerprintToStore = seedFailure ? null : seedDataFingerprint;
    String searchFingerprintToStore =
        searchTemplateFailure
            ? null
            : pendingSearchTemplateFingerprint == null
                ? storedSearchTemplateFingerprint
                : pendingSearchTemplateFingerprint;
    if (Objects.equals(seedFingerprintToStore, storedSeedDataFingerprint)
        && Objects.equals(searchFingerprintToStore, storedSearchTemplateFingerprint)
        && Objects.equals(serverVersion, storedServerVersion)) {
      return;
    }

    StartupChecksums checksums =
        new StartupChecksums()
            .withSeedDataFingerprint(seedFingerprintToStore)
            .withSearchTemplateFingerprint(searchFingerprintToStore)
            .withServerVersion(serverVersion)
            .withAppliedAt(System.currentTimeMillis());
    try {
      systemRepository.updateSetting(
          new Settings().withConfigType(SettingsType.STARTUP_CHECKSUMS).withConfigValue(checksums));
      storedSeedDataFingerprint = seedFingerprintToStore;
      storedSearchTemplateFingerprint = searchFingerprintToStore;
      storedServerVersion = serverVersion;
    } catch (Exception exception) {
      LOG.warn("Unable to persist startup fingerprints; the next startup will retry", exception);
    }
  }

  public static String fingerprint(Map<String, String> values) {
    MessageDigest digest = sha256Digest();
    new TreeMap<>(values)
        .forEach(
            (key, value) -> {
              updateDigest(digest, key.getBytes(StandardCharsets.UTF_8));
              updateDigest(digest, value.getBytes(StandardCharsets.UTF_8));
            });
    return HexFormat.of().formatHex(digest.digest());
  }

  private String calculateSeedDataFingerprint() {
    try {
      MessageDigest digest = sha256Digest();
      List<String> resources =
          CommonUtil.getResources(SEED_RESOURCES).stream().distinct().sorted().toList();
      for (String resource : resources) {
        updateDigest(digest, resource.getBytes(StandardCharsets.UTF_8));
        try (InputStream input =
            SeedDataGate.class.getClassLoader().getResourceAsStream(resource)) {
          if (input == null) {
            throw new IOException("Missing classpath resource " + resource);
          }
          updateDigest(digest, input.readAllBytes());
        }
      }
      updateDigest(digest, serverVersion.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest.digest());
    } catch (Exception exception) {
      LOG.warn("Unable to fingerprint seed data; seed gate will fail open", exception);
      return null;
    }
  }

  private void loadStoredChecksums() {
    storedSeedDataFingerprint = null;
    storedSearchTemplateFingerprint = null;
    storedServerVersion = null;
    if (systemRepository == null) {
      return;
    }
    Settings stored = systemRepository.getConfigWithKey(SettingsType.STARTUP_CHECKSUMS.toString());
    if (stored == null || stored.getConfigValue() == null) {
      return;
    }
    StartupChecksums checksums =
        JsonUtils.convertValue(stored.getConfigValue(), StartupChecksums.class);
    storedSeedDataFingerprint = checksums.getSeedDataFingerprint();
    storedSearchTemplateFingerprint = checksums.getSearchTemplateFingerprint();
    storedServerVersion = checksums.getServerVersion();
  }

  private static MessageDigest sha256Digest() {
    try {
      return MessageDigest.getInstance("SHA-256");
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException("SHA-256 is unavailable", exception);
    }
  }

  private static void updateDigest(MessageDigest digest, byte[] bytes) {
    digest.update(bytes);
    digest.update((byte) 0);
  }
}
