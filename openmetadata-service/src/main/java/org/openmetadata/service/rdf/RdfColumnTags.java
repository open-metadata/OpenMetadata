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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import org.apache.jena.query.QueryExecution;
import org.apache.jena.query.QueryExecutionFactory;
import org.apache.jena.query.ResultSet;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.ResultSetMgr;
import org.apache.jena.riot.resultset.ResultSetLang;

/** The tags by column IRI, including untagged and nested columns. */
final class RdfColumnTags {
  static final String RESULTS_FORMAT = "application/sparql-results+json";
  private static final String PREFIX =
      "PREFIX om: <%s>\n".formatted(OntologyRdfVocabulary.NAMESPACE);
  private static final String PATTERN =
      """
      <%s> om:hasColumn/om:hasChildColumn* ?column .
      OPTIONAL { ?column om:hasTag ?tag }
      """;

  private RdfColumnTags() {}

  /** Selects the columns and tags the store holds for {@code tableUri}. */
  static String storedQuery(final String graph, final String tableUri) {
    return PREFIX
        + "SELECT ?column ?tag WHERE { GRAPH <"
        + graph
        + "> { "
        + PATTERN.formatted(tableUri)
        + " } }";
  }

  static Map<String, Set<RDFNode>> read(final String sparqlResultsJson) {
    return sparqlResultsJson == null
        ? Map.of()
        : tagsByColumn(
            ResultSetMgr.read(
                new ByteArrayInputStream(sparqlResultsJson.getBytes(StandardCharsets.UTF_8)),
                ResultSetLang.RS_JSON));
  }

  static Map<String, Set<RDFNode>> of(final Model projection, final String tableUri) {
    final String query =
        PREFIX + "SELECT ?column ?tag WHERE { " + PATTERN.formatted(tableUri) + " }";
    try (QueryExecution execution = QueryExecutionFactory.create(query, projection)) {
      return tagsByColumn(execution.execSelect());
    }
  }

  private static Map<String, Set<RDFNode>> tagsByColumn(final ResultSet results) {
    final Map<String, Set<RDFNode>> tagsByColumn = new HashMap<>();
    results.forEachRemaining(
        row -> {
          final Set<RDFNode> tags =
              tagsByColumn.computeIfAbsent(
                  row.getResource("column").getURI(), key -> new HashSet<>());
          final RDFNode tag = row.get("tag");
          if (tag != null) {
            tags.add(tag);
          }
        });
    return tagsByColumn;
  }
}
