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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Collection;
import java.util.LinkedHashSet;
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
   * Stores the deployment value of the given fields, or of every field the status reports as
   * overridden when none are given, and returns the fields it took. The identity-provider fields of
   * another provider are only taken when the deployment names that provider, and then all together,
   * so the result never mixes two providers.
   */
  public List<String> adopt(SettingsType settingsType, Collection<String> paths) {
    DeploymentSetting setting = requireDeploymentSetting(settingsType);
    requireNotEnvManaged(settingsType);
    MergeInput comparison = comparisonInput(setting, storedValue(settingsType).orElse(null));
    MergeContext context = new MergeContext(comparison);
    Set<String> requested = nullOrEmpty(paths) ? overriddenPointers(comparison) : Set.copyOf(paths);
    List<MergeUnit> units = unitsToAdopt(context, requested);
    units.forEach(unit -> adoptUnit(context, unit));
    if (!units.isEmpty()) {
      store(setting, context.result().stored());
    }
    return units.stream().flatMap(unit -> unit.pointers().stream()).toList();
  }

  private void store(DeploymentSetting setting, JsonNode value) {
    SettingsType type = setting.settingsType();
    Object adopted = JsonUtils.convertValue(value, setting.setting().valueClass());
    if (adopted instanceof AuthenticationConfiguration authConfig) {
      ActiveProviderValidator.validate(authConfig, authConfig);
    }
    repository.createOrUpdate(new Settings().withConfigType(type).withConfigValue(adopted));
    refresher.refresh(type);
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
        .map(stored -> overriddenPointers(comparisonInput(setting, stored)))
        .orElse(Set.of())
        .stream()
        .map(pointer -> overriddenField(setting, pointer))
        .toList();
  }

  private Set<String> overriddenPointers(MergeInput comparison) {
    return merge.merge(comparison).report().units(MergeOutcome.DRIFT).stream()
        .flatMap(unit -> unit.pointers().stream())
        .collect(Collectors.toCollection(LinkedHashSet::new));
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

  private static List<MergeUnit> unitsToAdopt(MergeContext context, Set<String> requested) {
    List<MergeUnit> chosen =
        context.units().stream()
            .filter(unit -> unit.pointers().stream().anyMatch(requested::contains))
            .toList();
    boolean switchesProvider = touchesAnotherProvider(context, chosen);
    if (switchesProvider) {
      requireDeploymentNamesProvider(context);
    }
    return context.units().stream()
        .filter(
            unit -> chosen.contains(unit) || (switchesProvider && unit.concernsIdentityProvider()))
        .filter(unit -> isAdoptable(context, unit, switchesProvider))
        .toList();
  }

  private static boolean touchesAnotherProvider(MergeContext context, List<MergeUnit> chosen) {
    return context.providerChange() != ProviderChange.NONE
        && chosen.stream().anyMatch(MergeUnit::concernsIdentityProvider);
  }

  /**
   * Taking another provider's fields replaces the configured provider, which is only what the
   * operator asked for when the deployment configuration names that provider on purpose.
   */
  private static void requireDeploymentNamesProvider(MergeContext context) {
    if (!context.deploymentNamesProvider()) {
      throw new IllegalArgumentException(
          "The deployment configuration does not set an identity provider of its own, so its "
              + "identity-provider fields cannot replace those of the provider configured here");
    }
  }

  /**
   * A blank deployment value means "not set", so it never replaces a stored value, except when the
   * provider is switched: then the old provider's fields must not survive.
   */
  private static boolean isAdoptable(
      MergeContext context, MergeUnit unit, boolean switchesProvider) {
    JsonNode deploymentValue = context.deploymentValue(unit);
    boolean replacesProvider = switchesProvider && unit.concernsIdentityProvider();
    return SettingsMerge.overridesDeployment(unit, context.storedValue(unit), deploymentValue)
        && (replacesProvider || !SettingValues.isBlank(deploymentValue));
  }

  /**
   * Taking the deployment value of a set, such as the admin principals, restores the deployment's
   * missing entries; entries added here stay, so adopting never revokes an admin.
   */
  private static void adoptUnit(MergeContext context, MergeUnit unit) {
    if (unit.kind() == UnitKind.SET_MERGE) {
      JsonNode merged =
          SetMerge.merge(context.storedValue(unit), null, context.deploymentValue(unit));
      context.applyValue(unit.pointers().getFirst(), merged);
    } else {
      context.applyFromDeployment(unit);
    }
  }

  private static DeploymentSetting requireDeploymentSetting(SettingsType settingsType) {
    return deploymentSetting(settingsType)
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    settingsType.value() + " is not defined in the deployment configuration"));
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
