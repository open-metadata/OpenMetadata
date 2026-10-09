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

import com.google.common.annotations.VisibleForTesting;
import com.google.common.base.Suppliers;
import java.util.EnumMap;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;

/**
 * Where each dual-source setting takes its values from in this process.
 *
 * <p>The mode a server reconciled with is persisted with the setting. Processes that do not
 * reconcile, such as a CLI job that may not carry the server's environment, use that persisted
 * mode first, so they cannot write over a setting the deployment owns.
 */
public final class ConfigSources {
  private static final Map<SettingsType, ConfigSourceMode> PERSISTED_MODES =
      new EnumMap<>(SettingsType.class);
  private static final Map<SettingsType, ConfigSourceMode> TEST_MODES =
      new EnumMap<>(SettingsType.class);
  private static volatile Supplier<DeploymentConfig> deployment = () -> null;

  private ConfigSources() {}

  public static void install(DeploymentConfig deploymentConfig) {
    deployment = () -> deploymentConfig;
  }

  /** Captures the deployment configuration on first use; CLI commands rarely need it. */
  public static void installLazily(Supplier<DeploymentConfig> capture) {
    deployment = Suppliers.memoize(capture::get);
  }

  public static Optional<DeploymentConfig> deployment() {
    return Optional.ofNullable(deployment.get());
  }

  public static void loadPersistedModes(SystemDAO dao) {
    for (SettingsType settingsType : ConfigSourceGroup.dualSourceTypes()) {
      persistedModeOf(dao, settingsType).ifPresent(mode -> recordPersistedMode(settingsType, mode));
    }
  }

  public static synchronized void recordPersistedMode(
      SettingsType settingsType, ConfigSourceMode mode) {
    if (mode != null) {
      PERSISTED_MODES.put(settingsType, mode);
    }
  }

  public static synchronized ConfigSourceMode modeOf(SettingsType settingsType) {
    ConfigSourceMode mode = TEST_MODES.get(settingsType);
    if (mode == null) {
      mode = PERSISTED_MODES.get(settingsType);
    }
    if (mode == null) {
      mode = deployment().map(config -> config.modeOf(settingsType)).orElse(ConfigSourceMode.AUTO);
    }
    return mode;
  }

  public static boolean isManagedByDeployment(SettingsType settingsType) {
    return ConfigSourceGroup.isDualSource(settingsType)
        && modeOf(settingsType) == ConfigSourceMode.ENV;
  }

  /** Forces a mode until the returned handle is closed. For tests only. */
  public static synchronized AutoCloseable overrideForTest(
      SettingsType settingsType, ConfigSourceMode mode) {
    TEST_MODES.put(settingsType, mode);
    return () -> clearTestMode(settingsType);
  }

  @VisibleForTesting
  static synchronized void forgetPersistedModes() {
    PERSISTED_MODES.clear();
  }

  private static synchronized void clearTestMode(SettingsType settingsType) {
    TEST_MODES.remove(settingsType);
  }

  private static Optional<ConfigSourceMode> persistedModeOf(
      SystemDAO dao, SettingsType settingsType) {
    try {
      return Optional.ofNullable(dao.getStoredSettingRow(settingsType.value()))
          .flatMap(row -> DeploymentSnapshot.parse(row.snapshot()))
          .map(DeploymentSnapshot::meta)
          .map(DeploymentSnapshot.Meta::mode);
    } catch (JdbiException | JsonParsingException unavailable) {
      // The snapshot column arrives with the 2.1.0 migration; until then no mode was persisted.
      return Optional.empty();
    }
  }
}
