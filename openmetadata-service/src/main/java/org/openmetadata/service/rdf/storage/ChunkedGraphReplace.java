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
package org.openmetadata.service.rdf.storage;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;

/**
 * Replaces a whole named graph without sending any request larger than a chunk. A graph that fits
 * one chunk is one Graph Store PUT. A larger one is PUT into staging graphs named for this attempt
 * and copied into place by one SPARQL update, which Fuseki applies in one transaction: a reader of
 * the graph sees the old content or the new, and a failure before the swap leaves the graph as it
 * was. Each attempt first drops every staging graph an earlier attempt at the same graph left.
 * See ADR:2026-10-15-fuseki-holds-only-the-active-ontology-release.
 */
public final class ChunkedGraphReplace {
  /** The Fuseki extension's default upload limit (OPENMETADATA_MAX_UPLOAD_BYTES). */
  public static final int MAX_REQUEST_BYTES = 64 * 1024 * 1024;

  public static final int DEFAULT_CHUNK_BYTES = 16 * 1024 * 1024;

  /** Outside the ontology graph prefix, so rebuilds and asserted-only reads never take a staging graph. */
  public static final String STAGING_PREFIX = "https://open-metadata.org/graph/staging/";

  /** The requests a replace sends; the storage adds its own timeouts and retries. */
  public interface GraphStore {
    void put(String graph, Model content);

    void update(String sparqlUpdate);

    List<String> graphs();
  }

  private final GraphStore store;
  private final long chunkBytes;

  public ChunkedGraphReplace(final GraphStore store, final long chunkBytes) {
    if (chunkBytes <= 0 || chunkBytes > MAX_REQUEST_BYTES) {
      throw new IllegalArgumentException("A graph chunk must be between 1 byte and 64 MiB");
    }
    this.store = store;
    this.chunkBytes = chunkBytes;
  }

  public void replace(final String graph, final Model model) {
    final List<Model> chunks = chunks(model, chunkBytes);
    try {
      dropStaging(graph);
      if (chunks.size() == 1) {
        store.put(graph, chunks.getFirst());
      } else {
        final String attempt = stagingBase(graph) + UUID.randomUUID().toString().replace("-", "");
        final List<String> staged = new ArrayList<>();
        for (int index = 0; index < chunks.size(); index++) {
          staged.add(attempt + "/" + index);
          store.put(staged.getLast(), chunks.get(index));
        }
        store.update(swap(graph, staged));
      }
    } finally {
      chunks.forEach(Model::close);
    }
  }

  /**
   * Groups the triples so that every blank node stays in one chunk. RDF-Thrift keeps blank node
   * labels across requests, but a chunk that holds a whole structure stays well-formed on its own,
   * whatever format or parser carries it.
   */
  public static List<Model> chunks(final Model model, final long chunkBytes) {
    final List<Model> chunks = new ArrayList<>();
    Model current = ModelFactory.createDefaultModel();
    long currentBytes = 0;
    for (final List<Triple> unit : units(model)) {
      final long unitBytes = unit.stream().mapToLong(ChunkedGraphReplace::encodedBytes).sum();
      if (unitBytes > MAX_REQUEST_BYTES) {
        current.close();
        chunks.forEach(Model::close);
        throw new RdfPayloadTooLargeException("An RDF blank node structure exceeds 64 MiB");
      }
      if (currentBytes > 0 && currentBytes + unitBytes > chunkBytes) {
        chunks.add(current);
        current = ModelFactory.createDefaultModel();
        currentBytes = 0;
      }
      unit.forEach(current.getGraph()::add);
      currentBytes += unitBytes;
    }
    chunks.add(current);
    return chunks;
  }

  private void dropStaging(final String graph) {
    final String base = stagingBase(graph);
    final List<String> stale =
        store.graphs().stream().filter(name -> name.startsWith(base)).toList();
    if (!stale.isEmpty()) {
      store.update(
          String.join(
              " ;\n", stale.stream().map(name -> "DROP SILENT GRAPH <" + name + ">").toList()));
    }
  }

  /**
   * Copies the staged triples with INSERT WHERE, which collects every solution before it writes.
   * MOVE and ADD instead stream the source while inserting into the same TDB2 indexes, and in Jena
   * 6.2 that skips triples. Adding a staging graph to itself changes nothing but fails when the graph
   * is missing, because a newer attempt dropped it or this swap already committed, and the failure
   * aborts the whole request before the served graph changes.
   */
  private static String swap(final String graph, final List<String> staged) {
    final List<String> operations = new ArrayList<>();
    staged.forEach(name -> operations.add("ADD GRAPH <" + name + "> TO GRAPH <" + name + ">"));
    operations.add("DROP SILENT GRAPH <" + graph + ">");
    operations.add(
        "INSERT { GRAPH <"
            + graph
            + "> { ?s ?p ?o } } WHERE { VALUES ?staged { "
            + String.join(" ", staged.stream().map(name -> "<" + name + ">").toList())
            + " } GRAPH ?staged { ?s ?p ?o } }");
    staged.forEach(name -> operations.add("DROP SILENT GRAPH <" + name + ">"));
    return String.join(" ;\n", operations);
  }

  private static String stagingBase(final String graph) {
    try {
      final byte[] digest =
          MessageDigest.getInstance("SHA-256").digest(graph.getBytes(StandardCharsets.UTF_8));
      return STAGING_PREFIX + HexFormat.of().formatHex(digest, 0, 16) + "/";
    } catch (NoSuchAlgorithmException impossible) {
      throw new IllegalStateException(impossible);
    }
  }

  /** Triples without blank nodes stand alone; the rest are grouped by connected blank nodes. */
  private static List<List<Triple>> units(final Model model) {
    final BlankNodeComponents components = new BlankNodeComponents();
    model.getGraph().find().forEachRemaining(components::connect);
    final List<List<Triple>> units = new ArrayList<>();
    final Map<Node, List<Triple>> grouped = new LinkedHashMap<>();
    model
        .getGraph()
        .find()
        .forEachRemaining(
            triple -> {
              final Node blank = components.root(triple);
              if (blank == null) {
                units.add(List.of(triple));
              } else {
                grouped.computeIfAbsent(blank, ignored -> new ArrayList<>()).add(triple);
              }
            });
    units.addAll(grouped.values());
    return units;
  }

  /**
   * An upper bound of the triple's RDF-Thrift size: Thrift's compact protocol spends at most a
   * field header, a five-byte length and a stop byte on each string and term around its UTF-8 text.
   */
  static long encodedBytes(final Triple triple) {
    return 8
        + termBytes(triple.getSubject())
        + termBytes(triple.getPredicate())
        + termBytes(triple.getObject());
  }

  private static long termBytes(final Node node) {
    final long text =
        node.isLiteral()
            ? utf8(node.getLiteralLexicalForm())
                + utf8(node.getLiteralDatatypeURI())
                + utf8(node.getLiteralLanguage())
            : node.isBlank() ? utf8(node.getBlankNodeLabel()) : utf8(node.getURI());
    return text + 24;
  }

  private static long utf8(final String text) {
    return text == null ? 0 : text.getBytes(StandardCharsets.UTF_8).length;
  }

  /** Union-find over the blank nodes of one graph. */
  private static final class BlankNodeComponents {
    private final Map<Node, Node> parent = new HashMap<>();

    void connect(final Triple triple) {
      final Node subject = triple.getSubject();
      final Node object = triple.getObject();
      if (subject.isBlank()) {
        find(subject);
      }
      if (object.isBlank()) {
        find(object);
      }
      if (subject.isBlank() && object.isBlank()) {
        parent.put(find(subject), find(object));
      }
    }

    Node root(final Triple triple) {
      if (triple.getSubject().isBlank()) {
        return find(triple.getSubject());
      }
      return triple.getObject().isBlank() ? find(triple.getObject()) : null;
    }

    private Node find(final Node node) {
      Node root = parent.computeIfAbsent(node, self -> self);
      while (!root.equals(parent.get(root))) {
        root = parent.get(root);
      }
      Node walker = node;
      while (!walker.equals(root)) {
        final Node next = parent.get(walker);
        parent.put(walker, root);
        walker = next;
      }
      return root;
    }
  }
}
