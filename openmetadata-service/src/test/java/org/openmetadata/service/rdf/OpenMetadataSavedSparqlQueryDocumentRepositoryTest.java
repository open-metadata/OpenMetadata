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
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.UriInfo;
import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.service.jdbi3.DocumentRepository;

class OpenMetadataSavedSparqlQueryDocumentRepositoryTest {
  private static final Instant NOW = Instant.parse("2026-07-18T12:00:00Z");

  @Test
  void assignsRequiredEntityMetadataWhenCreatingThePrivateDocument() {
    final DocumentRepository repository = mock(DocumentRepository.class);
    final UriInfo uriInfo = mock(UriInfo.class);
    final Document document = new Document().withName("owner");
    final OpenMetadataSavedSparqlQueryDocumentRepository documentRepository =
        new OpenMetadataSavedSparqlQueryDocumentRepository(
            repository, Clock.fixed(NOW, ZoneOffset.UTC));
    when(repository.create(uriInfo, document, "owner", null)).thenReturn(document);

    final Document persisted = documentRepository.save(uriInfo, null, document, "owner");

    assertNotNull(persisted.getId());
    assertEquals(NOW.toEpochMilli(), persisted.getUpdatedAt());
    verify(repository).create(uriInfo, document, "owner", null);
  }
}
