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
import java.util.Collection;
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
 * so the list is read from the store. A write by this server that names a graph missing from the
 * list drops it, so the next query reads it again; a graph another server or a direct Fuseki
 * writer creates is picked up by the periodic background refresh. An empty list is never kept,
 * so a query before the first projection does not pin an empty dataset. A new inferred graph is
 * never let in.
 *
 * <p>See ADR:2026-10-11-asserted-only-rdf-reads-name-every-non-inferred-graph.
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
    if (query.hasDatasetDescription()) {
      return sparql;
    }
    final List<String> graphs = assertedGraphs.get(GRAPH_LIST_KEY);
    if (graphs.isEmpty()) {
      assertedGraphs.invalidate(GRAPH_LIST_KEY);
    }
    return withDataset(query, graphs).serialize();
  }

  /** Records graphs this server wrote; one missing from the list makes the next query relist. */
  void graphsWritten(final Collection<String> graphs) {
    final List<String> known = assertedGraphs.getIfPresent(GRAPH_LIST_KEY);
    if (known == null) {
      return;
    }
    final String prefix = inferredGraphPrefix.get();
    if (graphs.stream().anyMatch(graph -> !graph.startsWith(prefix) && !known.contains(graph))) {
      assertedGraphs.invalidate(GRAPH_LIST_KEY);
    }
  }

  /** Makes the next query relist the graphs, for a change whose graphs are not known. */
  void graphsChanged() {
    assertedGraphs.invalidate(GRAPH_LIST_KEY);
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
