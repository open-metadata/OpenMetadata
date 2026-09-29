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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SavedSparqlQuery;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.service.docstore.PrivateDocumentType;

class SavedSparqlQueryStoreTest {

  @Test
  void returnsAnEmptyLibraryWhenTheUserHasNoQueries() {
    final SavedSparqlQueryDocumentRepository repository =
        mock(SavedSparqlQueryDocumentRepository.class);
    final UUID userId = UUID.randomUUID();

    final SavedSparqlQueries result = new SavedSparqlQueryStore(repository).get(userId);

    assertEquals(List.of(), result.getQueries());
  }

  @Test
  void storesTheLibraryInAnOwnerBoundPrivateDocument() {
    final SavedSparqlQueryDocumentRepository repository =
        mock(SavedSparqlQueryDocumentRepository.class);
    final UriInfo uriInfo = mock(UriInfo.class);
    final UUID userId = UUID.randomUUID();
    final SavedSparqlQuery query =
        new SavedSparqlQuery()
            .withId(UUID.randomUUID())
            .withName("My query")
            .withQuery("SELECT ?s WHERE { ?s ?p ?o }")
            .withFormat(SavedSparqlQuery.Format.JSON)
            .withInference(SavedSparqlQuery.Inference.NONE)
            .withSavedAt(123L);
    final SavedSparqlQueries library = new SavedSparqlQueries().withQueries(List.of(query));
    final ArgumentCaptor<Document> document = ArgumentCaptor.forClass(Document.class);
    when(repository.save(any(), isNull(), any(), any()))
        .thenAnswer(invocation -> invocation.getArgument(2));

    final SavedSparqlQueries stored =
        new SavedSparqlQueryStore(repository).save(uriInfo, userId, "owner", library);

    verify(repository).save(any(), isNull(), document.capture(), any());
    assertEquals(PrivateDocumentType.SPARQL_QUERY.value(), document.getValue().getEntityType());
    assertEquals(userId.toString(), document.getValue().getName());
    assertEquals("SparqlQuery." + userId, document.getValue().getFullyQualifiedName());
    assertNull(document.getValue().getId());
    assertEquals(library, stored);
  }

  @Test
  void decodesOnlyTheOwningUsersDocument() {
    final SavedSparqlQueryDocumentRepository repository =
        mock(SavedSparqlQueryDocumentRepository.class);
    final UUID userId = UUID.randomUUID();
    final SavedSparqlQueries library =
        new SavedSparqlQueries().withQueries(List.of(query(UUID.randomUUID())));
    final SavedSparqlQueryDocumentCodec codec = new SavedSparqlQueryDocumentCodec();
    when(repository.findByFqn(codec.documentFqn(userId))).thenReturn(codec.encode(userId, library));

    final SavedSparqlQueries stored = new SavedSparqlQueryStore(repository).get(userId);

    assertEquals(library, stored);
  }

  private static SavedSparqlQuery query(final UUID id) {
    return new SavedSparqlQuery()
        .withId(id)
        .withName("My query")
        .withQuery("SELECT ?s WHERE { ?s ?p ?o }")
        .withFormat(SavedSparqlQuery.Format.JSON)
        .withInference(SavedSparqlQuery.Inference.NONE)
        .withSavedAt(123L);
  }
}
