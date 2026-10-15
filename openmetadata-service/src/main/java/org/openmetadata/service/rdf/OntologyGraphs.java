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
import java.util.Collection;
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

  private static final String MEMBERS_PATH = "graph/ontology/members";
  private static final String ACTIVATIONS_PATH = "graph/ontology/activations";
  private static final String MANIFEST_PATH = "graph/manifest/";
  private static final String MANIFEST_STAGING_PATH = "graph/manifestStaging/";

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

  /** The prefix shared by the graphs of every entity of a type that owns one. */
  public static String graphPrefix(final String baseUri, final String entityType) {
    return baseUri + GRAPH_PATHS.get(entityType);
  }

  /** The control graph holding one {@link OntologyGraphMember} record per ontology graph. */
  public static String membersGraph(final String baseUri) {
    return baseUri + MEMBERS_PATH;
  }

  /** The control graph naming each glossary's active version manifest. */
  public static String activationsGraph(final String baseUri) {
    return baseUri + ACTIVATIONS_PATH;
  }

  /** The prefix of every version manifest graph, which ends in its closure digest's hex. */
  public static String manifestGraphPrefix(final String baseUri) {
    return baseUri + MANIFEST_PATH;
  }

  static String manifestStagingGraph(final String baseUri, final UUID id) {
    return baseUri + MANIFEST_STAGING_PATH + id;
  }

  /**
   * A graph to replace: its new content, and the member record to store beside it, or null to
   * remove the record because the owner is deleted.
   */
  record Replacement(Model content, OntologyGraphMember member) {}

  /**
   * Updates that replace each graph with its content, an empty model dropping the graph, and its
   * member record in {@code membersGraph} with the given one. Graphs are packed into as few updates
   * as fit {@code maxBytes}; a graph larger than that is sent alone. Each update is one Fuseki
   * transaction, so a graph is never seen half-replaced or with another graph's digest.
   */
  static List<String> replaceUpdates(
      final String baseUri, final Map<String, Replacement> graphs, final long maxBytes) {
    final List<String> updates = new ArrayList<>();
    Map<String, Serialized> chunk = new LinkedHashMap<>();
    long chunkBytes = 0;
    for (final Map.Entry<String, Replacement> graph : graphs.entrySet()) {
      final Serialized serialized = serialize(graph.getValue());
      final long bytes =
          Utf8.encodedLength(serialized.content())
              + Utf8.encodedLength(serialized.member())
              + Utf8.encodedLength(graph.getKey()) * 4L;
      if (!chunk.isEmpty() && chunkBytes + bytes > maxBytes) {
        updates.add(replaceUpdate(membersGraph(baseUri), chunk));
        chunk = new LinkedHashMap<>();
        chunkBytes = 0;
      }
      chunk.put(graph.getKey(), serialized);
      chunkBytes += bytes;
    }
    if (!chunk.isEmpty()) {
      updates.add(replaceUpdate(membersGraph(baseUri), chunk));
    }
    return updates;
  }

  static String dropUpdate(final String graph) {
    return "DROP SILENT GRAPH <" + graph + ">";
  }

  /** Removes the member records of these graphs; one pattern operation for all of them. */
  static String deleteMembersUpdate(final String membersGraph, final Collection<String> graphs) {
    final StringBuilder values = new StringBuilder();
    graphs.forEach(graph -> values.append('<').append(graph).append("> "));
    return String.format(
        "DELETE { GRAPH <%1$s> { ?g ?p ?o } } WHERE { VALUES ?g { %2$s} GRAPH <%1$s> { ?g ?p ?o } }",
        membersGraph, values);
  }

  private record Serialized(String content, String member) {}

  private static Serialized serialize(final Replacement replacement) {
    return new Serialized(
        triples(replacement.content()),
        replacement.member() == null ? "" : triples(replacement.member().toModel()));
  }

  /**
   * One update for the whole chunk. Every insert goes in a single INSERT DATA operation, because
   * SPARQL scopes blank node labels to an operation and each model's labels are distinct. The
   * member records are removed by one pattern operation: Fuseki rejects a request with two.
   */
  private static String replaceUpdate(
      final String membersGraph, final Map<String, Serialized> chunk) {
    final StringBuilder update = new StringBuilder();
    final StringBuilder inserts = new StringBuilder();
    final StringBuilder members = new StringBuilder();
    chunk.forEach(
        (graph, serialized) -> {
          update.append(dropUpdate(graph)).append(" ;\n");
          if (!serialized.content().isEmpty()) {
            inserts
                .append("GRAPH <")
                .append(graph)
                .append("> {\n")
                .append(serialized.content())
                .append("}\n");
          }
          members.append(serialized.member());
        });
    update.append(deleteMembersUpdate(membersGraph, chunk.keySet()));
    if (!members.isEmpty()) {
      inserts.append("GRAPH <").append(membersGraph).append("> {\n").append(members).append("}\n");
    }
    if (!inserts.isEmpty()) {
      update.append(" ;\nINSERT DATA {\n").append(inserts).append('}');
    }
    return update.toString();
  }

  /** N-Triples whose blank node labels come from the node's own identity, unique across models. */
  static String triples(final Model model) {
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
