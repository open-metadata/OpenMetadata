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

  /**
   * The deployment value the next reconciliation should compare against. Starts as a copy of the
   * deployment; when a nested secret is preserved over a blank deployment value, the preserved
   * value is written back here too, so the next reconciliation sees the stored secret as the
   * deployment's own last-applied value rather than as a UI edit (which would falsely report a
   * conflict on a later sibling change to the enclosing object).
   */
  private final ObjectNode lastApplied;

  private final MergeReport report = new MergeReport();
  private final List<MergeUnit> units;
  private final ProviderChange providerChange;

  MergeContext(MergeInput input) {
    this.input = input;
    this.originalStored = objectOrEmpty(input.stored());
    this.stored = originalStored.deepCopy();
    this.lastApplied = objectOrEmpty(input.deployment());
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

  /**
   * Whether applying {@code unit} from the deployment actually changed the stored value. A
   * preserved nested secret over a blank deployment value writes the same value back, so without
   * this check an unchanged start after a password was preserved would report {@link
   * MergeOutcome#APPLIED} or {@link MergeOutcome#DEFAULT_CHANGED} even though {@code stored} is
   * identical to what it was before the reconciliation.
   */
  boolean storedChangedByApply(MergeUnit unit) {
    return !SettingValues.same(storedValue(unit), valueOf(originalStored, unit));
  }

  /** Whether the stored value was changed, through the UI or an API, since it was last applied. */
  /**
   * An empty value saved in the UI is a change like any other. A field that is absent is not: forms
   * leave out fields they do not show, which says nothing about the admin's intent.
   */
  boolean storedChangedSinceLastApplied(MergeUnit unit) {
    boolean present =
        unit.pointers().stream().anyMatch(pointer -> JsonPointers.isPresent(stored, pointer));
    return present && !SettingValues.same(storedValue(unit), lastAppliedValue(unit));
  }

  boolean isDeliberate(MergeUnit unit) {
    return input.template().isDeliberate(input.deployment(), unit.pointers());
  }

  /**
   * Whether the deployment configuration names its identity provider on purpose. When it only
   * carries the file's default provider, its provider fields belong to a provider nobody set up.
   */
  boolean deploymentNamesProvider() {
    return input
        .template()
        .isDeliberate(input.deployment(), List.of(IdentityProviderIdentity.PROVIDER));
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
            && SettingValues.same(storedValue, firstSightDefaultOf(unit)));
  }

  /** The default older versions stored for the field: the schema's, or the server's fallback. */
  private JsonNode firstSightDefaultOf(MergeUnit unit) {
    JsonNode runtimeDefault = input.policy().runtimeDefaults().get(unit.id());
    return runtimeDefault == null ? valueOf(input.schemaDefaults(), unit) : runtimeDefault;
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
    return applyFromDeployment(unit, false);
  }

  /**
   * Copies the unit from the deployment; false when nothing could be written. When {@code
   * keepBlankNestedSecrets} is set, a secret nested under a single-value object (such as the trust
   * store password inside {@code /ldapConfiguration/trustStoreConfig}) is restored from the stored
   * value when the deployment left it blank or missing, so a missing Kubernetes secret cannot wipe
   * a working password while the rest of the object is still applied.
   */
  boolean applyFromDeployment(MergeUnit unit, boolean keepBlankNestedSecrets) {
    List<String> writable =
        unit.pointers().stream()
            .filter(pointer -> !isInAbsentInactiveProviderBlock(pointer))
            .toList();
    writable.forEach(
        pointer -> writeValue(pointer, JsonPointers.valueAt(input.deployment(), pointer)));
    if (keepBlankNestedSecrets && !writable.isEmpty() && isSecret(unit)) {
      restoreBlankNestedSecrets(unit);
    }
    return !writable.isEmpty();
  }

  /**
   * A unit is secret when it is one of the policy's secret leaves, or when a single-value object
   * unit encloses one. The trust store password lives at
   * {@code /ldapConfiguration/trustStoreConfig/customTrustManagerConfig/trustStoreFilePassword}
   * but its enclosing object
   * {@code /ldapConfiguration/trustStoreConfig} is its own merge unit, so the second clause is what
   * makes the secret-over-blank guard reach it.
   */
  boolean isSecret(MergeUnit unit) {
    return input.policy().secrets().containsAll(unit.pointers())
        || input.policy().secrets().stream()
            .anyMatch(
                secret ->
                    unit.pointers().stream()
                        .anyMatch(pointer -> JsonPointers.isUnder(secret, pointer)));
  }

  void applyValue(String pointer, JsonNode value) {
    writeValue(pointer, value);
  }

  /**
   * Restores, for every secret leaf nested under one of the unit's pointers, the value the stored
   * setting held before this apply when the deployment left that leaf blank or missing. A
   * single-value object is applied as a whole, so without this a missing trust-store password
   * environment variable (resolved by the substituting source provider to an empty string) would
   * wipe a password the operator saved before. Only called from the same-provider apply path: a
   * provider switch that brings its own object replaces the old provider's secret with the new
   * one's, and the wholesale-blank case is already guarded by {@code keepsSecretOverBlank}.
   */
  private void restoreBlankNestedSecrets(MergeUnit unit) {
    for (String pointer : unit.pointers()) {
      for (String secret : secretsUnder(pointer)) {
        JsonNode originalSecret = JsonPointers.valueAt(originalStored, secret);
        if (SettingValues.isBlank(JsonPointers.valueAt(input.deployment(), secret))
            && !SettingValues.isBlank(originalSecret)) {
          JsonPointers.setValue(stored, secret, originalSecret.deepCopy());
          JsonPointers.setValue(lastApplied, secret, originalSecret.deepCopy());
        }
      }
    }
  }

  /** The policy secret pointers at or under {@code pointer}, sorted for stable iteration. */
  private List<String> secretsUnder(String pointer) {
    return input.policy().secrets().stream()
        .filter(secret -> JsonPointers.isUnder(secret, pointer))
        .sorted()
        .toList();
  }

  MergeResult result() {
    return new MergeResult(stored, lastApplied, report, !stored.equals(originalStored));
  }

  private JsonNode storedAt(String pointer) {
    return JsonPointers.valueAt(stored, pointer);
  }

  private JsonNode deploymentAt(String pointer) {
    return JsonPointers.valueAt(input.deployment(), pointer);
  }

  private void writeValue(String pointer, JsonNode value) {
    if (value.isMissingNode()) {
      JsonPointers.removeValue(stored, pointer);
    } else if (SettingValues.isBlank(value)) {
      writeBlank(pointer, value);
    } else {
      copyMissingAncestorFromDeployment(pointer);
      JsonPointers.setValue(stored, pointer, value.deepCopy());
    }
  }

  /**
   * An empty deployment value keeps its key, because some fields must be present even when empty
   * (the authentication schema requires {@code providerName}). It never creates the enclosing
   * object, so an unused provider block stays absent.
   */
  private void writeBlank(String pointer, JsonNode value) {
    if (stored.at(JsonPointers.parentOf(pointer)) instanceof ObjectNode) {
      JsonPointers.setValue(stored, pointer, value.deepCopy());
    } else {
      JsonPointers.removeValue(stored, pointer);
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
