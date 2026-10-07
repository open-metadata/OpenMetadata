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
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.security.AuthenticationConfiguration;
import org.openmetadata.schema.configuration.ConfigSourceMode;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.system.OverriddenSettingField;
import org.openmetadata.schema.system.SettingSource;
import org.openmetadata.schema.system.SettingsSourceResponse;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SettingsManagedByEnvironmentException;
import org.openmetadata.service.jdbi3.SystemRepository;
import org.openmetadata.service.jdbi3.SystemTokenDAOs.SystemDAO;
import org.openmetadata.service.security.auth.ActiveProviderValidator;

/**
 * Reports where each dual-source setting takes its values from, and replaces stored values with
 * deployment values on request ("Use deployment value").
 */
public final class SettingsSourceService {
  private final SystemDAO dao;
  private final SystemRepository repository;
  private final SettingsRefresher refresher;
  private final SettingsMerge merge = new SettingsMerge();

  public SettingsSourceService(
      SystemDAO dao, SystemRepository repository, SettingsRefresher refresher) {
    this.dao = dao;
    this.repository = repository;
    this.refresher = refresher;
  }

  public SettingsSourceResponse status() {
    List<SettingSource> settings =
        ConfigSources.deployment()
            .map(deployment -> deployment.settings().stream().map(this::statusOf).toList())
            .orElse(List.of());
    return new SettingsSourceResponse().withSettings(settings);
  }

  public Optional<SettingSource> status(SettingsType settingsType) {
    return deploymentSetting(settingsType).map(this::statusOf);
  }

  /**
   * Stores the deployment value of the given fields, or of every overridden field when none are
   * given. Identity-provider fields are taken together, so the result never mixes two providers.
   */
  public void adopt(SettingsType settingsType, Collection<String> paths) {
    DeploymentSetting setting =
        deploymentSetting(settingsType)
            .orElseThrow(
                () ->
                    new IllegalArgumentException(
                        settingsType.value() + " is not defined in the deployment configuration"));
    requireNotEnvManaged(settingsType);
    JsonNode stored = storedValue(settingsType).orElse(null);
    MergeContext context = new MergeContext(comparisonInput(setting, stored));
    unitsToAdopt(context, paths).forEach(context::applyFromDeployment);
    Object adopted =
        JsonUtils.convertValue(context.result().stored(), setting.setting().valueClass());
    if (adopted instanceof AuthenticationConfiguration authConfig) {
      ActiveProviderValidator.validate(authConfig, authConfig);
    }
    repository.createOrUpdate(new Settings().withConfigType(settingsType).withConfigValue(adopted));
    refresher.refresh(settingsType);
  }

  private SettingSource statusOf(DeploymentSetting setting) {
    SettingsType type = setting.settingsType();
    ConfigSourceMode mode = ConfigSources.modeOf(type);
    boolean managedByDeployment = mode == ConfigSourceMode.ENV;
    return new SettingSource()
        .withConfigType(type)
        .withSource(mode)
        .withSourceVariable(SettingsWriteGuard.modeVariable(type))
        .withEditable(!managedByDeployment)
        .withManagedPaths(
            managedByDeployment ? List.copyOf(SettingsWriteGuard.managedPaths(type)) : List.of())
        .withOverriddenFields(managedByDeployment ? List.of() : overriddenFields(setting))
        .withLastReloadError(SettingsChangeWatcher.refreshError(type).orElse(null));
  }

  /** Deliberate deployment values the stored setting currently overrides. */
  private List<OverriddenSettingField> overriddenFields(DeploymentSetting setting) {
    return storedValue(setting.settingsType())
        .map(stored -> merge.merge(comparisonInput(setting, stored)).report())
        .map(report -> report.units(MergeOutcome.DRIFT))
        .orElse(List.of())
        .stream()
        .flatMap(unit -> unit.pointers().stream())
        .map(pointer -> overriddenField(setting, pointer))
        .toList();
  }

  private static OverriddenSettingField overriddenField(DeploymentSetting setting, String pointer) {
    return new OverriddenSettingField()
        .withPath(pointer)
        .withEnvVariable(setting.template().envVariable(List.of(pointer)).orElse(null));
  }

  /**
   * Compares the stored value with the deployment as if the deployment had just been applied, so
   * every remaining difference is a stored value overriding a deployment value.
   */
  private static MergeInput comparisonInput(DeploymentSetting setting, JsonNode stored) {
    return MergeInput.builder()
        .policy(SettingsFieldPolicies.of(setting.settingsType()))
        .mode(ConfigSourceMode.AUTO)
        .deployment(setting.value())
        .stored(stored)
        .lastApplied(setting.value())
        .template(setting.template())
        .schemaDefaults(SchemaDefaults.of(setting.setting().valueClass(), setting.value()))
        .build();
  }

  private static List<MergeUnit> unitsToAdopt(MergeContext context, Collection<String> paths) {
    Set<String> requested = Set.copyOf(paths == null ? List.of() : paths);
    List<MergeUnit> chosen =
        context.units().stream()
            .filter(
                unit ->
                    requested.isEmpty() || unit.pointers().stream().anyMatch(requested::contains))
            .toList();
    boolean includesProvider = chosen.stream().anyMatch(MergeUnit::concernsIdentityProvider);
    return context.units().stream()
        .filter(
            unit -> chosen.contains(unit) || (includesProvider && unit.concernsIdentityProvider()))
        .filter(
            unit -> !SettingValues.same(context.storedValue(unit), context.deploymentValue(unit)))
        .collect(Collectors.toList());
  }

  private static void requireNotEnvManaged(SettingsType settingsType) {
    if (ConfigSources.isManagedByDeployment(settingsType)) {
      throw new SettingsManagedByEnvironmentException(
          settingsType,
          SettingsWriteGuard.modeVariable(settingsType),
          List.of(SettingsWriteGuard.WHOLE_SETTING));
    }
  }

  private Optional<JsonNode> storedValue(SettingsType settingsType) {
    return Optional.ofNullable(dao.getConfigJsonWithKey(settingsType.value()))
        .map(json -> SettingsSecrets.decrypted(settingsType, JsonUtils.readTree(json)));
  }

  private static Optional<DeploymentSetting> deploymentSetting(SettingsType settingsType) {
    return ConfigSources.deployment().flatMap(deployment -> deployment.setting(settingsType));
  }
}
