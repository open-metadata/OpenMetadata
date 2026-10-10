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
  void rejectsReflexiveAndIrreflexiveCombination() {
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.REFLEXIVE, RelationshipCharacteristic.IRREFLEXIVE));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void rejectsAsymmetricAndReflexiveCombination() {
    // AsymmetricProperty(R) entails IrreflexiveProperty(R) in OWL 2 DL, so declaring a
    // relationship both ASYMMETRIC and REFLEXIVE is exactly as contradictory as
    // REFLEXIVE + IRREFLEXIVE and must be rejected by the validator.
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.ASYMMETRIC, RelationshipCharacteristic.REFLEXIVE));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void acceptsAsymmetricWithIrreflexive() {
    // Asymmetry entails irreflexivity, so the two together are consistent and must be accepted.
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.ASYMMETRIC, RelationshipCharacteristic.IRREFLEXIVE));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void acceptsTransitiveWithAsymmetric() {
    // Transitive + asymmetric (a strict partial order) is satisfiable and not contradictory.
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID())
            .withCharacteristics(
                Set.of(
                    RelationshipCharacteristic.TRANSITIVE, RelationshipCharacteristic.ASYMMETRIC));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void acceptsNullCharacteristics() {
    // Defense for the PUT path which does not run applyDefaults() before validation.
    RelationshipType relationshipType =
        relationshipType(UUID.randomUUID()).withCharacteristics(null);

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
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

  // -------------------------------------------------------------------------
  // validateInverse with client-supplied FQN references (id == null)
  //
  // The public REST API builds inverse/replacedBy references via
  // RelationshipTypeMapper, which only populates type + fullyQualifiedName,
  // leaving id == null. RelationshipTypeRepository.hydrateReferences resolves
  // FQN→id before validation, but the validator must also handle a null-id
  // reference directly (defense in depth, mirroring the bug report's
  // recommended fix).
  // -------------------------------------------------------------------------

  @Test
  void symmetricTypeWithClientSuppliedSelfInverseFqnIsAccepted() {
    // Exactly what RelationshipTypeMapper produces: inverse has fqn = own name, id == null.
    // Before the fix this was falsely rejected ("A symmetric relationship must be its own
    // inverse") because validateInverse compared by getId() only.
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "symmetricRel")
            .withInverse(fqnReference("symmetricRel"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void symmetricTypeWithClientSuppliedDifferentInverseFqnIsRejected() {
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "symmetricRel")
            .withInverse(fqnReference("asymmetricRel"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void symmetricTypeWithNullInverseIsRejected() {
    final RelationshipType relationshipType =
        namedRelationshipType(UUID.randomUUID(), "symmetricRel")
            .withInverse(null)
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void symmetricTypeWithFullSelfReferenceIsAccepted() {
    // References that carry both id and fqn (as LegacyRelationshipTypeMapper produces) —
    // both signals agree and must be accepted.
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "symmetricRel")
            .withInverse(fullReference(id, "symmetricRel"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.SYMMETRIC));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  // -------------------------------------------------------------------------
  // validateReplacement with client-supplied FQN references (id == null)
  // -------------------------------------------------------------------------

  @Test
  void clientSuppliedSelfReplacementFqnIsRejected() {
    // Before the fix the self-replacement guard never fired because it compared by
    // getId() and the client-supplied reference had id == null.
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "replacesItself").withReplacedBy(fqnReference("replacesItself"));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void clientSuppliedDifferentReplacementFqnIsAccepted() {
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "oldType").withReplacedBy(fqnReference("newType"));

    assertDoesNotThrow(() -> RelationshipTypeValidator.validate(relationshipType));
  }

  @Test
  void hydratedSelfReplacementIsRejected() {
    // Id path guard: validateReplacement was rewritten to share isSelfReference; the id-based
    // self-replacement rejection (which always worked) must keep working after the change.
    final UUID id = UUID.randomUUID();
    final RelationshipType relationshipType =
        namedRelationshipType(id, "replacesItself").withReplacedBy(idReference(id));

    assertThrows(
        BadRequestException.class, () -> RelationshipTypeValidator.validate(relationshipType));
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  private static RelationshipType relationshipType(UUID id) {
    return new RelationshipType()
        .withId(id)
        .withRdfPredicate(URI.create("https://example.org/relationships/relatedTo"))
        .withCharacteristics(Set.of());
  }

  private static RelationshipType namedRelationshipType(UUID id, String name) {
    return new RelationshipType()
        .withId(id)
        .withName(name)
        .withFullyQualifiedName(name)
        .withRdfPredicate(URI.create("https://example.org/relationships/" + name))
        .withCharacteristics(Set.of());
  }

  private static final String RELATIONSHIP_TYPE = "relationshipType";

  /** Mimics what {@code EntityUtil.getEntityReference(type, fqn)} and the mapper produce. */
  private static EntityReference fqnReference(String fqn) {
    return new EntityReference().withType(RELATIONSHIP_TYPE).withFullyQualifiedName(fqn);
  }

  /** Mimics a hydrated reference (id populated, no fqn — e.g. applyDefaults path). */
  private static EntityReference idReference(UUID id) {
    return new EntityReference().withId(id).withType(RELATIONSHIP_TYPE);
  }

  /** Mimics a fully-populated reference (id + fqn — e.g. LegacyRelationshipTypeMapper). */
  private static EntityReference fullReference(UUID id, String fqn) {
    return new EntityReference().withId(id).withType(RELATIONSHIP_TYPE).withFullyQualifiedName(fqn);
  }
}
