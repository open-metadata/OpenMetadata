/*
 *  Copyright 2026 Collate.
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

package org.openmetadata.service.util;

import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.SystemSettingsException;

public final class GlossaryTermRelationSettingsUtil {
  private GlossaryTermRelationSettingsUtil() {}

  public static void normalize(GlossaryTermRelationSettings settings) {
    if (settings == null || settings.getRelationTypes() == null) {
      return;
    }

    settings.getRelationTypes().forEach(GlossaryTermRelationSettingsUtil::normalize);
  }

  public static void normalize(GlossaryTermRelationType relationType) {
    if (relationType == null) {
      return;
    }

    RelationCardinality cardinality = relationType.getCardinality();
    if (cardinality == null) {
      relationType.setCardinality(
          deriveCardinality(relationType.getSourceMax(), relationType.getTargetMax()));
      return;
    }

    switch (cardinality) {
      case ONE_TO_ONE -> {
        relationType.setSourceMax(1);
        relationType.setTargetMax(1);
      }
      case ONE_TO_MANY -> {
        relationType.setSourceMax(1);
        relationType.setTargetMax(null);
      }
      case MANY_TO_ONE -> {
        relationType.setSourceMax(null);
        relationType.setTargetMax(1);
      }
      case MANY_TO_MANY -> {
        relationType.setSourceMax(null);
        relationType.setTargetMax(null);
      }
      case CUSTOM -> {}
    }
  }

  public static void validateUniqueNames(GlossaryTermRelationSettings settings) {
    if (settings == null || settings.getRelationTypes() == null) {
      return;
    }

    Set<String> relationTypeNames = new HashSet<>();
    for (GlossaryTermRelationType relationType : settings.getRelationTypes()) {
      if (relationType == null || relationType.getName() == null) {
        continue;
      }

      String normalizedName = relationType.getName().toLowerCase(Locale.ROOT);
      if (!relationTypeNames.add(normalizedName)) {
        throw new SystemSettingsException(
            Response.Status.CONFLICT,
            String.format("Relation type '%s' already exists.", relationType.getName()));
      }
    }
  }

  /**
   * Enforces the immutability contract for seeded (system-defined) relation types on the generic
   * settings-update path. System-defined types cannot be removed or downgraded, no new type may be
   * flagged as system-defined (create/promote), and an existing system-defined type's fields cannot
   * be edited. Custom relation types are unaffected. The dedicated relationTypes endpoint and the UI
   * already enforce this; this covers the remaining generic {@code PUT /system/settings} path.
   */
  public static void validateSystemDefinedRelationTypesPreserved(
      GlossaryTermRelationSettings current, GlossaryTermRelationSettings updated) {
    if (current == null || current.getRelationTypes() == null) {
      return;
    }

    Map<String, GlossaryTermRelationType> updatedByName = indexByName(updated);
    validateNoSystemDefinedRemoved(current, updatedByName);
    validateNoUnsanctionedSystemDefined(current, updated);
    validateSystemDefinedUnmodified(current, updatedByName);
  }

  private static Map<String, GlossaryTermRelationType> indexByName(
      GlossaryTermRelationSettings settings) {
    Map<String, GlossaryTermRelationType> byName = new HashMap<>();
    if (settings == null || settings.getRelationTypes() == null) {
      return byName;
    }
    for (GlossaryTermRelationType relationType : settings.getRelationTypes()) {
      if (relationType != null && relationType.getName() != null) {
        byName.put(relationType.getName(), relationType);
      }
    }
    return byName;
  }

  private static void validateNoSystemDefinedRemoved(
      GlossaryTermRelationSettings current, Map<String, GlossaryTermRelationType> updatedByName) {
    List<String> removed = new ArrayList<>();
    for (GlossaryTermRelationType currentType : current.getRelationTypes()) {
      if (!Boolean.TRUE.equals(currentType.getIsSystemDefined())) {
        continue;
      }
      GlossaryTermRelationType updatedType = updatedByName.get(currentType.getName());
      if (updatedType == null || !Boolean.TRUE.equals(updatedType.getIsSystemDefined())) {
        removed.add(currentType.getName());
      }
    }
    if (!removed.isEmpty()) {
      throw new SystemSettingsException(
          "Cannot delete system-defined relation types: " + String.join(", ", removed));
    }
  }

  private static void validateNoUnsanctionedSystemDefined(
      GlossaryTermRelationSettings current, GlossaryTermRelationSettings updated) {
    if (updated == null || updated.getRelationTypes() == null) {
      return;
    }
    Set<String> currentSystemDefinedNames = new HashSet<>();
    for (GlossaryTermRelationType relationType : current.getRelationTypes()) {
      if (Boolean.TRUE.equals(relationType.getIsSystemDefined())) {
        currentSystemDefinedNames.add(relationType.getName());
      }
    }
    List<String> unsanctioned = new ArrayList<>();
    for (GlossaryTermRelationType updatedType : updated.getRelationTypes()) {
      if (updatedType != null
          && Boolean.TRUE.equals(updatedType.getIsSystemDefined())
          && !currentSystemDefinedNames.contains(updatedType.getName())) {
        unsanctioned.add(updatedType.getName());
      }
    }
    if (!unsanctioned.isEmpty()) {
      throw new SystemSettingsException(
          "Cannot create or promote system-defined relation types: "
              + String.join(", ", unsanctioned));
    }
  }

  private static void validateSystemDefinedUnmodified(
      GlossaryTermRelationSettings current, Map<String, GlossaryTermRelationType> updatedByName) {
    List<String> modified = new ArrayList<>();
    for (GlossaryTermRelationType currentType : current.getRelationTypes()) {
      if (!Boolean.TRUE.equals(currentType.getIsSystemDefined())) {
        continue;
      }
      GlossaryTermRelationType updatedType = updatedByName.get(currentType.getName());
      if (updatedType != null && isRelationTypeModified(currentType, updatedType)) {
        modified.add(currentType.getName());
      }
    }
    if (!modified.isEmpty()) {
      throw new SystemSettingsException(
          "Cannot modify system-defined relation types: " + String.join(", ", modified));
    }
  }

  private static boolean isRelationTypeModified(
      GlossaryTermRelationType current, GlossaryTermRelationType updated) {
    // Compare normalized copies so derived cardinality fields (sourceMax/targetMax) don't
    // register as spurious edits when the stored value predates normalization.
    GlossaryTermRelationType currentCopy =
        JsonUtils.deepCopy(current, GlossaryTermRelationType.class);
    GlossaryTermRelationType updatedCopy =
        JsonUtils.deepCopy(updated, GlossaryTermRelationType.class);
    normalize(currentCopy);
    normalize(updatedCopy);
    return !JsonUtils.valueToTree(currentCopy).equals(JsonUtils.valueToTree(updatedCopy));
  }

  private static RelationCardinality deriveCardinality(Integer sourceMax, Integer targetMax) {
    if (sourceMax == null && targetMax == null) {
      return RelationCardinality.MANY_TO_MANY;
    }
    if (Integer.valueOf(1).equals(sourceMax) && Integer.valueOf(1).equals(targetMax)) {
      return RelationCardinality.ONE_TO_ONE;
    }
    if (Integer.valueOf(1).equals(sourceMax) && targetMax == null) {
      return RelationCardinality.ONE_TO_MANY;
    }
    if (sourceMax == null && Integer.valueOf(1).equals(targetMax)) {
      return RelationCardinality.MANY_TO_ONE;
    }
    return RelationCardinality.CUSTOM;
  }
}
