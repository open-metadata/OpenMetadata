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

package org.openmetadata.service.ontology;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.out.NodeFmtLib;

public final class RdfBlankNodeCanonicalizer {
  private static final int HASH_REFINEMENT_ROUNDS = 16;
  private static final String SKOLEM_PREFIX = "urn:openmetadata:annex:";

  public String canonicalize(final Model model) {
    final List<Triple> triples = model.getGraph().find().toList();
    final Set<Node> blankNodes = collectBlankNodes(triples);
    final Map<Node, String> hashes = refineHashes(triples, blankNodes);
    final Map<Node, Node> skolemNodes = createSkolemNodes(blankNodes, hashes);
    final List<String> lines =
        triples.stream().map(triple -> format(triple, skolemNodes)).sorted().toList();
    return String.join("\n", lines) + (lines.isEmpty() ? "" : "\n");
  }

  public String checksum(final String canonicalNQuads) {
    return digest(canonicalNQuads);
  }

  private static Set<Node> collectBlankNodes(final List<Triple> triples) {
    final Set<Node> blankNodes = new LinkedHashSet<>();
    for (final Triple triple : triples) {
      addBlank(blankNodes, triple.getSubject());
      addBlank(blankNodes, triple.getObject());
    }
    return blankNodes;
  }

  private static void addBlank(final Set<Node> blankNodes, final Node node) {
    if (node.isBlank()) {
      blankNodes.add(node);
    }
  }

  private static Map<Node, String> refineHashes(
      final List<Triple> triples, final Set<Node> blankNodes) {
    Map<Node, String> hashes = initialHashes(triples, blankNodes);
    for (int round = 0; round < HASH_REFINEMENT_ROUNDS; round++) {
      final Map<Node, String> refined = refinedHashes(triples, blankNodes, hashes);
      if (refined.equals(hashes)) {
        break;
      }
      hashes = refined;
    }
    return hashes;
  }

  private static Map<Node, String> initialHashes(
      final List<Triple> triples, final Set<Node> blankNodes) {
    final Map<Node, String> hashes = new LinkedHashMap<>();
    for (final Node blankNode : blankNodes) {
      hashes.put(blankNode, digest(signature(blankNode, triples, Map.of())));
    }
    return hashes;
  }

  private static Map<Node, String> refinedHashes(
      final List<Triple> triples,
      final Set<Node> blankNodes,
      final Map<Node, String> previousHashes) {
    final Map<Node, String> hashes = new LinkedHashMap<>();
    for (final Node blankNode : blankNodes) {
      hashes.put(blankNode, digest(signature(blankNode, triples, previousHashes)));
    }
    return hashes;
  }

  private static String signature(
      final Node blankNode, final List<Triple> triples, final Map<Node, String> neighborHashes) {
    final List<String> incident = new ArrayList<>();
    for (final Triple triple : triples) {
      if (triple.getSubject().equals(blankNode) || triple.getObject().equals(blankNode)) {
        incident.add(signature(blankNode, triple, neighborHashes));
      }
    }
    incident.sort(String::compareTo);
    return String.join("|", incident);
  }

  private static String signature(
      final Node blankNode, final Triple triple, final Map<Node, String> neighborHashes) {
    return signatureNode(blankNode, triple.getSubject(), neighborHashes)
        + ' '
        + NodeFmtLib.strNT(triple.getPredicate())
        + ' '
        + signatureNode(blankNode, triple.getObject(), neighborHashes);
  }

  private static String signatureNode(
      final Node blankNode, final Node node, final Map<Node, String> neighborHashes) {
    final String value;
    if (node.equals(blankNode)) {
      value = "_:self";
    } else if (node.isBlank()) {
      value = "_:" + neighborHashes.getOrDefault(node, "blank");
    } else {
      value = NodeFmtLib.strNT(node);
    }
    return value;
  }

  private static Map<Node, Node> createSkolemNodes(
      final Set<Node> blankNodes, final Map<Node, String> hashes) {
    final List<Node> ordered =
        blankNodes.stream()
            .sorted(
                Comparator.<Node, String>comparing(hashes::get)
                    .thenComparing(node -> node.getBlankNodeLabel()))
            .toList();
    final Map<Node, Node> skolemNodes = new HashMap<>();
    for (int index = 0; index < ordered.size(); index++) {
      final Node blankNode = ordered.get(index);
      final String skolemIri = SKOLEM_PREFIX + digest(hashes.get(blankNode) + ':' + index);
      skolemNodes.put(blankNode, NodeFactory.createURI(skolemIri));
    }
    return skolemNodes;
  }

  private static String format(final Triple triple, final Map<Node, Node> skolemNodes) {
    return NodeFmtLib.strNT(replace(triple.getSubject(), skolemNodes))
        + ' '
        + NodeFmtLib.strNT(triple.getPredicate())
        + ' '
        + NodeFmtLib.strNT(replace(triple.getObject(), skolemNodes))
        + " .";
  }

  private static Node replace(final Node node, final Map<Node, Node> skolemNodes) {
    return node.isBlank() ? skolemNodes.get(node) : node;
  }

  private static String digest(final String value) {
    try {
      final MessageDigest digest = MessageDigest.getInstance("SHA-256");
      return HexFormat.of().formatHex(digest.digest(value.getBytes(StandardCharsets.UTF_8)));
    } catch (NoSuchAlgorithmException exception) {
      throw new IllegalStateException(
          "SHA-256 is required for ontology canonicalization", exception);
    }
  }
}
