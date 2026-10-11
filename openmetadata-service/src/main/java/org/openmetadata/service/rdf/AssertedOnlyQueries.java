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

import com.github.benmanes.caffeine.cache.Caffeine;
import com.github.benmanes.caffeine.cache.LoadingCache;
import java.time.Duration;
import java.util.List;
import java.util.function.Supplier;
import org.apache.jena.query.Query;
import org.apache.jena.query.QueryFactory;
import org.apache.jena.query.Syntax;

/**
 * Restricts read queries to asserted data. Materialized inference is stored in named graphs under
 * the inferred-graph prefix, and Fuseki's union default graph includes every named graph, so a
 * query that must not see inferred triples names every other graph as its dataset: FROM for the
 * default graph, which Jena evaluates as their set union like the union default graph, and FROM
 * NAMED so that GRAPH patterns cannot reach the inferred graphs either.
 *
 * <p>Asserted graphs are not a closed set, since SPARQL updates and loaders may create any graph,
 * so the list is read from the store. It is refreshed in the background, so queries never wait on
 * the listing; a graph created since is left out until the next refresh, while a new inferred
 * graph is never let in.
 */
final class AssertedOnlyQueries {
  static final Duration GRAPH_LIST_TTL = Duration.ofMinutes(2);

  /** Names no graph, so a store without asserted graphs answers from an empty dataset. */
  static final String NO_ASSERTED_GRAPH = "urn:openmetadata:rdf:no-asserted-graph";

  private static final String GRAPH_LIST_KEY = "assertedGraphs";

  private final Supplier<List<String>> graphLister;
  private final Supplier<String> inferredGraphPrefix;
  private final LoadingCache<String, List<String>> assertedGraphs;

  AssertedOnlyQueries(
      final Supplier<List<String>> graphLister,
      final Supplier<String> inferredGraphPrefix,
      final Duration graphListTtl) {
    this.graphLister = graphLister;
    this.inferredGraphPrefix = inferredGraphPrefix;
    this.assertedGraphs =
        Caffeine.newBuilder()
            .maximumSize(1)
            .refreshAfterWrite(graphListTtl)
            .build(ignored -> listAssertedGraphs());
  }

  /** The query over asserted graphs only, or unchanged when it already declares its dataset. */
  String restrict(final String sparql) {
    final Query query = QueryFactory.create(sparql, Syntax.syntaxARQ);
    return query.hasDatasetDescription()
        ? sparql
        : withDataset(query, assertedGraphs.get(GRAPH_LIST_KEY)).serialize();
  }

  static Query withDataset(final Query query, final List<String> graphs) {
    final List<String> dataset = graphs.isEmpty() ? List.of(NO_ASSERTED_GRAPH) : graphs;
    dataset.forEach(query::addGraphURI);
    dataset.forEach(query::addNamedGraphURI);
    return query;
  }

  private List<String> listAssertedGraphs() {
    final String prefix = inferredGraphPrefix.get();
    return graphLister.get().stream().filter(graph -> !graph.startsWith(prefix)).sorted().toList();
  }
}
