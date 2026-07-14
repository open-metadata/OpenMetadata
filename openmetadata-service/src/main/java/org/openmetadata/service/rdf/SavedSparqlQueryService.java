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

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.openmetadata.schema.api.rdf.SavedSparqlQueries;
import org.openmetadata.schema.api.rdf.SavedSparqlQuery;

/** Manages a user's private saved-query library. */
public final class SavedSparqlQueryService {

  private static final int MAX_QUERIES = 100;
  private static final int MAX_NAME_LENGTH = 256;
  private static final int MAX_QUERY_LENGTH = 100_000;
  private final SavedSparqlQueryStore store;

  public SavedSparqlQueryService(SavedSparqlQueryStore store) {
    this.store = Objects.requireNonNull(store);
  }

  public SavedSparqlQueries get(UUID userId) {
    return store.get(userId);
  }

  public SavedSparqlQueries replace(UUID userId, SavedSparqlQueries requestedLibrary) {
    return store.save(userId, normalize(requestedLibrary));
  }

  static SavedSparqlQueries normalize(SavedSparqlQueries requestedLibrary) {
    if (requestedLibrary == null || requestedLibrary.getQueries() == null) {
      throw new IllegalArgumentException("Saved SPARQL queries are required");
    }
    List<SavedSparqlQuery> queries = requestedLibrary.getQueries();
    if (queries.size() > MAX_QUERIES) {
      throw new IllegalArgumentException("At most 100 saved SPARQL queries are allowed");
    }

    Set<UUID> identifiers = new HashSet<>();
    List<SavedSparqlQuery> normalizedQueries =
        queries.stream().map(query -> normalizeQuery(query, identifiers)).toList();
    return new SavedSparqlQueries().withQueries(normalizedQueries);
  }

  private static SavedSparqlQuery normalizeQuery(SavedSparqlQuery query, Set<UUID> identifiers) {
    if (query == null || query.getId() == null || !identifiers.add(query.getId())) {
      throw new IllegalArgumentException("Saved SPARQL query IDs must be present and unique");
    }
    String name = normalizedText(query.getName());
    if (nullOrEmpty(name) || name.length() > MAX_NAME_LENGTH) {
      throw new IllegalArgumentException(
          "Saved SPARQL query names must contain 1 to 256 characters");
    }
    String body = normalizedText(query.getQuery());
    if (nullOrEmpty(body) || body.length() > MAX_QUERY_LENGTH) {
      throw new IllegalArgumentException(
          "Saved SPARQL query bodies must contain 1 to 100000 characters");
    }
    if (query.getFormat() == null
        || query.getInference() == null
        || query.getSavedAt() == null
        || query.getSavedAt() < 0) {
      throw new IllegalArgumentException("Saved SPARQL query metadata is incomplete");
    }

    return new SavedSparqlQuery()
        .withId(query.getId())
        .withName(name)
        .withQuery(body)
        .withFormat(query.getFormat())
        .withInference(query.getInference())
        .withSavedAt(query.getSavedAt());
  }

  private static String normalizedText(String value) {
    return value == null ? null : value.trim();
  }
}
