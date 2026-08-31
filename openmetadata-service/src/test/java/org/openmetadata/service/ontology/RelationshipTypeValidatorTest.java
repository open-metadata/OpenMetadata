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

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipCardinality;
import org.openmetadata.schema.type.RelationshipCharacteristic;

class RelationshipTypeValidatorTest {
  @Test
  void acceptsConsistentSymmetricAndFunctionalDefinition() {
    UUID id = UUID.randomUUID();
    RelationshipType relationshipType =
        relationshipType(id)
            .withInverse(new EntityReference().withId(id))
            .withCharacteristics(
                Set.of(RelationshipCharacteristic.SYMMETRIC, RelationshipCharacteristic.FUNCTIONAL))
            .withCardinality(new RelationshipCardinality().withSourceMax(1));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void rejectsContradictoryCharacteristics() {
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.SYMMETRIC, RelationshipCharacteristic.ASYMMETRIC));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void rejectsFunctionalDefinitionWithoutMaximumOne() {
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL))
            .withCardinality(new RelationshipCardinality().withSourceMax(2));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void rejectsSymmetricDefinitionWithDifferentInverse() {
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withInverse(new EntityReference().withId(UUID.randomUUID()))
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  private static RelationshipType relationshipType(UUID id) {
    return new RelationshipType()
        .withId(id)
        .withRdfPredicate(URI.create("https://example.org/relationships/relatedTo"))
        .withCharacteristics(Set.of());
  }
}
