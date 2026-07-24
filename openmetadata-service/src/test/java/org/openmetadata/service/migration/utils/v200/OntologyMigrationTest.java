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

package org.openmetadata.service.migration.utils.v200;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.net.URI;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.type.RelationshipTypeCategory;
import org.openmetadata.service.ontology.LegacyRelationshipTypeMapper;
import org.openmetadata.service.ontology.RelationshipTypeIds;

class OntologyMigrationTest {
  private static final LegacyRelationshipTypeMapper MAPPER =
      new LegacyRelationshipTypeMapper(
          Clock.fixed(Instant.parse("2026-07-18T00:00:00Z"), ZoneOffset.UTC));

  @Test
  void convertsLegacyDefinitionWithoutLosingOwlSemantics() {
    GlossaryTermRelationType configuredType =
        baseType()
            .withRdfPredicate(URI.create("https://example.org/prescribes"))
            .withDomain(List.of("Medical.Concept", "https://example.org/ExternalClass"))
            .withIsFunctional(true)
            .withIsAsymmetric(true)
            .withCardinality(RelationCardinality.CUSTOM);

    RelationshipType relationshipType = MAPPER.map(configuredType, "migration-test");

    assertEquals(RelationshipTypeIds.stableId("prescribes"), relationshipType.getId());
    assertEquals(RelationshipTypeCategory.CUSTOM, relationshipType.getCategory());
    assertEquals(URI.create("https://example.org/prescribes"), relationshipType.getRdfPredicate());
    assertEquals(2, relationshipType.getDomain().size());
    assertTrue(relationshipType.getDomain().iterator().next().getIri().isAbsolute());
    assertTrue(
        relationshipType.getCharacteristics().contains(RelationshipCharacteristic.FUNCTIONAL));
    assertTrue(
        relationshipType.getCharacteristics().contains(RelationshipCharacteristic.ASYMMETRIC));
    assertEquals(1, relationshipType.getCardinality().getSourceMax());
    assertNull(relationshipType.getCardinality().getTargetMax());
  }

  @Test
  void mapsPresetCardinalityToExplicitLimits() {
    GlossaryTermRelationType configuredType =
        baseType().withCardinality(RelationCardinality.ONE_TO_MANY);

    RelationshipType relationshipType = MAPPER.map(configuredType, "migration-test");

    assertNull(relationshipType.getCardinality().getSourceMax());
    assertEquals(1, relationshipType.getCardinality().getTargetMax());
  }

  @Test
  void leavesUnconfiguredCardinalityAbsent() {
    RelationshipType relationshipType = MAPPER.map(baseType(), "migration-test");

    assertNull(relationshipType.getCardinality());
  }

  private static GlossaryTermRelationType baseType() {
    return new GlossaryTermRelationType()
        .withName("prescribes")
        .withDisplayName("Prescribes")
        .withDescription("A prescription relation")
        .withCategory(RelationCategory.ASSOCIATIVE)
        .withIsCrossGlossaryAllowed(true)
        .withIsSystemDefined(false);
  }
}
