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

import static org.openmetadata.service.config.source.MergeOutcome.APPLIED;
import static org.openmetadata.service.config.source.MergeOutcome.BACKFILLED;
import static org.openmetadata.service.config.source.MergeOutcome.CONFLICT;
import static org.openmetadata.service.config.source.MergeOutcome.DEFAULT_CHANGED;
import static org.openmetadata.service.config.source.MergeOutcome.DRIFT;
import static org.openmetadata.service.config.source.MergeOutcome.IGNORED_BY_DB_MODE;
import static org.openmetadata.service.config.source.MergeOutcome.IGNORED_FOR_IDENTITY;
import static org.openmetadata.service.config.source.MergeOutcome.KEPT_OVER_BLANK;
import static org.openmetadata.service.config.source.SettingValues.isBlank;
import static org.openmetadata.service.config.source.SettingValues.same;

import com.fasterxml.jackson.databind.JsonNode;

/**
 * Reconciles one setting between the deployment configuration, the stored value and the deployment
 * value applied last time. Pure: it reads its input and returns the value to store.
 *
 * <p>In AUTO mode a unit the deployment changed since the last reconciliation is applied, unless
 * the stored value was changed too; then the stored value wins and a conflict is reported. A unit
 * reconciled for the first time is only filled when the stored setting has no value of its own.
 */
public final class SettingsMerge {

  public MergeResult merge(MergeInput input) {
    MergeContext context = new MergeContext(input);
    switch (input.mode()) {
      case ENV -> mergeEnv(context);
      case DB -> context.units().forEach(unit -> mergeDb(context, unit));
      default -> context.units().forEach(unit -> mergeAuto(context, unit));
    }
    return context.result();
  }

  private void mergeAuto(MergeContext context, MergeUnit unit) {
    if (unit.kind() == UnitKind.DEPLOYMENT_OWNED) {
      applyDeploymentOwned(context, unit);
    } else if (isAcrossProviders(context, unit)) {
      mergeAcrossProviderChange(context, unit);
    } else if (!context.isInLastApplied(unit)) {
      reconcileFirstTime(context, unit);
    } else {
      mergeThreeWay(context, unit);
    }
  }

  private void mergeThreeWay(MergeContext context, MergeUnit unit) {
    if (!context.deploymentChanged(unit)) {
      reportDrift(context, unit);
    } else if (unit.kind() == UnitKind.SET_MERGE) {
      mergeEntries(context, unit);
    } else if (isBlank(context.deploymentValue(unit)) && !isBlank(context.storedValue(unit))) {
      // An unset variable, for example a missing secret, must not wipe a working value.
      context.record(KEPT_OVER_BLANK, unit);
    } else if (!context.storedChangedSinceLastApplied(unit)) {
      applyDeploymentChange(context, unit);
    } else if (!same(context.storedValue(unit), context.deploymentValue(unit))) {
      context.record(CONFLICT, unit);
    }
  }

  /**
   * A provider switched in the UI keeps every provider field the UI set. A provider switched in the
   * deployment brings all of its changed fields along, so the old provider's secret or claims are
   * never combined with the new provider.
   */
  private void mergeAcrossProviderChange(MergeContext context, MergeUnit unit) {
    if (!context.deploymentChanged(unit)) {
      reportDriftAcrossProviders(context, unit);
    } else if (context.providerChange() == ProviderChange.BY_DEPLOYMENT) {
      applyProviderSwitch(context, unit);
    } else if (context.isInLastApplied(unit)) {
      context.record(IGNORED_FOR_IDENTITY, unit);
    } else {
      reportDriftAcrossProviders(context, unit);
    }
  }

  private static boolean isAcrossProviders(MergeContext context, MergeUnit unit) {
    return unit.concernsIdentityProvider() && context.providerChange() != ProviderChange.NONE;
  }

  /**
   * The provider fields of a deployment that names no provider of its own override nothing: taking
   * one would mix two providers' settings, or replace the configured provider with the default.
   */
  private void reportDriftAcrossProviders(MergeContext context, MergeUnit unit) {
    if (context.deploymentNamesProvider()) {
      reportDrift(context, unit);
    }
  }

  private void applyProviderSwitch(MergeContext context, MergeUnit unit) {
    if (context.applyFromDeployment(unit)) {
      context.record(APPLIED, unit);
      context.report().markIdentityProviderReplaced();
    }
  }

  private void applyDeploymentChange(MergeContext context, MergeUnit unit) {
    if (context.applyFromDeployment(unit)) {
      context.record(context.isDeliberate(unit) ? APPLIED : DEFAULT_CHANGED, unit);
    }
  }

  private void mergeEntries(MergeContext context, MergeUnit unit) {
    JsonNode merged =
        SetMerge.merge(
            context.storedValue(unit),
            context.lastAppliedValue(unit),
            context.deploymentValue(unit));
    if (!SettingValues.sameElements(merged, context.storedValue(unit))) {
      context.applyValue(unit.pointers().getFirst(), merged);
      context.record(APPLIED, unit);
    }
  }

  private void reconcileFirstTime(MergeContext context, MergeUnit unit) {
    if (!isBackfillable(context, unit)) {
      reportDrift(context, unit);
    } else if (context.applyFromDeployment(unit)) {
      context.record(BACKFILLED, unit);
    }
  }

  /**
   * Only a value the operator set on purpose fills a field: a default from the configuration file
   * may be a value the admin deliberately cleared in the UI.
   */
  private boolean isBackfillable(MergeContext context, MergeUnit unit) {
    JsonNode deploymentValue = context.deploymentValue(unit);
    return context.isDeliberate(unit)
        && !isBlank(deploymentValue)
        && context.storedLacks(unit)
        && !same(deploymentValue, context.effectiveStoredValue(unit));
  }

  /** A blank deployment value means "unset" here as everywhere else, so nothing overrides it. */
  private void reportDrift(MergeContext context, MergeUnit unit) {
    JsonNode deploymentValue = context.deploymentValue(unit);
    if (context.isDeliberate(unit)
        && !isBlank(deploymentValue)
        && overridesDeployment(unit, context.effectiveStoredValue(unit), deploymentValue)) {
      context.record(DRIFT, unit);
    }
  }

  /**
   * Entries added to a set in the UI sit alongside the deployment's, so a set only overrides the
   * deployment when it lacks one of the deployment's entries.
   */
  static boolean overridesDeployment(MergeUnit unit, JsonNode stored, JsonNode deployment) {
    return unit.kind() == UnitKind.SET_MERGE
        ? !SettingValues.containsElements(stored, deployment)
        : !same(stored, deployment);
  }

  private void applyDeploymentOwned(MergeContext context, MergeUnit unit) {
    JsonNode deploymentValue = context.deploymentValue(unit);
    if (!isBlank(deploymentValue)
        && !same(deploymentValue, context.storedValue(unit))
        && context.applyFromDeployment(unit)) {
      context.record(APPLIED, unit);
    }
  }

  private void mergeDb(MergeContext context, MergeUnit unit) {
    if (unit.kind() == UnitKind.DEPLOYMENT_OWNED) {
      applyDeploymentOwned(context, unit);
    } else if (isAcrossProviders(context, unit)) {
      mergeDbAcrossProviderChange(context, unit);
    } else if (!context.isInLastApplied(unit)) {
      reconcileFirstTime(context, unit);
    } else if (context.deploymentChanged(unit) && !isBlank(context.deploymentValue(unit))) {
      context.record(IGNORED_BY_DB_MODE, unit);
    } else {
      reportDrift(context, unit);
    }
  }

  /** DB mode never fills a provider field from a deployment that configures another provider. */
  private void mergeDbAcrossProviderChange(MergeContext context, MergeUnit unit) {
    if (context.isInLastApplied(unit)
        && context.deploymentChanged(unit)
        && !isBlank(context.deploymentValue(unit))) {
      context.record(IGNORED_BY_DB_MODE, unit);
    } else {
      reportDriftAcrossProviders(context, unit);
    }
  }

  private void mergeEnv(MergeContext context) {
    requireConfirmedProviderChange(context);
    for (MergeUnit unit : context.units()) {
      if (context.overwriteManagedFields(unit)) {
        context.record(APPLIED, unit);
      }
    }
  }

  private void requireConfirmedProviderChange(MergeContext context) {
    MergeInput input = context.input();
    boolean replacesProvider =
        input.policy().hasIdentityProvider()
            && !IdentityProviderIdentity.sameProvider(input.stored(), input.deployment());
    if (replacesProvider) {
      context.report().markIdentityProviderReplaced();
    }
    if (replacesProvider && input.switchingToEnv() && !input.confirmProviderChange()) {
      throw new ProviderChangeNotConfirmedException(
          "SECURITY_CONFIG_SOURCE=ENV would replace the identity provider configured in the UI "
              + "with a different one from the deployment configuration. Fix the deployment "
              + "configuration, or set SECURITY_CONFIG_SOURCE_CONFIRM_PROVIDER_CHANGE=true to "
              + "replace it.");
    }
  }
}
