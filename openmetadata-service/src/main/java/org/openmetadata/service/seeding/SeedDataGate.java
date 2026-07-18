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
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;
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
  private static final String TYPE_SCHEMA_PATH = "json/schema/type/";
  private static final String ENTITY_SCHEMA_PATH = "json/schema/entity/";
  private static final String POLICY_SEED_PATH = "json/data/policy/";
  private static final String ROLE_SEED_PATH = "json/data/role/";
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
  private boolean seedDataDriftDetected;
  private RequiredSeedNames requiredSeedNames = RequiredSeedNames.empty();

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
    seedDataDriftDetected = false;
    requiredSeedNames = RequiredSeedNames.empty();
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
    seedDataDriftDetected = false;
    serverVersion =
        Objects.requireNonNullElse(
            VersionUtils.getOpenMetadataServerVersion(VERSION_RESOURCE).getVersion(), "unknown");
    seedDataFingerprint = calculateSeedDataFingerprint();
    loadStoredChecksums();
    detectSeedDataDrift();
    if (!shouldSeed()) {
      LOG.info(
          "Bundled seed fingerprint is unchanged and every bundled type and non-deletable policy "
              + "and role has a database row; skipping seed reconciliation. Soft deletions, "
              + "modified row content, relationships, and other seed categories are not validated. "
              + "Set STARTUP_FORCE_SEED_DATA=true or STARTUP_SEED_DATA_GATE_ENABLED=false to rerun "
              + "all loaders; unsupported direct DB changes may require manual repair.");
    }
  }

  public synchronized void forceSeedData() {
    forceSeedData = true;
  }

  /**
   * Returns whether bundled seed resources need reconciliation.
   *
   * <p>A fingerprint match is supplemented by one indexed hard-row presence query for every bundled
   * type and non-deletable bundled policy and role. The query does not validate soft deletions, row
   * content, relationships, or other seed categories. {@code STARTUP_FORCE_SEED_DATA=true} or
   * {@code STARTUP_SEED_DATA_GATE_ENABLED=false} reruns all loaders, but unsupported direct database
   * changes may still require manual repair.
   */
  public boolean shouldSeed() {
    return !configuration.isSeedDataGateEnabled()
        || forceSeedData
        || seedDataFingerprint == null
        || !Objects.equals(seedDataFingerprint, storedSeedDataFingerprint)
        || seedDataDriftDetected;
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
      Set<String> typeNames = new TreeSet<>();
      Set<String> policyNames = new TreeSet<>();
      Set<String> roleNames = new TreeSet<>();
      List<String> resources =
          CommonUtil.getResources(SEED_RESOURCES).stream().distinct().sorted().toList();
      for (String resource : resources) {
        updateDigest(digest, resource.getBytes(StandardCharsets.UTF_8));
        try (InputStream input =
            SeedDataGate.class.getClassLoader().getResourceAsStream(resource)) {
          if (input == null) {
            throw new IOException("Missing classpath resource " + resource);
          }
          byte[] content = input.readAllBytes();
          updateDigest(digest, content);
          collectRequiredSeedNames(resource, content, typeNames, policyNames, roleNames);
        }
      }
      requiredSeedNames = requiredSeedNames(typeNames, policyNames, roleNames);
      updateDigest(digest, serverVersion.getBytes(StandardCharsets.UTF_8));
      return HexFormat.of().formatHex(digest.digest());
    } catch (Exception exception) {
      requiredSeedNames = RequiredSeedNames.empty();
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

  private void detectSeedDataDrift() {
    if (systemRepository == null
        || !configuration.isSeedDataGateEnabled()
        || forceSeedData
        || seedDataFingerprint == null
        || !Objects.equals(seedDataFingerprint, storedSeedDataFingerprint)) {
      return;
    }
    try {
      seedDataDriftDetected =
          !systemRepository.hasRequiredSeedRows(
              requiredSeedNames.typeNames(),
              requiredSeedNames.policyNames(),
              requiredSeedNames.roleNames());
      if (seedDataDriftDetected) {
        LOG.warn(
            "Required seed rows are missing despite an unchanged fingerprint; running seed loaders");
      }
    } catch (Exception exception) {
      seedDataDriftDetected = true;
      LOG.warn("Unable to verify required seed rows; seed gate will fail open", exception);
    }
  }

  private static void collectRequiredSeedNames(
      String resource,
      byte[] content,
      Set<String> typeNames,
      Set<String> policyNames,
      Set<String> roleNames)
      throws IOException {
    if (resource.contains(TYPE_SCHEMA_PATH) || resource.contains(ENTITY_SCHEMA_PATH)) {
      typeNames.addAll(JsonUtils.getTypeNames(resource, content));
    } else if (resource.contains(POLICY_SEED_PATH)) {
      String policyName = readRequiredSeedName(resource, content, true);
      if (policyName != null) {
        policyNames.add(policyName);
      }
    } else if (resource.contains(ROLE_SEED_PATH)) {
      String roleName = readRequiredSeedName(resource, content, false);
      if (roleName != null) {
        roleNames.add(roleName);
      }
    }
  }

  private static String readRequiredSeedName(String resource, byte[] content, boolean preferFqn)
      throws IOException {
    var seed = JsonUtils.readTree(new String(content, StandardCharsets.UTF_8));
    var allowDelete = seed.get("allowDelete");
    if (allowDelete == null || !allowDelete.isBoolean()) {
      throw new IOException("Seed resource has no allowDelete flag: " + resource);
    }
    if (allowDelete.booleanValue()) {
      return null;
    }
    String name = preferFqn ? seed.path("fullyQualifiedName").asText(null) : null;
    if (name == null || name.isBlank()) {
      name = seed.path("name").asText(null);
    }
    if (name == null || name.isBlank()) {
      throw new IOException("Seed resource has no name: " + resource);
    }
    return name;
  }

  private static RequiredSeedNames requiredSeedNames(
      Set<String> typeNames, Set<String> policyNames, Set<String> roleNames) throws IOException {
    if (typeNames.isEmpty() || policyNames.isEmpty() || roleNames.isEmpty()) {
      throw new IOException("Required type, policy, or role seed resources are missing");
    }
    return new RequiredSeedNames(
        List.copyOf(typeNames), List.copyOf(policyNames), List.copyOf(roleNames));
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

  private record RequiredSeedNames(
      List<String> typeNames, List<String> policyNames, List<String> roleNames) {
    private static RequiredSeedNames empty() {
      return new RequiredSeedNames(List.of(), List.of(), List.of());
    }
  }
}
