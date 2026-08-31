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
import java.time.Clock;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entities.docStore.Document;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.jdbi3.DocumentRepository;

final class OpenMetadataSavedSparqlQueryDocumentRepository
    implements SavedSparqlQueryDocumentRepository {
  private final Clock clock;
  private final DocumentRepository repository;

  OpenMetadataSavedSparqlQueryDocumentRepository(final DocumentRepository repository) {
    this(repository, Clock.systemUTC());
  }

  OpenMetadataSavedSparqlQueryDocumentRepository(
      final DocumentRepository repository, final Clock clock) {
    this.repository = Objects.requireNonNull(repository);
    this.clock = Objects.requireNonNull(clock);
  }

  @Override
  public Document findByFqn(final String fullyQualifiedName) {
    return repository.findByNameOrNull(fullyQualifiedName, Include.ALL);
  }

  @Override
  public Document save(
      final UriInfo uriInfo,
      final Document current,
      final Document updated,
      final String userName) {
    final Document persisted;
    if (current == null) {
      updated.setId(UUID.randomUUID());
      updated.setUpdatedAt(clock.millis());
      persisted = repository.create(uriInfo, updated, userName, null);
    } else {
      updated.setId(current.getId());
      updated.setVersion(current.getVersion());
      repository.prepareInternal(updated, true);
      persisted = repository.createOrUpdate(uriInfo, updated, userName).getEntity();
    }
    return persisted;
  }
}
