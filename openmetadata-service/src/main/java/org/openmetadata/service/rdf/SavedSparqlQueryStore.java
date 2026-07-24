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

import jakarta.ws.rs.core.UriInfo;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.service.jdbi3.DocumentRepository;

public final class SavedSparqlQueryStore {
  private final SavedSparqlQueryDocumentRepository repository;
  private final SavedSparqlQueryDocumentCodec codec;

  public SavedSparqlQueryStore(final DocumentRepository repository) {
    this(new OpenMetadataSavedSparqlQueryDocumentRepository(repository));
  }

  SavedSparqlQueryStore(final SavedSparqlQueryDocumentRepository repository) {
    this.repository = Objects.requireNonNull(repository);
    codec = new SavedSparqlQueryDocumentCodec();
  }

  public SavedSparqlQueries get(final UUID userId) {
    final String documentFqn = codec.documentFqn(Objects.requireNonNull(userId));
    final Document document = repository.findByFqn(documentFqn);
    final SavedSparqlQueries savedQueries =
        document == null ? emptyLibrary() : codec.decode(document);
    return savedQueries;
  }

  public SavedSparqlQueries save(
      final UriInfo uriInfo,
      final UUID userId,
      final String userName,
      final SavedSparqlQueries savedQueries) {
    final String documentFqn = codec.documentFqn(Objects.requireNonNull(userId));
    final Document current = repository.findByFqn(documentFqn);
    final Document updated = codec.encode(userId, Objects.requireNonNull(savedQueries));
    final Document persisted =
        repository.save(uriInfo, current, updated, Objects.requireNonNull(userName));
    return codec.decode(persisted);
  }

  private static SavedSparqlQueries emptyLibrary() {
    return new SavedSparqlQueries().withQueries(List.of());
  }
}
