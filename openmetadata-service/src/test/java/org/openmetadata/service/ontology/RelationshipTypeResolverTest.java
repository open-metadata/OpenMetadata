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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

import java.net.URI;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.entity.data.RelationshipType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.RelationshipCharacteristic;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.CollectionDAO;

@ExtendWith(MockitoExtension.class)
class RelationshipTypeResolverTest {
  private static final URI PREDICATE = URI.create("https://open-metadata.org/rel/broader");

  @Mock private CollectionDAO.RelationshipTypeDAO relationshipTypeDAO;

  private RelationshipTypeResolver resolver() {
    return new RelationshipTypeResolver(relationshipTypeDAO);
  }

  private RelationshipType type(final String name) {
    return new RelationshipType().withName(name);
  }

  @Test
  void requireByNameReturnsTypeFromDao() {
    RelationshipType broader = type("broader");
    when(relationshipTypeDAO.findEntityByName("broader", Include.NON_DELETED)).thenReturn(broader);

    assertSame(broader, resolver().require("broader"));
  }

  @Test
  void requireByNameTranslatesNotFoundIntoBadRequest() {
    when(relationshipTypeDAO.findEntityByName("ghost", Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> resolver().require("ghost"));
    assertTrue(exception.getMessage().contains("'ghost' is not registered"));
  }

  @Test
  void requireNamesASoftDeletedTypeAsOneToRestore() {
    when(relationshipTypeDAO.findEntityByName("retired", Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));
    when(relationshipTypeDAO.findEntityByName("retired", Include.ALL))
        .thenReturn(type("retired").withDeleted(true));

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> resolver().require("retired"));
    assertEquals(
        "Relationship type 'retired' is deleted; restore it first", exception.getMessage());
  }

  @Test
  void requireByIdReturnsTypeFromDao() {
    UUID id = UUID.randomUUID();
    RelationshipType broader = type("broader");
    when(relationshipTypeDAO.findEntityById(id, Include.NON_DELETED)).thenReturn(broader);

    assertSame(broader, resolver().require(id));
  }

  @Test
  void requireByIdTranslatesNotFoundIntoBadRequest() {
    UUID id = UUID.randomUUID();
    when(relationshipTypeDAO.findEntityById(id, Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> resolver().require(id));
    assertTrue(exception.getMessage().contains(id.toString()));
    assertTrue(exception.getMessage().contains("is not registered"));
  }

  @Test
  void requireIgnoreCaseMatchesRegardlessOfCasing() {
    when(relationshipTypeDAO.listActive())
        .thenReturn(List.of(JsonUtils.pojoToJson(type("Broader"))));

    RelationshipType matched = resolver().requireIgnoreCase("BROADER");
    assertEquals("Broader", matched.getName());
  }

  @Test
  void requireIgnoreCaseThrowsBadRequestWhenNoActiveTypeMatches() {
    when(relationshipTypeDAO.listActive())
        .thenReturn(List.of(JsonUtils.pojoToJson(type("narrower"))));

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> resolver().requireIgnoreCase("broader"));
    assertTrue(exception.getMessage().contains("'broader' is not registered"));
  }

  @Test
  void inverseNameReturnsNullWhenInverseAbsent() {
    RelationshipType broader = type("broader");
    when(relationshipTypeDAO.findEntityByName("broader", Include.NON_DELETED)).thenReturn(broader);

    assertNull(resolver().inverseName("broader"));
  }

  @Test
  void inverseNameReturnsTheLiveInverseTypeName() {
    RelationshipType broader =
        type("broader").withInverse(new EntityReference().withName("narrower"));
    when(relationshipTypeDAO.findEntityByName("broader", Include.NON_DELETED)).thenReturn(broader);
    when(relationshipTypeDAO.findEntityByName("narrower", Include.NON_DELETED))
        .thenReturn(type("narrower"));

    assertEquals("narrower", resolver().inverseName("broader"));
  }

  @Test
  void inverseNameIsNullWhenTheInverseNamesNoLiveType() {
    RelationshipType forward =
        type("forward").withInverse(apiReference(UUID.randomUUID(), "missing"));
    when(relationshipTypeDAO.findEntityByName("forward", Include.NON_DELETED)).thenReturn(forward);
    when(relationshipTypeDAO.findEntityById(forward.getInverse().getId(), Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));
    when(relationshipTypeDAO.findEntityByName("missing", Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));

    assertNull(resolver().inverseName("forward"));
  }

  @Test
  void requireInverseNameRefusesAnInverseThatNamesNoLiveType() {
    RelationshipType forward =
        type("forward")
            .withInverse(
                new EntityReference().withType("relationshipType").withFullyQualifiedName("gone"));
    when(relationshipTypeDAO.findEntityByName("forward", Include.NON_DELETED)).thenReturn(forward);
    when(relationshipTypeDAO.findEntityByName("gone", Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));

    BadRequestException exception =
        assertThrows(BadRequestException.class, () -> resolver().requireInverseName("forward"));
    assertTrue(exception.getMessage().contains("'gone'"), exception.getMessage());
  }

  @Test
  void requireInverseNameIsNullWhenNoInverseIsDeclared() {
    when(relationshipTypeDAO.findEntityByName("plain", Include.NON_DELETED))
        .thenReturn(type("plain"));

    assertNull(resolver().requireInverseName("plain"));
  }

  @Test
  void inverseOfResolvesAReferenceStoredWithoutANameById() {
    UUID inverseId = UUID.randomUUID();
    RelationshipType forward = type("forward").withInverse(apiReference(inverseId, "inverse"));
    when(relationshipTypeDAO.findEntityById(inverseId, Include.NON_DELETED))
        .thenReturn(type("inverse").withId(inverseId));

    assertEquals("inverse", resolver().inverseOf(forward).orElseThrow().getName());
  }

  @Test
  void inverseOfFallsBackToTheNameWhenTheIdNamesNoLiveType() {
    UUID staleId = UUID.randomUUID();
    RelationshipType forward = type("forward").withInverse(apiReference(staleId, "inverse"));
    when(relationshipTypeDAO.findEntityById(staleId, Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));
    when(relationshipTypeDAO.findEntityByName("inverse", Include.NON_DELETED))
        .thenReturn(type("inverse"));

    assertEquals("inverse", resolver().inverseOf(forward).orElseThrow().getName());
  }

  @Test
  void inverseOfIsEmptyWhenTheInverseNamesNoLiveType() {
    RelationshipType forward =
        type("forward")
            .withInverse(
                new EntityReference().withType("relationshipType").withFullyQualifiedName("gone"));
    when(relationshipTypeDAO.findEntityByName("gone", Include.NON_DELETED))
        .thenThrow(new EntityNotFoundException("missing"));

    assertTrue(resolver().inverseOf(forward).isEmpty());
  }

  @Test
  void inverseOfLooksUpADottedNameByItsQuotedFqn() {
    RelationshipType forward =
        type("forward")
            .withInverse(
                new EntityReference()
                    .withType("relationshipType")
                    .withFullyQualifiedName("\"has.part\""));
    when(relationshipTypeDAO.findEntityByName("\"has.part\"", Include.ALL))
        .thenReturn(type("has.part"));

    assertEquals("has.part", resolver().inverseOf(forward, Include.ALL).orElseThrow().getName());
  }

  @Test
  void requireReturnsReferencesWithTheirNames() {
    RelationshipType forward =
        type("forward")
            .withInverse(apiReference(UUID.randomUUID(), "inverse"))
            .withDisjointWith(Set.of(apiReference(UUID.randomUUID(), "other")));
    when(relationshipTypeDAO.findEntityByName("forward", Include.NON_DELETED)).thenReturn(forward);

    RelationshipType read = resolver().require("forward");
    assertEquals("inverse", read.getInverse().getName());
    assertEquals("other", read.getDisjointWith().iterator().next().getName());
  }

  private static EntityReference apiReference(final UUID id, final String fqn) {
    return new EntityReference()
        .withId(id)
        .withType("relationshipType")
        .withFullyQualifiedName(fqn);
  }

  @Test
  void findByPredicateReturnsNullForNullPredicate() {
    assertNull(resolver().findByPredicate(null));
  }

  @Test
  void findByPredicateReturnsNullWhenDaoReturnsNullJson() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString())).thenReturn(null);

    assertNull(resolver().findByPredicate(PREDICATE));
  }

  @Test
  void findByPredicateDeserializesDaoJson() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type("broader")));

    RelationshipType found = resolver().findByPredicate(PREDICATE);
    assertEquals("broader", found.getName());
  }

  @Test
  void isTransitiveFalseWhenPredicateHasNoType() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString())).thenReturn(null);

    assertFalse(resolver().isTransitive(PREDICATE));
  }

  @Test
  void isTransitiveFalseWhenCharacteristicsNull() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type("broader")));

    assertFalse(resolver().isTransitive(PREDICATE));
  }

  @Test
  void isTransitiveFalseWhenCharacteristicsLackTransitive() {
    RelationshipType type =
        type("broader").withCharacteristics(Set.of(RelationshipCharacteristic.FUNCTIONAL));
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type));

    assertFalse(resolver().isTransitive(PREDICATE));
  }

  @Test
  void isTransitiveTrueWhenTransitivePresent() {
    RelationshipType type =
        type("broader").withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type));

    assertTrue(resolver().isTransitive(PREDICATE));
  }

  @Test
  void isSimpleTrueWhenPredicateHasNoType() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString())).thenReturn(null);

    assertTrue(resolver().isSimple(PREDICATE));
  }

  @Test
  void isSimpleTrueWhenNoCharacteristicsAndNoPropertyChain() {
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type("broader")));

    assertTrue(resolver().isSimple(PREDICATE));
  }

  @Test
  void isSimpleFalseWhenTransitive() {
    RelationshipType type =
        type("broader").withCharacteristics(Set.of(RelationshipCharacteristic.TRANSITIVE));
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type));

    assertFalse(resolver().isSimple(PREDICATE));
  }

  @Test
  void isSimpleFalseWhenPropertyChainPresent() {
    RelationshipType type =
        type("broader").withPropertyChain(List.of(new EntityReference().withName("partOf")));
    when(relationshipTypeDAO.findByPredicate(PREDICATE.toString()))
        .thenReturn(JsonUtils.pojoToJson(type));

    assertFalse(resolver().isSimple(PREDICATE));
  }
}
