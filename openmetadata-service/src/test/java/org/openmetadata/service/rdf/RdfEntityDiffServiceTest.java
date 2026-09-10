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

package org.openmetadata.service.rdf;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

import jakarta.ws.rs.BadRequestException;
import java.io.StringReader;
import java.net.URI;
import java.util.List;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.api.data.RdfEntityDiff;
import org.openmetadata.schema.type.RdfObjectKind;
import org.openmetadata.schema.type.RdfStatement;
import org.openmetadata.service.ontology.RdfBlankNodeCanonicalizer;

class RdfEntityDiffServiceTest {
  private static final String ENTITY_TYPE = "glossaryTerm";
  private static final Double FROM_VERSION = 0.1;
  private static final Double TO_VERSION = 0.2;
  private final UUID entityId = UUID.randomUUID();
  private final EntityInterface fromEntity = entity();
  private final EntityInterface toEntity = entity();

  @Test
  void returnsTypedAddedAndRemovedStatementsInStableOrder() {
    final RdfEntityDiffService service =
        service(
            """
            @prefix ex: <https://example.org/> .
            ex:term ex:label "Old label"@en ; ex:parent ex:oldParent .
            """,
            """
            @prefix ex: <https://example.org/> .
            ex:term ex:label "New label"@en ; ex:parent ex:newParent .
            """);

    final RdfEntityDiff result = service.diff(ENTITY_TYPE, entityId, FROM_VERSION, TO_VERSION);

    assertEquals(entityId, result.getEntityId());
    assertEquals(ENTITY_TYPE, result.getEntityType());
    assertEquals(2, result.getAddedStatements().size());
    assertEquals(2, result.getRemovedStatements().size());
    assertEquals(
        List.of(RdfObjectKind.LITERAL, RdfObjectKind.IRI),
        result.getAddedStatements().stream().map(RdfStatement::getObjectKind).toList());
    assertEquals("New label", result.getAddedStatements().getFirst().getLiteralValue());
    assertEquals("en", result.getAddedStatements().getFirst().getLanguage());
    assertEquals(
        URI.create("https://example.org/newParent"),
        result.getAddedStatements().getLast().getObjectIri());
  }

  @Test
  void ignoresBlankNodeIdentifierChangesForIsomorphicGraphs() {
    final RdfEntityDiffService service =
        service(
            """
            @prefix ex: <https://example.org/> .
            ex:term ex:restriction [ ex:on ex:attribute ; ex:min 1 ] .
            """,
            """
            @prefix ex: <https://example.org/> .
            _:renamed ex:min 1 ; ex:on ex:attribute .
            ex:term ex:restriction _:renamed .
            """);

    final RdfEntityDiff result = service.diff(ENTITY_TYPE, entityId, FROM_VERSION, TO_VERSION);

    assertEquals(List.of(), result.getAddedStatements());
    assertEquals(List.of(), result.getRemovedStatements());
  }

  @Test
  void rejectsInvalidVersionsBeforeReadingHistory() {
    final RdfEntityDiffService service = service("<urn:s> <urn:p> <urn:o> .", "");

    assertThrows(
        BadRequestException.class,
        () -> service.diff(ENTITY_TYPE, entityId, Double.NaN, TO_VERSION));
  }

  private RdfEntityDiffService service(final String fromRdf, final String toRdf) {
    return new RdfEntityDiffService(
        (entityType, id, version) -> FROM_VERSION.equals(version) ? fromEntity : toEntity,
        entity -> model(entity == fromEntity ? fromRdf : toRdf),
        new RdfBlankNodeCanonicalizer(),
        requested -> requested);
  }

  private static Model model(final String turtle) {
    final Model model = ModelFactory.createDefaultModel();
    model.read(new StringReader(turtle), null, "TURTLE");
    return model;
  }

  private static EntityInterface entity() {
    return mock(EntityInterface.class);
  }
}
