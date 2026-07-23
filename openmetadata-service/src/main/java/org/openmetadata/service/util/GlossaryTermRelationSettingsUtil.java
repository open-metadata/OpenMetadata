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
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
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

  public static void validateSystemDefinedRelationTypesPreserved(
      GlossaryTermRelationSettings current, GlossaryTermRelationSettings updated) {
    if (current == null || current.getRelationTypes() == null) {
      return;
    }

    Set<String> updatedSystemDefinedNames = new HashSet<>();
    if (updated != null && updated.getRelationTypes() != null) {
      for (GlossaryTermRelationType relationType : updated.getRelationTypes()) {
        if (relationType != null && Boolean.TRUE.equals(relationType.getIsSystemDefined())) {
          updatedSystemDefinedNames.add(relationType.getName());
        }
      }
    }

    List<String> missingSystemDefinedNames =
        current.getRelationTypes().stream()
            .filter(relationType -> Boolean.TRUE.equals(relationType.getIsSystemDefined()))
            .map(GlossaryTermRelationType::getName)
            .filter(name -> !updatedSystemDefinedNames.contains(name))
            .toList();
    if (!missingSystemDefinedNames.isEmpty()) {
      throw new SystemSettingsException(
          "Cannot delete system-defined relation types: "
              + String.join(", ", missingSystemDefinedNames));
    }
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
