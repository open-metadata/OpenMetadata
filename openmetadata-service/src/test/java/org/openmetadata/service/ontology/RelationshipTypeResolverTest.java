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
  void inverseNameReturnsInverseTypeName() {
    RelationshipType broader =
        type("broader").withInverse(new EntityReference().withName("narrower"));
    when(relationshipTypeDAO.findEntityByName("broader", Include.NON_DELETED)).thenReturn(broader);

    assertEquals("narrower", resolver().inverseName("broader"));
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
