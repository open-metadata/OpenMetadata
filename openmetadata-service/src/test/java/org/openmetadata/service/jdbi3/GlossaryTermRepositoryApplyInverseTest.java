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

package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TermRelation;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.ontology.RelationshipTypeResolver;

/**
 * Defense in depth for the dangling-inverse bug: a stored {@link RelationshipType} whose inverse
 * pointed at a never-registered name used to throw {@code "Relationship type 'X' is not
 * registered"} from {@code setFields -> getRelatedTerms -> applyInverse -> require(inverseName)},
 * turning a single bad edge into a permanent HTTP 400 on every {@code ?fields=relatedTerms}
 * read of the affected term. {@code applyInverse} now fails soft: the relation keeps its
 * stored perspective and the read returns successfully (the bad inverse is logged, not
 * propagated).
 */
@ExtendWith(MockitoExtension.class)
class GlossaryTermRepositoryApplyInverseTest {

  @Mock private RelationshipTypeResolver resolver;

  @Test
  void appliesInverseWhenTargetIsRegistered() {
    RelationshipType broader =
        new RelationshipType()
            .withId(UUID.randomUUID())
            .withName("broader")
            .withFullyQualifiedName("broader");
    when(resolver.inverseName("narrower")).thenReturn("broader");
    when(resolver.require("broader")).thenReturn(broader);

    TermRelation relation = relationType("narrower");

    GlossaryTermRepository.applyInverse(relation, resolver);

    assertEquals(
        "broader", relation.getRelationType(), "the stored type is flipped to the inverse");
    assertEquals(
        broader.getId(),
        relation.getRelationshipType().getId(),
        "the relationshipType is the inverse type's reference");
  }

  @Test
  void noopWhenInverseNameIsNull() {
    // A symmetric or no-inverse relationship type has no inverseName; applyInverse must be a
    // no-op that leaves the stored perspective untouched.
    when(resolver.inverseName("synonym")).thenReturn(null);

    TermRelation relation = relationType("synonym");

    assertDoesNotThrow(() -> GlossaryTermRepository.applyInverse(relation, resolver));
    assertEquals("synonym", relation.getRelationType(), "a null inverse leaves the stored type");
  }

  @Test
  void failsSoftWhenStoredTypeIsNotRegistered() {
    // The stored type itself is unresolvable — applyInverse must not propagate the 400 from
    // require(name) up to setFields; the rest of the term reading must succeed.
    when(resolver.inverseName("narrower"))
        .thenThrow(new BadRequestException("'narrower' is not registered"));

    TermRelation relation = relationType("narrower");

    assertDoesNotThrow(() -> GlossaryTermRepository.applyInverse(relation, resolver));
    assertEquals(
        "narrower",
        relation.getRelationType(),
        "stored perspective is kept when the stored type is missing");
  }

  @Test
  void failsSoftWhenInverseTypeIsNotRegistered() {
    // The exact regression from the bug report: a stored 'prescribes' type with an inverse
    // referencing the never-registered 'prescribedBy'. applyInverse must skip the inversion
    // rather than propagating the 400 that previously broke relatedTerms reads.
    when(resolver.inverseName("prescribes")).thenReturn("prescribedBy");
    when(resolver.require("prescribedBy"))
        .thenThrow(new BadRequestException("'prescribedBy' is not registered"));

    TermRelation relation = relationType("prescribes");
    EntityReference storedRelationshipType = relation.getRelationshipType();

    assertDoesNotThrow(() -> GlossaryTermRepository.applyInverse(relation, resolver));
    assertEquals(
        "prescribes",
        relation.getRelationType(),
        "stored perspective is kept when the inverse is missing");
    // The stored relationshipType reference is left untouched (the inverse's id is NOT stamped
    // onto the relation when the inverse is missing).
    assertEquals(
        storedRelationshipType.getId(),
        relation.getRelationshipType().getId(),
        "the stored relationshipType reference is preserved");
    assertEquals(
        "prescribes",
        relation.getRelationshipType().getName(),
        "the stored relationshipType name is preserved");
  }

  private static TermRelation relationType(String name) {
    EntityReference storedTypeRef = relationshipTypeReference(name);
    return new TermRelation().withRelationType(name).withRelationshipType(storedTypeRef);
  }

  private static EntityReference relationshipTypeReference(String name) {
    return new EntityReference()
        .withId(UUID.randomUUID())
        .withType("relationshipType")
        .withName(name)
        .withFullyQualifiedName(name);
  }
}
