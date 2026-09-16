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
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SavedSparqlQuery;

class SavedSparqlQueryServiceTest {

  @Test
  void normalizesTextIntoANewLibrary() {
    SavedSparqlQuery original = query(UUID.randomUUID(), "  My query  ");
    SavedSparqlQueries requested = new SavedSparqlQueries().withQueries(List.of(original));

    SavedSparqlQueries normalized = SavedSparqlQueryService.normalize(requested);

    assertNotSame(requested, normalized);
    assertNotSame(original, normalized.getQueries().getFirst());
    assertEquals("My query", normalized.getQueries().getFirst().getName());
  }

  @Test
  void rejectsDuplicateIdentifiers() {
    UUID identifier = UUID.randomUUID();
    SavedSparqlQueries requested =
        new SavedSparqlQueries()
            .withQueries(List.of(query(identifier, "First"), query(identifier, "Second")));

    assertThrows(
        IllegalArgumentException.class, () -> SavedSparqlQueryService.normalize(requested));
  }

  @Test
  void rejectsBlankNamesAndQueryBodies() {
    SavedSparqlQuery blankName = query(UUID.randomUUID(), "   ");
    SavedSparqlQuery blankBody = query(UUID.randomUUID(), "Valid").withQuery("\n\t");

    assertThrows(
        IllegalArgumentException.class,
        () ->
            SavedSparqlQueryService.normalize(
                new SavedSparqlQueries().withQueries(List.of(blankName))));
    assertThrows(
        IllegalArgumentException.class,
        () ->
            SavedSparqlQueryService.normalize(
                new SavedSparqlQueries().withQueries(List.of(blankBody))));
  }

  private static SavedSparqlQuery query(UUID identifier, String name) {
    return new SavedSparqlQuery()
        .withId(identifier)
        .withName(name)
        .withQuery("SELECT ?entity WHERE { ?entity ?predicate ?value }")
        .withFormat(SavedSparqlQuery.Format.JSON)
        .withInference(SavedSparqlQuery.Inference.NONE)
        .withSavedAt(123L);
  }
}
