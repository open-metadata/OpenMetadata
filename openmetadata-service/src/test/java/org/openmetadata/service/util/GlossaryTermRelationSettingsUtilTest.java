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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.core.Response;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.service.exception.SystemSettingsException;

class GlossaryTermRelationSettingsUtilTest {
  @Test
  void validateUniqueNamesRejectsCaseInsensitiveDuplicates() {
    GlossaryTermRelationSettings settings =
        new GlossaryTermRelationSettings()
            .withRelationTypes(List.of(relationType("dependsOn"), relationType("DEPENDSON")));

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () -> GlossaryTermRelationSettingsUtil.validateUniqueNames(settings));

    assertEquals("Relation type 'DEPENDSON' already exists.", exception.getMessage());
    assertEquals(Response.Status.CONFLICT.getStatusCode(), exception.getResponse().getStatus());
  }

  @Test
  void normalizeAppliesPresetCardinalityLimits() {
    GlossaryTermRelationType relationType =
        relationType("dependsOn")
            .withCardinality(RelationCardinality.ONE_TO_MANY)
            .withSourceMax(9)
            .withTargetMax(9);

    GlossaryTermRelationSettingsUtil.normalize(relationType);

    assertNull(relationType.getSourceMax());
    assertEquals(1, relationType.getTargetMax());
  }

  @Test
  void validateSystemDefinedRelationTypesRejectsDeletion() {
    GlossaryTermRelationSettings current =
        new GlossaryTermRelationSettings()
            .withRelationTypes(
                List.of(
                    relationType("relatedTo").withIsSystemDefined(true),
                    relationType("dependsOn").withIsSystemDefined(false)));
    GlossaryTermRelationSettings updated =
        new GlossaryTermRelationSettings()
            .withRelationTypes(List.of(relationType("dependsOn").withIsSystemDefined(false)));

    SystemSettingsException exception =
        assertThrows(
            SystemSettingsException.class,
            () ->
                GlossaryTermRelationSettingsUtil.validateSystemDefinedRelationTypesPreserved(
                    current, updated));

    assertEquals("Cannot delete system-defined relation types: relatedTo", exception.getMessage());
  }

  @Test
  void validateSystemDefinedRelationTypesRejectsDowngrade() {
    GlossaryTermRelationSettings current =
        new GlossaryTermRelationSettings()
            .withRelationTypes(List.of(relationType("relatedTo").withIsSystemDefined(true)));
    GlossaryTermRelationSettings updated =
        new GlossaryTermRelationSettings()
            .withRelationTypes(List.of(relationType("relatedTo").withIsSystemDefined(false)));

    assertThrows(
        SystemSettingsException.class,
        () ->
            GlossaryTermRelationSettingsUtil.validateSystemDefinedRelationTypesPreserved(
                current, updated));
  }

  private GlossaryTermRelationType relationType(String name) {
    return new GlossaryTermRelationType().withName(name);
  }
}
