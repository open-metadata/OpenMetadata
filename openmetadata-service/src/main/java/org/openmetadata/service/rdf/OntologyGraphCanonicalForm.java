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

import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.riot.out.NodeFmtLib;

/**
 * The canonical N-Triples of a graph, {@value #ALGORITHM}, from which {@link OntologyGraphDigest}
 * is computed. Nothing in it depends on how a store labels blank nodes, so OpenMetadata and the
 * store compute the same text for the same triples.
 *
 * <ol>
 *   <li><b>Colour refinement.</b> A blank node's colour starts as the SHA-256 of its incident
 *       triples, sorted, with itself written {@code _:self} and other blank nodes {@code _:}. Each
 *       round, a node's next colour is the SHA-256 of its colour, a newline, and its incident
 *       triples with each other blank node written {@code _:} plus that node's colour, sorted and
 *       joined by {@code |}. Rounds stop at the first that does not raise the number of distinct
 *       colours; the colours before it are kept.
 *   <li><b>Distinguishing.</b> While two blank nodes share a colour, take the tied colour that sorts
 *       first; for each node with it, recolour that node SHA-256(colour + {@code *}), refine again,
 *       and continue. Of all the results, keep the text that sorts first. When the blank nodes and
 *       the triples joining them form a forest (no triple joins more than two blank nodes, none
 *       sits in a triple term, and the joins are acyclic), nodes that refinement cannot tell apart
 *       are interchangeable, so one node per tie is tried instead of each.
 *   <li><b>Text.</b> Once every colour differs, each blank node is written {@code _:b} plus its
 *       colour, every triple as one N-Triples line, lines sorted in Java string order, each ending
 *       in a newline.
 * </ol>
 *
 * <p>Distinguishing can need time exponential in the number of tied blank nodes, so the work is
 * bounded: at most {@value #MAX_SEARCH_STEPS} distinguishing steps and {@value #MAX_WORK} incident
 * triple visits. Past either, the graph is refused with {@link TooSymmetricException} rather than
 * given a digest that would depend on labels. OpenMetadata writes blank nodes only as the trees of
 * the OWL 2 RDF mapping, which refinement resolves, so this is reached only by hand-made input.
 *
 * <p>See ADR:2026-10-15-reasoning-closures-are-approved-graphs-pinned-by-a-content-manifest
 * (amendment v2). The store's {@code GraphDigest} implements the same steps.
 */
public final class OntologyGraphCanonicalForm {
  public static final String ALGORITHM = "om-graph-v2";
  static final int MAX_SEARCH_STEPS = 1024;
  static final long MAX_WORK = 10_000_000L;

  private static final HexFormat HEX = HexFormat.of();

  /** Blank nodes refinement cannot separate, too many to distinguish within the bounds. */
  public static final class TooSymmetricException extends RuntimeException {
    TooSymmetricException(final String message) {
      super(message);
    }
  }

  private final List<Triple> triples;
  private final Map<Node, List<Triple>> incident = new LinkedHashMap<>();
  private final boolean forest;
  private int steps;
  private long work;

  private OntologyGraphCanonicalForm(final Collection<Triple> triples) {
    this.triples = List.copyOf(triples);
    boolean acyclic = true;
    final Map<Node, Node> parent = new HashMap<>();
    final Set<Set<Node>> joins = new HashSet<>();
    for (final Triple triple : this.triples) {
      final Set<Node> blanks = new LinkedHashSet<>();
      final boolean nested = addBlanks(blanks, triple, false);
      for (final Node blank : blanks) {
        incident.computeIfAbsent(blank, node -> new ArrayList<>()).add(triple);
      }
      if (nested || blanks.size() > 2) {
        acyclic = false;
      } else if (blanks.size() == 2 && acyclic && joins.add(Set.copyOf(blanks))) {
        final List<Node> pair = List.copyOf(blanks);
        final Node first = root(parent, pair.get(0));
        final Node second = root(parent, pair.get(1));
        if (first.equals(second)) {
          acyclic = false;
        } else {
          parent.put(first, second);
        }
      }
    }
    this.forest = acyclic;
  }

  /** The canonical text: sorted N-Triples lines, each ending in a newline. */
  public static String of(final Collection<Triple> triples) {
    final OntologyGraphCanonicalForm form = new OntologyGraphCanonicalForm(triples);
    if (form.incident.isEmpty()) {
      return form.text(Map.of());
    }
    final Map<Node, String> initial = new HashMap<>();
    form.incident.forEach(
        (blank, around) -> initial.put(blank, sha256Hex(form.signatures(blank, around, null))));
    return form.search(initial);
  }

  private String search(final Map<Node, String> colours) {
    if (++steps > MAX_SEARCH_STEPS) {
      throw new TooSymmetricException(
          "Blank nodes that refinement cannot tell apart need more than "
              + MAX_SEARCH_STEPS
              + " distinguishing steps");
    }
    final Map<Node, String> stable = refine(colours);
    final List<Node> tied = firstTie(stable);
    if (tied.isEmpty()) {
      return text(stable);
    }
    String best = null;
    for (final Node node : forest ? tied.subList(0, 1) : tied) {
      final Map<Node, String> distinguished = new HashMap<>(stable);
      distinguished.put(node, sha256Hex(stable.get(node) + "*"));
      final String candidate = search(distinguished);
      if (best == null || candidate.compareTo(best) < 0) {
        best = candidate;
      }
    }
    return best;
  }

  private Map<Node, String> refine(final Map<Node, String> colours) {
    Map<Node, String> current = colours;
    int distinct = new HashSet<>(current.values()).size();
    while (true) {
      final Map<Node, String> next = new HashMap<>();
      for (final Map.Entry<Node, List<Triple>> entry : incident.entrySet()) {
        work += entry.getValue().size();
        next.put(
            entry.getKey(),
            sha256Hex(
                current.get(entry.getKey())
                    + "\n"
                    + signatures(entry.getKey(), entry.getValue(), current)));
      }
      if (work > MAX_WORK) {
        throw new TooSymmetricException(
            "Canonicalizing the graph's blank nodes needs more than " + MAX_WORK + " steps");
      }
      final int refined = new HashSet<>(next.values()).size();
      if (refined == distinct) {
        return current;
      }
      current = next;
      distinct = refined;
    }
  }

  /** The nodes of the smallest colour that more than one node has; empty when none does. */
  private static List<Node> firstTie(final Map<Node, String> colours) {
    final Map<String, List<Node>> byColour = new HashMap<>();
    colours.forEach(
        (node, colour) -> byColour.computeIfAbsent(colour, c -> new ArrayList<>()).add(node));
    String first = null;
    for (final Map.Entry<String, List<Node>> entry : byColour.entrySet()) {
      if (entry.getValue().size() > 1 && (first == null || entry.getKey().compareTo(first) < 0)) {
        first = entry.getKey();
      }
    }
    return first == null ? List.of() : byColour.get(first);
  }

  private String signatures(
      final Node blank, final List<Triple> around, final Map<Node, String> colours) {
    final List<String> signatures = new ArrayList<>(around.size());
    for (final Triple triple : around) {
      signatures.add(signature(blank, triple, colours));
    }
    signatures.sort(String::compareTo);
    return String.join("|", signatures);
  }

  private static String signature(
      final Node blank, final Triple triple, final Map<Node, String> colours) {
    return signatureNode(blank, triple.getSubject(), colours)
        + ' '
        + signatureNode(blank, triple.getPredicate(), colours)
        + ' '
        + signatureNode(blank, triple.getObject(), colours);
  }

  private static String signatureNode(
      final Node blank, final Node node, final Map<Node, String> colours) {
    if (node.equals(blank)) {
      return "_:self";
    }
    if (node.isBlank()) {
      return "_:" + (colours == null ? "" : colours.get(node));
    }
    if (node.isTripleTerm()) {
      return "<<( " + signature(blank, node.getTriple(), colours) + " )>>";
    }
    return NodeFmtLib.strNT(node);
  }

  private String text(final Map<Node, String> colours) {
    final List<String> lines = new ArrayList<>(triples.size());
    for (final Triple triple : triples) {
      lines.add(line(triple, colours) + " .");
    }
    lines.sort(String::compareTo);
    final StringBuilder text = new StringBuilder();
    lines.forEach(line -> text.append(line).append('\n'));
    return text.toString();
  }

  private static String line(final Triple triple, final Map<Node, String> colours) {
    return term(triple.getSubject(), colours)
        + ' '
        + term(triple.getPredicate(), colours)
        + ' '
        + term(triple.getObject(), colours);
  }

  private static String term(final Node node, final Map<Node, String> colours) {
    if (node.isBlank()) {
      return "_:b" + colours.get(node);
    }
    if (node.isTripleTerm()) {
      return "<<( " + line(node.getTriple(), colours) + " )>>";
    }
    return NodeFmtLib.strNT(node);
  }

  /** Adds the triple's blank nodes; true when one sits inside a triple term. */
  private static boolean addBlanks(
      final Set<Node> blanks, final Triple triple, final boolean inTripleTerm) {
    boolean nested = false;
    for (final Node node :
        List.of(triple.getSubject(), triple.getPredicate(), triple.getObject())) {
      if (node.isBlank()) {
        blanks.add(node);
        nested |= inTripleTerm;
      } else if (node.isTripleTerm()) {
        nested |= addBlanks(blanks, node.getTriple(), true);
      }
    }
    return nested;
  }

  private static Node root(final Map<Node, Node> parent, final Node node) {
    Node current = node;
    Node up;
    while ((up = parent.get(current)) != null) {
      final Node grandparent = parent.get(up);
      if (grandparent != null) {
        parent.put(current, grandparent);
      }
      current = up;
    }
    return current;
  }

  static String sha256Hex(final String text) {
    return HEX.formatHex(
        OntologyGraphDigest.newSha256().digest(text.getBytes(StandardCharsets.UTF_8)));
  }
}
