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
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.function.Predicate;

/** The state of one reconciliation: the three inputs and the stored value being edited. */
final class MergeContext {
  private final MergeInput input;
  private final ObjectNode originalStored;
  private final ObjectNode stored;
  private final MergeReport report = new MergeReport();
  private final List<MergeUnit> units;
  private final ProviderChange providerChange;

  MergeContext(MergeInput input) {
    this.input = input;
    this.originalStored = objectOrEmpty(input.stored());
    this.stored = originalStored.deepCopy();
    this.units = input.policy().unitsFor(fieldPointers());
    this.providerChange =
        input.policy().hasIdentityProvider()
            ? ProviderChange.between(input.deployment(), originalStored, input.lastApplied())
            : ProviderChange.NONE;
  }

  MergeInput input() {
    return input;
  }

  List<MergeUnit> units() {
    return units;
  }

  MergeReport report() {
    return report;
  }

  ProviderChange providerChange() {
    return providerChange;
  }

  void record(MergeOutcome outcome, MergeUnit unit) {
    report.record(outcome, unit);
  }

  JsonNode deploymentValue(MergeUnit unit) {
    return valueOf(input.deployment(), unit);
  }

  JsonNode storedValue(MergeUnit unit) {
    return valueOf(stored, unit);
  }

  JsonNode lastAppliedValue(MergeUnit unit) {
    return valueOf(input.lastApplied(), unit);
  }

  /** The value the stored setting resolves to, schema defaults included. */
  JsonNode effectiveStoredValue(MergeUnit unit) {
    JsonNode storedValue = storedValue(unit);
    return SettingValues.isBlank(storedValue) ? valueOf(input.schemaDefaults(), unit) : storedValue;
  }

  boolean isInLastApplied(MergeUnit unit) {
    return input.lastApplied() != null
        && unit.pointers().stream()
            .anyMatch(pointer -> JsonPointers.isPresent(input.lastApplied(), pointer));
  }

  boolean deploymentChanged(MergeUnit unit) {
    return !SettingValues.same(deploymentValue(unit), lastAppliedValue(unit));
  }

  /** Whether the stored value was changed, through the UI or an API, since it was last applied. */
  boolean storedChangedSinceLastApplied(MergeUnit unit) {
    JsonNode storedValue = storedValue(unit);
    return !SettingValues.isBlank(storedValue)
        && !SettingValues.same(storedValue, lastAppliedValue(unit));
  }

  boolean isDeliberate(MergeUnit unit) {
    return input.template().isDeliberate(input.deployment(), unit.pointers());
  }

  /**
   * Whether the stored setting has no value of its own for {@code unit}. Saves made before a field
   * was reconciled wrote its schema default explicitly, so for the allow-listed non-privileged
   * fields that default counts as no value.
   */
  boolean storedLacks(MergeUnit unit) {
    JsonNode storedValue = storedValue(unit);
    return SettingValues.isBlank(storedValue)
        || (input.policy().firstSightDefaults().containsAll(unit.pointers())
            && SettingValues.same(storedValue, valueOf(input.schemaDefaults(), unit)));
  }

  /** In ENV mode the deployment owns the fields its configuration file defines. */
  boolean isManagedByDeployment(String pointer) {
    DeploymentTemplate template = input.template();
    return !template.isAvailable() || template.covers(List.of(pointer));
  }

  /** Overwrites the fields of {@code unit} the deployment owns; false when none differed. */
  boolean overwriteManagedFields(MergeUnit unit) {
    List<String> differing =
        unit.pointers().stream()
            .filter(this::isManagedByDeployment)
            .filter(pointer -> !SettingValues.same(storedAt(pointer), deploymentAt(pointer)))
            .toList();
    differing.forEach(pointer -> writeValue(pointer, deploymentAt(pointer)));
    return !differing.isEmpty();
  }

  /** Copies the unit from the deployment; false when nothing could be written. */
  boolean applyFromDeployment(MergeUnit unit) {
    List<String> writable =
        unit.pointers().stream()
            .filter(pointer -> !isInAbsentInactiveProviderBlock(pointer))
            .toList();
    writable.forEach(
        pointer -> writeValue(pointer, JsonPointers.valueAt(input.deployment(), pointer)));
    return !writable.isEmpty();
  }

  void applyValue(String pointer, JsonNode value) {
    writeValue(pointer, value);
  }

  MergeResult result() {
    return new MergeResult(
        stored, input.deployment().deepCopy(), report, !stored.equals(originalStored));
  }

  private JsonNode storedAt(String pointer) {
    return JsonPointers.valueAt(stored, pointer);
  }

  private JsonNode deploymentAt(String pointer) {
    return JsonPointers.valueAt(input.deployment(), pointer);
  }

  private void writeValue(String pointer, JsonNode value) {
    if (SettingValues.isBlank(value)) {
      JsonPointers.removeValue(stored, pointer);
    } else {
      copyMissingAncestorFromDeployment(pointer);
      JsonPointers.setValue(stored, pointer, value.deepCopy());
    }
  }

  /**
   * Creating a provider block the stored setting does not use would leave a partial, invalid block
   * behind that the UI then shows and cannot remove.
   */
  private boolean isInAbsentInactiveProviderBlock(String pointer) {
    List<String> ancestors = JsonPointers.ancestors(pointer);
    return input.policy().hasIdentityProvider()
        && !ancestors.isEmpty()
        && !JsonPointers.isPresent(stored, ancestors.getFirst())
        && !IdentityProviderIdentity.isInActiveBlock(pointer, stored);
  }

  /** A new object gets the deployment's sibling fields too, so it carries its required fields. */
  private void copyMissingAncestorFromDeployment(String pointer) {
    JsonPointers.ancestors(pointer).stream()
        .filter(ancestor -> !JsonPointers.isPresent(stored, ancestor))
        .findFirst()
        .filter(ancestor -> JsonPointers.isPresent(input.deployment(), ancestor))
        .ifPresent(
            ancestor ->
                JsonPointers.setValue(
                    stored,
                    ancestor,
                    JsonPointers.valueAt(input.deployment(), ancestor).deepCopy()));
  }

  private Set<String> fieldPointers() {
    Predicate<String> isSingleValue = input.policy()::isSingleValue;
    Set<String> pointers = new TreeSet<>();
    pointers.addAll(JsonPointers.leaves(input.deployment(), isSingleValue).keySet());
    pointers.addAll(JsonPointers.leaves(originalStored, isSingleValue).keySet());
    pointers.addAll(JsonPointers.leaves(input.lastApplied(), isSingleValue).keySet());
    return pointers;
  }

  private static JsonNode valueOf(JsonNode tree, MergeUnit unit) {
    if (!unit.isGroup()) {
      return JsonPointers.valueAt(tree, unit.pointers().getFirst());
    }
    ObjectNode group = JsonNodeFactory.instance.objectNode();
    for (String pointer : unit.pointers()) {
      JsonNode value = JsonPointers.valueAt(tree, pointer);
      if (!value.isMissingNode()) {
        group.set(pointer, value);
      }
    }
    return group;
  }

  private static ObjectNode objectOrEmpty(JsonNode node) {
    return node instanceof ObjectNode objectNode
        ? objectNode.deepCopy()
        : JsonNodeFactory.instance.objectNode();
  }
}
