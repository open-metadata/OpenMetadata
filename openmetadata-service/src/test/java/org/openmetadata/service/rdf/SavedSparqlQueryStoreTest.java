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
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SavedSparqlQuery;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.CollectionDAO;

class SavedSparqlQueryStoreTest {

  @Test
  void returnsAnEmptyLibraryWhenTheUserHasNoQueries() {
    CollectionDAO.EntityExtensionDAO dao = mock(CollectionDAO.EntityExtensionDAO.class);
    UUID userId = UUID.randomUUID();
    when(dao.getExtension(userId, SavedSparqlQueryStore.EXTENSION)).thenReturn(null);

    SavedSparqlQueries result = new SavedSparqlQueryStore(dao).get(userId);

    assertEquals(List.of(), result.getQueries());
  }

  @Test
  void storesTheLibraryOnlyUnderTheOwningUserId() {
    CollectionDAO.EntityExtensionDAO dao = mock(CollectionDAO.EntityExtensionDAO.class);
    UUID userId = UUID.randomUUID();
    SavedSparqlQuery query =
        new SavedSparqlQuery()
            .withId(UUID.randomUUID())
            .withName("My query")
            .withQuery("SELECT ?s WHERE { ?s ?p ?o }")
            .withFormat(SavedSparqlQuery.Format.JSON)
            .withInference(SavedSparqlQuery.Inference.NONE)
            .withSavedAt(123L);
    SavedSparqlQueries library = new SavedSparqlQueries().withQueries(List.of(query));
    ArgumentCaptor<String> json = ArgumentCaptor.forClass(String.class);

    new SavedSparqlQueryStore(dao).save(userId, library);

    verify(dao)
        .insert(
            eq(userId),
            eq(SavedSparqlQueryStore.EXTENSION),
            eq(SavedSparqlQueryStore.JSON_SCHEMA),
            json.capture());
    SavedSparqlQueries stored = JsonUtils.readValue(json.getValue(), SavedSparqlQueries.class);
    assertEquals(library, stored);
  }
}
