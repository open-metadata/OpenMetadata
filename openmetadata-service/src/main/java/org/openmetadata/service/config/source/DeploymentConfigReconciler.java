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

import com.fasterxml.jackson.databind.JsonNode;
import jakarta.ws.rs.WebApplicationException;
import java.util.List;
import java.util.Optional;
import lombok.extern.slf4j.Slf4j;
import org.jdbi.v3.core.JdbiException;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.resources.settings.SettingsCache;

/**
 * Brings the settings that live both in the deployment configuration and in the database in line
 * at server start, according to each setting's source mode. Runs in the server only: a CLI job may
 * not carry the server's environment and must not apply its own.
 */
@Slf4j
public final class DeploymentConfigReconciler {
  private static final int MAX_ATTEMPTS = 3;

  private final SystemDAO dao;
  private final DeploymentSettingPreparer preparer;
  private final String appVersion;
  private final SettingsMerge merge = new SettingsMerge();

  public DeploymentConfigReconciler(
      SystemDAO dao, DeploymentSettingPreparer preparer, String appVersion) {
    this.dao = dao;
    this.preparer = preparer;
    this.appVersion = appVersion;
  }

  public void reconcileAll(DeploymentConfig deployment) {
    requireEnvSettingsApplicable(deployment);
    deployment.settings().forEach(setting -> reconcile(deployment, setting));
  }

  /** Stores the deployment value of every setting the database does not have yet. */
  public void seedMissing(DeploymentConfig deployment) {
    deployment.settings().forEach(setting -> seedIfAbsent(deployment, setting));
  }

  /**
   * In AUTO and DB modes a setting that cannot be reconciled keeps its stored value, so one bad
   * value never stops the server. In ENV mode the operator required the deployment value, so the
   * server must not start with another one.
   */
  public void reconcile(DeploymentConfig deployment, DeploymentSetting setting) {
    ConfigSourceMode mode = deployment.modeOf(setting.settingsType());
    try {
      reconcileWithRetries(deployment, setting, mode);
    } catch (JdbiException
        | IllegalArgumentException
        | IllegalStateException
        | WebApplicationException failure) {
      if (mode == ConfigSourceMode.ENV) {
        throw startStoppedBy(setting, failure);
      }
      LOG.error(
          "{} could not be reconciled with the deployment configuration and keeps its stored "
              + "value: {}",
          setting.settingsType().value(),
          failure.getMessage(),
          failure);
    }
  }

  /**
   * A setting in ENV mode that cannot be applied stops the start. Checking every one of them before
   * writing any keeps a stopped start from changing the others, such as the authorizer when the
   * identity provider of the same security group is refused.
   */
  private void requireEnvSettingsApplicable(DeploymentConfig deployment) {
    deployment.settings().stream()
        .filter(setting -> deployment.modeOf(setting.settingsType()) == ConfigSourceMode.ENV)
        .forEach(setting -> requireApplicable(deployment, setting));
  }

  private void requireApplicable(DeploymentConfig deployment, DeploymentSetting setting) {
    try {
      Optional.ofNullable(dao.getStoredSettingRow(setting.settingsType().value()))
          .ifPresent(row -> checkEnvMerge(deployment, setting, row));
    } catch (JdbiException
        | IllegalArgumentException
        | IllegalStateException
        | WebApplicationException failure) {
      throw startStoppedBy(setting, failure);
    }
  }

  private void checkEnvMerge(
      DeploymentConfig deployment, DeploymentSetting setting, StoredSettingRow row) {
    Optional<DeploymentSnapshot> previous = DeploymentSnapshot.parse(row.snapshot());
    if (previous.filter(this::isFromNewerServer).isEmpty()) {
      MergeResult result =
          merge.merge(inputOf(deployment, setting, ConfigSourceMode.ENV, row, previous));
      if (result.storedChanged()) {
        preparer.prepareReconciled(setting.settingsType(), result.stored());
      }
    }
  }

  private static IllegalStateException startStoppedBy(
      DeploymentSetting setting, RuntimeException failure) {
    return new IllegalStateException(
        String.format(
            "%s cannot be applied from the deployment configuration: %s",
            setting.settingsType().value(), failure.getMessage()),
        failure);
  }

  private void reconcileWithRetries(
      DeploymentConfig deployment, DeploymentSetting setting, ConfigSourceMode mode) {
    boolean done = false;
    for (int attempt = 0; attempt < MAX_ATTEMPTS && !done; attempt++) {
      done = reconcileOnce(deployment, setting, mode);
    }
    if (!done) {
      LOG.warn(
          "{} kept changing while it was reconciled; it will be reconciled on the next start",
          setting.settingsType().value());
    }
  }

  private boolean reconcileOnce(
      DeploymentConfig deployment, DeploymentSetting setting, ConfigSourceMode mode) {
    StoredSettingRow row = dao.getStoredSettingRow(setting.settingsType().value());
    return row == null ? insertSeed(setting, mode) : mergeAndStore(deployment, setting, mode, row);
  }

  private void seedIfAbsent(DeploymentConfig deployment, DeploymentSetting setting) {
    if (dao.getStoredSettingRow(setting.settingsType().value()) == null) {
      insertSeed(setting, deployment.modeOf(setting.settingsType()));
    }
  }

  private boolean insertSeed(DeploymentSetting setting, ConfigSourceMode mode) {
    SettingsType type = setting.settingsType();
    DeploymentSnapshot snapshot =
        new DeploymentSnapshot(
            SettingsSecrets.encrypted(type, setting.value()),
            new DeploymentSnapshot.Meta(mode, appVersion, null, List.of(), null));
    boolean inserted =
        dao.insertSettingsIfAbsent(
                type.value(), preparer.prepareSeed(type, setting.value()), snapshot.toJson())
            > 0;
    if (inserted) {
      ConfigSources.recordPersistedMode(type, mode);
      SettingsCache.invalidateSettings(type.value());
      LOG.info("{}: stored the deployment configuration", type.value());
    }
    return inserted;
  }

  private boolean mergeAndStore(
      DeploymentConfig deployment,
      DeploymentSetting setting,
      ConfigSourceMode mode,
      StoredSettingRow row) {
    Optional<DeploymentSnapshot> previous = DeploymentSnapshot.parse(row.snapshot());
    boolean done = true;
    if (previous.filter(this::isFromNewerServer).isPresent()) {
      LOG.warn(
          "{} was last reconciled by a newer server version; not applying this server's "
              + "deployment configuration to it",
          setting.settingsType().value());
    } else {
      MergeResult result = merge.merge(inputOf(deployment, setting, mode, row, previous));
      done = store(setting, mode, row, previous, result);
    }
    return done;
  }

  private boolean isFromNewerServer(DeploymentSnapshot snapshot) {
    return snapshot.meta() != null
        && ServerVersions.isOlder(appVersion, snapshot.meta().appVersion());
  }

  private MergeInput inputOf(
      DeploymentConfig deployment,
      DeploymentSetting setting,
      ConfigSourceMode mode,
      StoredSettingRow row,
      Optional<DeploymentSnapshot> previous) {
    SettingsType type = setting.settingsType();
    return MergeInput.builder()
        .policy(SettingsFieldPolicies.of(type))
        .mode(mode)
        .deployment(setting.value())
        .stored(SettingsSecrets.decrypted(type, JsonUtils.readTree(row.json())))
        .lastApplied(lastAppliedOf(type, previous))
        .template(setting.template())
        .schemaDefaults(SchemaDefaults.of(setting.setting().valueClass(), setting.value()))
        .switchingToEnv(mode == ConfigSourceMode.ENV && previousMode(previous) != mode)
        .confirmProviderChange(deployment.confirmProviderChange())
        .build();
  }

  private static JsonNode lastAppliedOf(SettingsType type, Optional<DeploymentSnapshot> previous) {
    return previous
        .map(DeploymentSnapshot::values)
        .map(values -> (JsonNode) SettingsSecrets.decrypted(type, values))
        .orElse(null);
  }

  private static ConfigSourceMode previousMode(Optional<DeploymentSnapshot> previous) {
    return previous.map(DeploymentSnapshot::meta).map(DeploymentSnapshot.Meta::mode).orElse(null);
  }

  private boolean store(
      DeploymentSetting setting,
      ConfigSourceMode mode,
      StoredSettingRow row,
      Optional<DeploymentSnapshot> previous,
      MergeResult result) {
    SettingsType type = setting.settingsType();
    ReconcileLog log =
        ReconcileLog.of(setting, result, previous.map(this::warnedOf).orElse(List.of()));
    DeploymentSnapshot snapshot =
        new DeploymentSnapshot(
            SettingsSecrets.encrypted(type, result.lastApplied()),
            metaOf(mode, row, previous, log.warned()));
    boolean stored =
        result.storedChanged()
            ? storeMerged(type, row, result, snapshot)
            : storeSnapshot(type, row, snapshot);
    if (stored) {
      ConfigSources.recordPersistedMode(type, mode);
      log.write();
    }
    return stored;
  }

  private List<String> warnedOf(DeploymentSnapshot snapshot) {
    return snapshot.meta() == null ? List.of() : snapshot.meta().warned();
  }

  private DeploymentSnapshot.Meta metaOf(
      ConfigSourceMode mode,
      StoredSettingRow row,
      Optional<DeploymentSnapshot> previous,
      List<String> warned) {
    Optional<DeploymentSnapshot.Meta> previousMeta = previous.map(DeploymentSnapshot::meta);
    boolean switchingToEnv = mode == ConfigSourceMode.ENV && previousMode(previous) != mode;
    JsonNode previousStored =
        switchingToEnv
            ? JsonUtils.readTree(row.json())
            : previousMeta.map(DeploymentSnapshot.Meta::previousStored).orElse(null);
    String appliedJsonHash =
        previousMeta.map(DeploymentSnapshot.Meta::appliedJsonHash).orElse(null);
    return new DeploymentSnapshot.Meta(mode, appVersion, appliedJsonHash, warned, previousStored);
  }

  private boolean storeMerged(
      SettingsType type, StoredSettingRow row, MergeResult result, DeploymentSnapshot snapshot) {
    String updatedJson = preparer.prepareReconciled(type, result.stored());
    boolean written =
        dao.updateSettingsWithSnapshotIfCurrent(
                type.value(), row.json(), updatedJson, snapshot.toJson())
            > 0;
    if (written) {
      SettingsCache.invalidateSettings(type.value());
    }
    return written;
  }

  private boolean storeSnapshot(
      SettingsType type, StoredSettingRow row, DeploymentSnapshot snapshot) {
    return dao.updateDeploymentSnapshotIfCurrent(
            type.value(), row.json(), row.snapshot(), snapshot.toJson())
        > 0;
  }
}
