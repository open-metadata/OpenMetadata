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

import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.TreeSet;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.QuerySolution;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.ResultSetMgr;
import org.apache.jena.riot.resultset.ResultSetLang;

/** The tags on a table's columns, nested ones included, as "column tag" pairs. */
final class RdfColumnTags {
  static final String RESULTS_FORMAT = "application/sparql-results+json";
  private static final String PATTERN =
      "<%s> <https://open-metadata.org/ontology/hasColumn>/"
          + "<https://open-metadata.org/ontology/hasChildColumn>* ?column . "
          + "?column <https://open-metadata.org/ontology/hasTag> ?tag";

  private RdfColumnTags() {}

  /** Reads the pairs the store holds for {@code tableUri}. */
  static String storedQuery(final String graph, final String tableUri) {
    return "SELECT ?column ?tag WHERE { GRAPH <"
        + graph
        + "> { "
        + String.format(PATTERN, tableUri)
        + " } }";
  }

  /** No results, as from a store that answered nothing, read as no tags. */
  static Set<String> read(final String sparqlResultsJson) {
    return sparqlResultsJson == null ? Set.of() : parse(sparqlResultsJson);
  }

  private static Set<String> parse(final String sparqlResultsJson) {
    return pairs(
        ResultSetMgr.read(
            new ByteArrayInputStream(sparqlResultsJson.getBytes(StandardCharsets.UTF_8)),
            ResultSetLang.RS_JSON));
  }

  /** The pairs {@code projection}, a table's own projection, writes. */
  static Set<String> of(final Model projection, final String tableUri) {
    final String query = "SELECT ?column ?tag WHERE { " + String.format(PATTERN, tableUri) + " }";
    try (QueryExecution execution = QueryExecutionFactory.create(query, projection)) {
      return pairs(execution.execSelect());
    }
  }

  private static Set<String> pairs(final ResultSet results) {
    final Set<String> pairs = new TreeSet<>();
    results.forEachRemaining(row -> pairs.add(pair(row)));
    return pairs;
  }

  private static String pair(final QuerySolution row) {
    return row.getResource("column").getURI() + " " + row.get("tag").toString();
  }
}
