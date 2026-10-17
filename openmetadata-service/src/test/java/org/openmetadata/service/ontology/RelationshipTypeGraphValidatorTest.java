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
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.RelationshipCharacteristic;

class RelationshipTypeGraphValidatorTest {
  private static final URI SKOS_BROADER = URI.create("http://www.w3.org/2004/02/skos/core#broader");
  private static final URI SKOS_RELATED = URI.create("http://www.w3.org/2004/02/skos/core#related");
  private static final URI RDFS_SUBCLASS_OF =
      URI.create("http://www.w3.org/2000/01/rdf-schema#subClassOf");

  @Test
  void acceptsTwoMemberTransitiveSelfChain() {
    final RelationshipType transitive = relationshipType("ancestorOf");
    final EntityReference self = reference(transitive);
    transitive
        .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
        .withPropertyChain(List.of(self, self));

    assertDoesNotThrow(() -> validator(Map.of()).validate(transitive));
  }

  @Test
  void rejectsSingleMemberAndNonTransitiveSelfChains() {
    final RelationshipType candidate = relationshipType("contains");
    final EntityReference self = reference(candidate);

    candidate.setPropertyChain(List.of(self));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));

    candidate.setPropertyChain(List.of(self, self));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));
  }

  @Test
  void rejectsIndirectDependencyCycle() {
    final RelationshipType first = relationshipType("first");
    final RelationshipType second = relationshipType("second");
    first.setPropertyChain(List.of(reference(second), reference(second)));
    second.setPropertyChain(List.of(reference(first), reference(first)));
    final Map<UUID, RelationshipType> types = new HashMap<>();
    types.put(first.getId(), first);
    types.put(second.getId(), second);

    assertThrows(BadRequestException.class, () -> validator(types).validate(first));
  }

  @Test
  void rejectsUnknownAndSelfDisjointReferences() {
    final RelationshipType candidate = relationshipType("related");
    candidate.setPropertyChain(
        List.of(
            new EntityReference().withId(UUID.randomUUID()),
            new EntityReference().withId(UUID.randomUUID())));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));

    candidate.setPropertyChain(List.of());
    candidate.setDisjointWith(Set.of(reference(candidate)));
    assertThrows(BadRequestException.class, () -> validator(Map.of()).validate(candidate));
  }

  @Test
  void rejectsChainsAndDisjointnessThatNameReservedPredicates() {
    final RelationshipType broader = relationshipType("broader").withRdfPredicate(SKOS_BROADER);
    final RelationshipType partOf = relationshipType("partOf").withRdfPredicate(ex("partOf"));
    final Map<UUID, RelationshipType> types = types(broader, partOf);

    final RelationshipType chained =
        relationshipType("chained")
            .withRdfPredicate(ex("chained"))
            .withPropertyChain(List.of(reference(partOf), reference(broader)));
    assertRejected(types, chained, "reserved");

    final RelationshipType disjoint =
        relationshipType("disjoint")
            .withRdfPredicate(ex("disjoint"))
            .withDisjointWith(Set.of(reference(broader)));
    assertRejected(types, disjoint, "reserved");

    final RelationshipType reservedWithChain =
        relationshipType("subClassOf")
            .withRdfPredicate(RDFS_SUBCLASS_OF)
            .withPropertyChain(List.of(reference(partOf), reference(partOf)));
    assertRejected(types, reservedWithChain, "reserved predicate");
  }

  @Test
  void keepsTransitiveAndSymmetricOnReservedTypesAsNavigationHints() {
    final RelationshipType subClassOf =
        relationshipType("subClassOf")
            .withRdfPredicate(RDFS_SUBCLASS_OF)
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    final RelationshipType superClassOf =
        relationshipType("superClassOf")
            .withRdfPredicate(ex("superClassOf"))
            .withInverse(reference(subClassOf));

    assertDoesNotThrow(() -> validator(types(subClassOf)).validate(subClassOf));
    assertDoesNotThrow(
        () ->
            validator(types(subClassOf))
                .validate(
                    superClassOf.withCharacteristics(
                        Set.of(RelationshipCharacteristic.ASYMMETRIC))),
        "a reserved inverse's hints do not make a type non-simple");
  }

  @Test
  void rejectsTransitiveTypesThatAreAlsoFunctionalAsymmetricOrIrreflexive() {
    for (final RelationshipCharacteristic forbidden :
        List.of(
            RelationshipCharacteristic.FUNCTIONAL,
            RelationshipCharacteristic.INVERSE_FUNCTIONAL,
            RelationshipCharacteristic.ASYMMETRIC,
            RelationshipCharacteristic.IRREFLEXIVE)) {
      final RelationshipType candidate =
          relationshipType("ancestorOf")
              .withRdfPredicate(ex("ancestorOf"))
              .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE, forbidden));
      assertRejected(Map.of(), candidate, "not simple (transitive)");
    }
  }

  @Test
  void rejectsSimpleOnlyCharacteristicsOnChainedTypesAndInversesOfTransitiveTypes() {
    final RelationshipType parentOf = relationshipType("parentOf").withRdfPredicate(ex("parentOf"));
    final RelationshipType ancestorOf =
        relationshipType("ancestorOf")
            .withRdfPredicate(ex("ancestorOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    final Map<UUID, RelationshipType> types = types(parentOf, ancestorOf);

    final RelationshipType grandparentOf =
        relationshipType("grandparentOf")
            .withRdfPredicate(ex("grandparentOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.IRREFLEXIVE))
            .withPropertyChain(List.of(reference(parentOf), reference(parentOf)));
    assertRejected(types, grandparentOf, "defined by a property chain");

    final RelationshipType descendantOf =
        relationshipType("descendantOf")
            .withRdfPredicate(ex("descendantOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.ASYMMETRIC))
            .withInverse(reference(ancestorOf));
    assertRejected(types, descendantOf, "its inverse 'ancestorOf' is transitive");
  }

  @Test
  void rejectsDisjointnessOverNonSimpleTypes() {
    final RelationshipType ancestorOf =
        relationshipType("ancestorOf")
            .withRdfPredicate(ex("ancestorOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    final RelationshipType siblingOf =
        relationshipType("siblingOf").withRdfPredicate(ex("siblingOf"));
    final Map<UUID, RelationshipType> types = types(ancestorOf, siblingOf);

    assertRejected(
        types,
        relationshipType("parentOf")
            .withRdfPredicate(ex("parentOf"))
            .withDisjointWith(Set.of(reference(ancestorOf))),
        "'ancestorOf' is not simple");
    assertRejected(
        types,
        relationshipType("cousinOf")
            .withRdfPredicate(ex("cousinOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE))
            .withDisjointWith(Set.of(reference(siblingOf))),
        "forbids it in property disjointness");
    assertDoesNotThrow(
        () ->
            validator(types)
                .validate(
                    relationshipType("parentOf")
                        .withRdfPredicate(ex("parentOf"))
                        .withDisjointWith(Set.of(reference(siblingOf)))));
  }

  @Test
  void rejectsAChangeThatBreaksATypeNamingTheCandidate() {
    final RelationshipType siblingOf =
        relationshipType("siblingOf").withRdfPredicate(ex("siblingOf"));
    final RelationshipType parentOf =
        relationshipType("parentOf")
            .withRdfPredicate(ex("parentOf"))
            .withDisjointWith(Set.of(reference(siblingOf)));
    final RelationshipType chained =
        relationshipType("chained")
            .withRdfPredicate(ex("chained"))
            .withPropertyChain(List.of(reference(siblingOf), reference(siblingOf)));
    final Map<UUID, RelationshipType> types = types(siblingOf, parentOf, chained);
    final RelationshipTypeGraphValidator validator =
        new RelationshipTypeGraphValidator(types::get, () -> List.copyOf(types.values()));

    final RelationshipType transitiveSibling =
        relationshipType("siblingOf")
            .withId(siblingOf.getId())
            .withRdfPredicate(ex("siblingOf"))
            .withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    assertMessage(
        assertThrows(BadRequestException.class, () -> validator.validate(transitiveSibling)),
        "'parentOf' is disjoint with");

    final RelationshipType reservedSibling =
        relationshipType("siblingOf").withId(siblingOf.getId()).withRdfPredicate(SKOS_RELATED);
    assertMessage(
        assertThrows(BadRequestException.class, () -> validator.validate(reservedSibling)),
        "cannot use reserved predicate");
  }

  private static void assertRejected(
      final Map<UUID, RelationshipType> types,
      final RelationshipType candidate,
      final String expectedMessage) {
    assertMessage(
        assertThrows(BadRequestException.class, () -> validator(types).validate(candidate)),
        expectedMessage);
  }

  private static void assertMessage(final BadRequestException exception, final String expected) {
    assertTrue(
        exception.getMessage().contains(expected),
        "expected '" + expected + "' in: " + exception.getMessage());
  }

  private static Map<UUID, RelationshipType> types(final RelationshipType... types) {
    final Map<UUID, RelationshipType> byId = new HashMap<>();
    for (final RelationshipType type : types) {
      byId.put(type.getId(), type);
    }
    return byId;
  }

  private static URI ex(final String name) {
    return URI.create("https://example.org/family/" + name);
  }

  private static RelationshipTypeGraphValidator validator(final Map<UUID, RelationshipType> types) {
    return new RelationshipTypeGraphValidator(types::get);
  }

  private static RelationshipType relationshipType(final String name) {
    return new RelationshipType()
        .withId(UUID.randomUUID())
        .withName(name)
        .withCharacteristics(Set.of())
        .withPropertyChain(List.of())
        .withDisjointWith(Set.of());
  }

  private static EntityReference reference(final RelationshipType type) {
    return new EntityReference().withId(type.getId()).withName(type.getName());
  }
}
