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
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.settings.SettingsType;

/**
 * What a reconciliation tells the operator. Warnings name fields and environment variables, never
 * values, and each is logged once until what it is about changes; later starts log a count.
 */
@Slf4j
final class ReconcileLog {
  private static final String REMEDY =
      "To use the deployment value, choose 'Use deployment value' on the settings page, run "
          + "./bootstrap/openmetadata-ops.sh adopt-deployment-config --type %s %s, or set %s=ENV.";

  private final DeploymentSetting setting;
  private final MergeResult result;
  private final List<Warning> newWarnings = new ArrayList<>();
  private final List<String> warned = new ArrayList<>();
  private int repeatedWarnings;

  private record Warning(MergeOutcome outcome, MergeUnit unit) {}

  private ReconcileLog(DeploymentSetting setting, MergeResult result) {
    this.setting = setting;
    this.result = result;
  }

  static ReconcileLog of(
      DeploymentSetting setting, MergeResult result, List<String> previouslyWarned) {
    ReconcileLog log = new ReconcileLog(setting, result);
    Arrays.stream(MergeOutcome.values())
        .filter(MergeOutcome::isWarning)
        .forEach(
            outcome ->
                result
                    .report()
                    .units(outcome)
                    .forEach(unit -> log.classify(outcome, unit, previouslyWarned)));
    return log;
  }

  /** Fingerprints of the warnings this reconciliation found, to remember for the next start. */
  List<String> warned() {
    return List.copyOf(warned);
  }

  void write() {
    SettingsType type = setting.settingsType();
    logChange(type, MergeOutcome.APPLIED, "Applied from the deployment configuration");
    logChange(type, MergeOutcome.DEFAULT_CHANGED, "Applied changed deployment defaults");
    logChange(type, MergeOutcome.BACKFILLED, "Filled from the deployment configuration");
    newWarnings.forEach(warning -> LOG.warn(messageOf(warning)));
    if (repeatedWarnings > 0) {
      LOG.info(
          "{}: {} field(s) still differ from the deployment configuration; see the earlier "
              + "warnings or GET /api/v1/system/settings/source",
          type.value(),
          repeatedWarnings);
    }
  }

  private void classify(MergeOutcome outcome, MergeUnit unit, List<String> previouslyWarned) {
    String fingerprint = fingerprintOf(outcome, unit);
    warned.add(fingerprint);
    if (previouslyWarned.contains(fingerprint)) {
      repeatedWarnings++;
    } else {
      newWarnings.add(new Warning(outcome, unit));
    }
  }

  /** Changes when the deployment value changes. Secrets never contribute to the fingerprint. */
  private String fingerprintOf(MergeOutcome outcome, MergeUnit unit) {
    Set<String> secrets = SettingsSecrets.pointersOf(setting.settingsType());
    List<JsonNode> values =
        unit.pointers().stream()
            .filter(pointer -> !secrets.contains(pointer))
            .map(pointer -> SettingValues.canonical(JsonPointers.valueAt(setting.value(), pointer)))
            .toList();
    return String.join(" ", outcome.name(), unit.id(), Integer.toHexString(values.hashCode()));
  }

  private void logChange(SettingsType type, MergeOutcome outcome, String action) {
    List<MergeUnit> units = result.report().units(outcome);
    if (!units.isEmpty()) {
      LOG.info("{}: {}: {}", type.value(), action, describe(units));
    }
  }

  private String messageOf(Warning warning) {
    String field = describe(List.of(warning.unit()));
    String type = setting.settingsType().value();
    String modeVariable = SettingsWriteGuard.modeVariable(setting.settingsType());
    String remedy = remedyFor(warning.unit(), modeVariable);
    return switch (warning.outcome()) {
      case CONFLICT -> String.format(
          "%s: %s was changed both in the deployment configuration and in the UI since the last "
              + "start. Keeping the UI value. %s",
          type, field, remedy);
      case DRIFT -> String.format(
          "%s: %s is set in the deployment configuration, but the value saved in the UI differs "
              + "and is used. %s",
          type, field, remedy);
      case IGNORED_FOR_IDENTITY -> String.format(
          "%s: the deployment configuration changed %s, but the identity provider was changed in "
              + "the UI, so deployment changes to it are ignored.",
          type, field);
      case KEPT_OVER_BLANK -> String.format(
          "%s: %s became empty in the deployment configuration. Keeping the stored value.",
          type, field);
      default -> String.format(
          "%s: %s changed in the deployment configuration, but %s=DB keeps the stored value.",
          type, field, modeVariable);
    };
  }

  private String remedyFor(MergeUnit unit, String modeVariable) {
    String paths =
        unit.pointers().stream()
            .map(pointer -> "--path " + pointer)
            .collect(Collectors.joining(" "));
    return String.format(REMEDY, setting.settingsType().value(), paths, modeVariable);
  }

  private String describe(List<MergeUnit> units) {
    return units.stream().map(this::describe).collect(Collectors.joining(", "));
  }

  private String describe(MergeUnit unit) {
    String fields = unit.isGroup() ? String.join(" + ", unit.pointers()) : unit.id();
    return setting
        .template()
        .envVariable(unit.pointers())
        .map(variable -> fields + " (" + variable + ")")
        .orElse(fields);
  }
}
