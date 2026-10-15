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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTimeoutPreemptively;

import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.NodeFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.rdf.model.ModelFactory;
import org.apache.jena.rdf.model.RDFNode;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFParser;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.OntologyAxiom;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.service.Entity;

/**
 * The graph digest the store recomputes. The vectors in resources/rdf/digest-vectors are shared
 * with the store, whose GraphDigestTest requires the same digests for the same files; expected.txt
 * is what these classes compute. Every vector must digest the same whatever its blank nodes are
 * called and in whatever order its triples arrive.
 */
class OntologyGraphDigestTest {
  private static final String REFUSED = "refused";

  @Test
  void theSharedVectorsHaveTheirRecordedDigests() throws Exception {
    final Map<String, String> expected = expected();
    assertEquals(
        List.of(
            "axiom.ttl",
            "cycles.ttl",
            "empty.ttl",
            "list.ttl",
            "nested-twins.ttl",
            "too-symmetric.ttl",
            "twins.ttl"),
        expected.keySet().stream().sorted().toList());
    for (final Map.Entry<String, String> vector : expected.entrySet()) {
      final List<Triple> triples = vector(vector.getKey());
      if (REFUSED.equals(vector.getValue())) {
        assertThrows(
            OntologyGraphCanonicalForm.TooSymmetricException.class,
            () -> digest(triples),
            vector.getKey());
      } else {
        assertEquals(vector.getValue(), digest(triples), vector.getKey());
      }
    }
  }

  @Test
  void blankNodeLabelsAndTripleOrderDoNotChangeTheDigest() throws Exception {
    final Random random = new Random(20261015L);
    for (final Map.Entry<String, String> vector : expected().entrySet()) {
      if (REFUSED.equals(vector.getValue())) {
        continue;
      }
      final List<Triple> triples = vector(vector.getKey());
      for (int attempt = 0; attempt < 25; attempt++) {
        assertEquals(
            vector.getValue(),
            digest(relabel(triples, random)),
            vector.getKey() + " relabelled, attempt " + attempt);
      }
    }
  }

  @Test
  void contentChangesTheDigest() throws Exception {
    final String text = Files.readString(vectors().resolve("nested-twins.ttl"));
    final String digest = digest(turtle(text));
    assertNotEquals(digest, digest(turtle(text.replaceFirst("ex.org/C", "ex.org/D"))));
    assertNotEquals(digest, digest(turtle(text.replace("ex.org/p", "ex.org/q"))));
    final String cycles = Files.readString(vectors().resolve("cycles.ttl"));
    assertNotEquals(
        digest(turtle(cycles)),
        digest(
            turtle(cycles.replace("_:t3 <http://ex.org/p> _:t1", "_:t3 <http://ex.org/p> _:h1"))),
        "joining the triangle to the hexagon is different content");
  }

  @Test
  void aGraphWithManyBlankNodesIsDigestedInLinearTime() {
    final StringBuilder list = new StringBuilder("<http://ex.org/s> <http://ex.org/p> (");
    for (int i = 0; i < 50_000; i++) {
      list.append(" <http://ex.org/m").append(i).append('>');
    }
    final List<Triple> triples = turtle(list.append(" ) .").toString());
    assertEquals(
        71, assertTimeoutPreemptively(Duration.ofSeconds(60), () -> digest(triples)).length());
  }

  @Test
  void aGraphTooSymmetricToDigestIsProjectedWithoutADigest() throws Exception {
    final Model content = ModelFactory.createDefaultModel();
    vector("too-symmetric.ttl").forEach(triple -> content.getGraph().add(triple));
    final OntologyAxiom owner =
        new OntologyAxiom()
            .withId(UUID.randomUUID())
            .withName("symmetric")
            .withEntityStatus(EntityStatus.APPROVED)
            .withGlossary(
                new EntityReference().withId(UUID.randomUUID()).withType(Entity.GLOSSARY));

    final OntologyGraphMember member =
        OntologyGraphMember.of(
            "https://open-metadata.org/graph/axiom/" + owner.getId(),
            owner,
            content,
            URI.create("https://open-metadata.org/"));

    assertNull(member.digest());
    final Model record = member.toModel();
    assertFalse(
        record.contains(
            null,
            record.createProperty(OntologyReasoningVocabulary.CONTENT_DIGEST),
            (RDFNode) null));
    assertFalse(
        record.contains(
            null,
            record.createProperty(OntologyReasoningVocabulary.DIGEST_ALGORITHM),
            (RDFNode) null));
  }

  private static String digest(final List<Triple> triples) {
    final Model model = ModelFactory.createDefaultModel();
    triples.forEach(triple -> model.getGraph().add(triple));
    return OntologyGraphDigest.of(model);
  }

  /** The triples with every blank node renamed at random, shuffled. */
  private static List<Triple> relabel(final List<Triple> triples, final Random random) {
    final Map<Node, Node> names = new HashMap<>();
    final List<Triple> relabelled = new ArrayList<>();
    for (final Triple triple : triples) {
      relabelled.add(
          Triple.create(
              rename(triple.getSubject(), names, random),
              rename(triple.getPredicate(), names, random),
              rename(triple.getObject(), names, random)));
    }
    Collections.shuffle(relabelled, random);
    return relabelled;
  }

  private static Node rename(final Node node, final Map<Node, Node> names, final Random random) {
    return node.isBlank()
        ? names.computeIfAbsent(
            node, blank -> NodeFactory.createBlankNode(Long.toHexString(random.nextLong())))
        : node;
  }

  private static Map<String, String> expected() throws IOException, URISyntaxException {
    final Map<String, String> expected = new HashMap<>();
    for (final String line : Files.readAllLines(vectors().resolve("expected.txt"))) {
      if (!line.startsWith("#") && !line.isBlank()) {
        final String[] parts = line.split(" ");
        expected.put(parts[0], parts[1]);
      }
    }
    return expected;
  }

  private static List<Triple> vector(final String name) throws IOException, URISyntaxException {
    return turtle(Files.readString(vectors().resolve(name)));
  }

  private static List<Triple> turtle(final String text) {
    final Model model = ModelFactory.createDefaultModel();
    RDFParser.fromString(text, Lang.TURTLE).parse(model.getGraph());
    return model.getGraph().find().toList();
  }

  private static Path vectors() throws URISyntaxException {
    return Path.of(OntologyGraphDigestTest.class.getResource("/rdf/digest-vectors").toURI());
  }
}
