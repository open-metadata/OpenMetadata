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

import java.util.Objects;
import java.util.function.Consumer;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.GraphMemFactory;
import org.apache.jena.graph.Node;
import org.apache.jena.graph.Triple;
import org.apache.jena.util.iterator.ExtendedIterator;

/** The triples that turn the stored projection of an entity into a new one. */
record RdfEntityDifference(Graph toDelete, Graph toInsert) {

  /**
   * @param stored the triples the store holds in the entity's replacement scope
   * @param existing the triples of {@code projection} outside that scope the store already holds
   * @param projection the entity's new projection
   */
  static RdfEntityDifference between(
      final Graph stored, final Graph existing, final Graph projection) {
    final Graph toDelete = GraphMemFactory.createDefaultGraph();
    stored.find().forEachRemaining(keepIfAbsent(toDelete, projection, null));
    final Graph toInsert = GraphMemFactory.createDefaultGraph();
    projection.find().forEachRemaining(keepIfAbsent(toInsert, stored, existing));
    return new RdfEntityDifference(toDelete, toInsert);
  }

  boolean isEmpty() {
    return toDelete.isEmpty() && toInsert.isEmpty();
  }

  long size() {
    return (long) toDelete.size() + toInsert.size();
  }

  private static Consumer<Triple> keepIfAbsent(
      final Graph kept, final Graph first, final Graph second) {
    return triple -> {
      if (!holds(first, triple) && (second == null || !holds(second, triple))) {
        kept.add(triple);
      }
    };
  }

  /**
   * TDB2 stores numbers, dates and booleans by value and returns them in its canonical lexical
   * form, so {@code "2026-01-01T00:00:00.000Z"^^xsd:dateTime} comes back as {@code
   * "2026-01-01T00:00:00Z"^^xsd:dateTime}. Comparing terms alone would make every write of an
   * unchanged entity rewrite those literals; a literal of the same datatype and value counts as
   * held.
   */
  static boolean holds(final Graph graph, final Triple triple) {
    return graph.contains(triple)
        || (triple.getObject().isLiteral() && holdsSameValue(graph, triple));
  }

  private static boolean holdsSameValue(final Graph graph, final Triple triple) {
    final Node literal = triple.getObject();
    final ExtendedIterator<Triple> candidates =
        graph.find(triple.getSubject(), triple.getPredicate(), Node.ANY);
    try {
      boolean found = false;
      while (!found && candidates.hasNext()) {
        found = isSameValue(literal, candidates.next().getObject());
      }
      return found;
    } finally {
      candidates.close();
    }
  }

  private static boolean isSameValue(final Node literal, final Node candidate) {
    return candidate.isLiteral()
        && Objects.equals(literal.getLiteralDatatypeURI(), candidate.getLiteralDatatypeURI())
        && Objects.equals(literal.getLiteralLanguage(), candidate.getLiteralLanguage())
        && literal.sameValueAs(candidate);
  }
}
