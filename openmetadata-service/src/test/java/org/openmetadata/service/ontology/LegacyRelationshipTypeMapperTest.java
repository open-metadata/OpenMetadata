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

package org.openmetadata.service.ontology;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.configuration.GlossaryTermRelationSettings;
import org.openmetadata.schema.configuration.GlossaryTermRelationType;
import org.openmetadata.schema.configuration.RelationCardinality;
import org.openmetadata.schema.configuration.RelationCategory;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.ProviderType;
import org.openmetadata.schema.type.RelationshipCharacteristic;

class LegacyRelationshipTypeMapperTest {
  private static final Instant NOW = Instant.parse("2026-07-18T00:00:00Z");
  private final LegacyRelationshipTypeMapper mapper =
      new LegacyRelationshipTypeMapper(Clock.fixed(NOW, ZoneOffset.UTC));

  @Test
  void mapsDirectionalCardinalityFromTheSourcePerspective() {
    RelationshipType oneToMany =
        mapper.map(type("oneToMany", RelationCardinality.ONE_TO_MANY), "admin");
    RelationshipType manyToOne =
        mapper.map(type("manyToOne", RelationCardinality.MANY_TO_ONE), "admin");

    assertNull(oneToMany.getCardinality().getSourceMax());
    assertEquals(1, oneToMany.getCardinality().getTargetMax());
    assertEquals(1, manyToOne.getCardinality().getSourceMax());
    assertNull(manyToOne.getCardinality().getTargetMax());
  }

  @Test
  void resolvesExplicitAndSymmetricInverseReferences() {
    GlossaryTermRelationType broader = type("broader", null).withInverseRelation("narrower");
    GlossaryTermRelationType narrower = type("narrower", null).withInverseRelation("broader");
    GlossaryTermRelationType synonym = type("synonym", null).withIsSymmetric(true);
    GlossaryTermRelationSettings settings =
        new GlossaryTermRelationSettings().withRelationTypes(List.of(broader, narrower, synonym));

    List<RelationshipType> mapped = mapper.map(settings, "admin");

    assertEquals("narrower", mapped.getFirst().getInverse().getName());
    assertEquals("broader", mapped.get(1).getInverse().getName());
    assertEquals(mapped.get(2).getId(), mapped.get(2).getInverse().getId());
    assertTrue(mapped.get(2).getCharacteristics().contains(RelationshipCharacteristic.SYMMETRIC));
  }

  @Test
  void usesTheInjectedClockForDeterministicMigrationRows() {
    RelationshipType mapped = mapper.map(type("governs", null), "migration-user");

    assertEquals(NOW.toEpochMilli(), mapped.getUpdatedAt());
    assertEquals("migration-user", mapped.getUpdatedBy());
    assertEquals(ProviderType.USER, mapped.getProvider());
  }

  private static GlossaryTermRelationType type(String name, RelationCardinality cardinality) {
    return new GlossaryTermRelationType()
        .withName(name)
        .withDisplayName(name)
        .withDescription(name)
        .withCategory(RelationCategory.ASSOCIATIVE)
        .withCardinality(cardinality)
        .withIsCrossGlossaryAllowed(true)
        .withIsSystemDefined(false);
  }
}
