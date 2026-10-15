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

import com.google.common.base.Utf8;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.out.NodeFmtLib;
import org.openmetadata.service.Entity;

/**
 * The named graphs that own the OWL view of ontology entities, one per entity: {@code
 * graph/axiom/{id}}, {@code graph/relationshipType/{id}} and {@code graph/glossaryTerm/{id}} under
 * the RDF base URI. A graph is replaced whole, by dropping it and inserting its new triples in one
 * SPARQL update, so restriction blank nodes and RDF lists never outlive the axiom that made them.
 *
 * <p>See ADR:2026-10-14-ontology-entities-own-their-named-graphs.
 */
public final class OntologyGraphs {
  private static final Map<String, String> GRAPH_PATHS =
      Map.of(
          Entity.ONTOLOGY_AXIOM, "graph/axiom/",
          Entity.RELATIONSHIP_TYPE, "graph/relationshipType/",
          Entity.GLOSSARY_TERM, "graph/glossaryTerm/");

  private OntologyGraphs() {}

  public static boolean ownsGraph(final String entityType) {
    return GRAPH_PATHS.containsKey(entityType);
  }

  /** The graph an entity owns, or empty for an entity type that owns none. */
  public static Optional<String> graphIri(
      final String baseUri, final String entityType, final UUID entityId) {
    return Optional.ofNullable(GRAPH_PATHS.get(entityType)).map(path -> baseUri + path + entityId);
  }

  /** The prefix shared by every term's graph. */
  public static String glossaryTermGraphPrefix(final String baseUri) {
    return baseUri + GRAPH_PATHS.get(Entity.GLOSSARY_TERM);
  }

  /**
   * Updates that replace each graph with its model, an empty model dropping the graph. Graphs are
   * packed into as few updates as fit {@code maxBytes}; a graph larger than that is sent alone.
   * Each update is one Fuseki transaction, so a graph is never seen half-replaced.
   */
  static List<String> replaceUpdates(final Map<String, Model> graphs, final long maxBytes) {
    final List<String> updates = new ArrayList<>();
    Map<String, String> chunk = new LinkedHashMap<>();
    long chunkBytes = 0;
    for (final Map.Entry<String, Model> graph : graphs.entrySet()) {
      final String triples = triples(graph.getValue());
      final long bytes = Utf8.encodedLength(triples) + Utf8.encodedLength(graph.getKey()) * 2L;
      if (!chunk.isEmpty() && chunkBytes + bytes > maxBytes) {
        updates.add(replaceUpdate(chunk));
        chunk = new LinkedHashMap<>();
        chunkBytes = 0;
      }
      chunk.put(graph.getKey(), triples);
      chunkBytes += bytes;
    }
    if (!chunk.isEmpty()) {
      updates.add(replaceUpdate(chunk));
    }
    return updates;
  }

  static String dropUpdate(final String graph) {
    return "DROP SILENT GRAPH <" + graph + ">";
  }

  /**
   * One update for the whole chunk. Every insert goes in a single INSERT DATA operation, because
   * SPARQL scopes blank node labels to an operation and each model's labels are distinct.
   */
  private static String replaceUpdate(final Map<String, String> chunk) {
    final StringBuilder update = new StringBuilder();
    final StringBuilder inserts = new StringBuilder();
    chunk.forEach(
        (graph, triples) -> {
          update.append(dropUpdate(graph)).append(" ;\n");
          if (!triples.isEmpty()) {
            inserts.append("GRAPH <").append(graph).append("> {\n").append(triples).append("}\n");
          }
        });
    if (inserts.isEmpty()) {
      update.setLength(update.length() - " ;\n".length());
    } else {
      update.append("INSERT DATA {\n").append(inserts).append('}');
    }
    return update.toString();
  }

  /** N-Triples whose blank node labels come from the node's own identity, unique across models. */
  private static String triples(final Model model) {
    final StringBuilder triples = new StringBuilder();
    model
        .getGraph()
        .find()
        .forEachRemaining(
            (Triple triple) ->
                triples
                    .append(NodeFmtLib.strNT(triple.getSubject()))
                    .append(' ')
                    .append(NodeFmtLib.strNT(triple.getPredicate()))
                    .append(' ')
                    .append(NodeFmtLib.strNT(triple.getObject()))
                    .append(" .\n"));
    return triples.toString();
  }
}
