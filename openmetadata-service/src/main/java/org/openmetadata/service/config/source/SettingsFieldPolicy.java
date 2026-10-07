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

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import lombok.Builder;
import lombok.Singular;

/**
 * How each field of one setting is reconciled. Fields not listed are {@link
 * UnitKind#INDEPENDENT}.
 *
 * @param deploymentOwned fields always taken from the deployment
 * @param identityPointers fields that name the identity provider
 * @param idpDependentPrefixes fields, or objects of fields, that belong to one identity provider
 * @param groups fields applied all or nothing
 * @param setMerge lists merged entry by entry
 * @param singleValuePrefixes objects compared and applied whole instead of field by field
 * @param firstSightDefaults non-privileged fields whose stored schema default counts as unset the
 *     first time they are reconciled, because older saves wrote every default explicitly
 * @param hasIdentityProvider whether the identity-provider guard applies to this setting
 */
@Builder
public record SettingsFieldPolicy(
    @Singular("deploymentOwned") Set<String> deploymentOwned,
    @Singular("identity") Set<String> identityPointers,
    @Singular("idpDependent") List<String> idpDependentPrefixes,
    @Singular("group") List<FieldGroup> groups,
    @Singular("setMerge") Set<String> setMerge,
    @Singular("singleValue") Set<String> singleValuePrefixes,
    @Singular("firstSightDefault") Set<String> firstSightDefaults,
    boolean hasIdentityProvider) {

  public static SettingsFieldPolicy independent() {
    return SettingsFieldPolicy.builder().build();
  }

  public boolean isSingleValue(String pointer) {
    return singleValuePrefixes.contains(pointer);
  }

  public UnitKind kindOf(String pointer) {
    UnitKind kind = UnitKind.INDEPENDENT;
    if (deploymentOwned.contains(pointer)) {
      kind = UnitKind.DEPLOYMENT_OWNED;
    } else if (identityPointers.contains(pointer)) {
      kind = UnitKind.IDP_IDENTITY;
    } else if (setMerge.contains(pointer)) {
      kind = UnitKind.SET_MERGE;
    } else if (isIdpDependent(pointer)) {
      kind = UnitKind.IDP_DEPENDENT;
    }
    return kind;
  }

  /** The units to reconcile for a setting whose fields are {@code leafPointers}. */
  public List<MergeUnit> unitsFor(Set<String> leafPointers) {
    Map<String, MergeUnit> units = new LinkedHashMap<>();
    groups.forEach(group -> units.put(group.name(), group.toUnit()));
    leafPointers.stream()
        .filter(pointer -> groupOf(pointer).isEmpty())
        .forEach(pointer -> units.put(pointer, MergeUnit.field(pointer, kindOf(pointer))));
    List<MergeUnit> ordered = new ArrayList<>(units.values());
    // The provider and client type are decided first, so every later unit sees which provider
    // blocks are active.
    ordered.sort(
        Comparator.comparing((MergeUnit unit) -> unit.kind() != UnitKind.IDP_IDENTITY)
            .thenComparing(SettingsFieldPolicy::depth));
    return List.copyOf(ordered);
  }

  private static long depth(MergeUnit unit) {
    return unit.pointers().getFirst().chars().filter(character -> character == '/').count();
  }

  public Optional<FieldGroup> groupOf(String pointer) {
    return groups.stream().filter(group -> group.contains(pointer)).findFirst();
  }

  private boolean isIdpDependent(String pointer) {
    return idpDependentPrefixes.stream().anyMatch(prefix -> JsonPointers.isUnder(pointer, prefix));
  }
}
