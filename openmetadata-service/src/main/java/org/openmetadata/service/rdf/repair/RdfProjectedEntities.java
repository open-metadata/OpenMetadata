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
package org.openmetadata.service.rdf.repair;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.OptionalLong;
import java.util.Set;
import java.util.function.Supplier;
import java.util.function.UnaryOperator;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * What the RDF store holds for the entities it projects. An entity's own projection, and only it,
 * writes {@code dct:modified} from the row's {@code updatedAt}; other entities that reference it
 * add a type and a label to its IRI, which prove nothing. So an entity counts as projected, and
 * as current, by its {@code dct:modified}. Entity IRIs are {@code <base>entity/<type>/<id>}.
 */
@Slf4j
public class RdfProjectedEntities {
  static final String MODIFIED = "http://purl.org/dc/terms/modified";
  private static final String SUBJECT = "s";

  private final UnaryOperator<String> select;
  private final Supplier<String> baseUri;

  /**
   * @param select runs a SPARQL SELECT and returns its JSON results; it throws when the query fails
   * @param baseUri the RDF base URI entity IRIs start with
   */
  public RdfProjectedEntities(final UnaryOperator<String> select, final Supplier<String> baseUri) {
    this.select = select;
    this.baseUri = baseUri;
  }

  /**
   * When the projections of {@code ids} say their rows last changed. An id with no projection is
   * absent. Projections carry the time in two forms, epoch milliseconds and an ISO instant, so an
   * id can map to both.
   */
  public Map<String, Set<Long>> modifiedTimes(final String entityType, final List<String> ids) {
    final String values =
        ids.stream()
            .map(id -> "<" + entityIri(entityType, id) + ">")
            .collect(Collectors.joining(" "));
    final String query =
        "SELECT ?s ?modified WHERE { VALUES ?s { "
            + values
            + " } ?s <"
            + MODIFIED
            + "> ?modified }";
    final Map<String, Set<Long>> modified = new HashMap<>();
    for (final JsonNode binding : bindings(query)) {
      final OptionalLong millis = epochMillis(binding.path("modified").path("value").asText());
      if (millis.isPresent()) {
        modified
            .computeIfAbsent(idOf(entityType, subject(binding)), ignored -> new HashSet<>())
            .add(millis.getAsLong());
      }
    }
    return modified;
  }

  /** How many entities of each type the store holds projections of, counted in one scan. */
  public Map<String, Long> counts() {
    final String entityRoot = baseUri.get() + "entity/";
    final String query =
        "SELECT ?type (COUNT(DISTINCT ?s) AS ?n) WHERE { ?s <"
            + MODIFIED
            + "> ?m . FILTER(STRSTARTS(STR(?s), \""
            + entityRoot
            + "\")) BIND(STRAFTER(STR(?s), \""
            + entityRoot
            + "\") AS ?rest) BIND(STRBEFORE(?rest, \"/\") AS ?type)"
            + " FILTER(?type != \"\" && !CONTAINS(STRAFTER(?rest, \"/\"), \"/\")) } GROUP BY ?type";
    final Map<String, Long> counts = new HashMap<>();
    for (final JsonNode binding : bindings(query)) {
      counts.put(
          binding.path("type").path("value").asText(), binding.path("n").path("value").asLong());
    }
    return counts;
  }

  /** The ids of {@code entityType}'s projected entities that start with {@code idPrefix}. */
  public List<String> ids(final String entityType, final String idPrefix) {
    final String query =
        "SELECT DISTINCT ?s WHERE { ?s <"
            + MODIFIED
            + "> ?m . "
            + entityFilter(typePrefix(entityType), typePrefix(entityType) + idPrefix)
            + " }";
    final List<String> ids = new ArrayList<>();
    for (final JsonNode binding : bindings(query)) {
      ids.add(idOf(entityType, subject(binding)));
    }
    return ids;
  }

  /**
   * IRIs under {@code startsWith} that name an entity itself: nothing follows the id, so a
   * resource an entity owns under its IRI is not counted as an entity.
   */
  private static String entityFilter(final String typePrefix, final String startsWith) {
    return "FILTER(STRSTARTS(STR(?s), \""
        + startsWith
        + "\") && !CONTAINS(STRAFTER(STR(?s), \""
        + typePrefix
        + "\"), \"/\"))";
  }

  private List<JsonNode> bindings(final String query) {
    final List<JsonNode> rows = new ArrayList<>();
    JsonUtils.readTree(select.apply(query)).path("results").path("bindings").forEach(rows::add);
    return rows;
  }

  private static String subject(final JsonNode binding) {
    return binding.path(SUBJECT).path("value").asText();
  }

  private String typePrefix(final String entityType) {
    return baseUri.get() + "entity/" + entityType + "/";
  }

  private String entityIri(final String entityType, final String id) {
    return typePrefix(entityType) + id;
  }

  private String idOf(final String entityType, final String iri) {
    return iri.substring(typePrefix(entityType).length());
  }

  /** A projection's {@code dct:modified}: epoch milliseconds, or an ISO instant. */
  static OptionalLong epochMillis(final String modified) {
    OptionalLong millis = OptionalLong.empty();
    if (!modified.isEmpty() && modified.chars().allMatch(Character::isDigit)) {
      millis = OptionalLong.of(Long.parseLong(modified));
    } else {
      try {
        millis = OptionalLong.of(Instant.parse(modified).toEpochMilli());
      } catch (DateTimeParseException unreadable) {
        LOG.debug("RDF repair cannot read dct:modified '{}'; the row counts as stale", modified);
      }
    }
    return millis;
  }
}
