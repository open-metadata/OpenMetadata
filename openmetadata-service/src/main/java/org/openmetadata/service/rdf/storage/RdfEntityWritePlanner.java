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

import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Consumer;
import java.util.function.Function;
import org.apache.jena.graph.Graph;
import org.apache.jena.graph.GraphMemFactory;
import org.apache.jena.graph.Triple;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.riot.Lang;
import org.apache.jena.riot.RDFWriter;
import org.apache.jena.util.iterator.ExtendedIterator;

/**
 * Decides what one entity write sends to the store. TDB2 never edits in place: every index block a
 * write touches is copied and the old one freed only by compaction, so deleting and reinserting an
 * unchanged projection costs as much disk as rewriting it. The planner reads the stored projection
 * and sends only the triples that differ, or nothing.
 */
final class RdfEntityWritePlanner {
  /** Bounds the VALUES block of one existence read; reads are cheap, a huge query is not. */
  static final int EXISTENCE_CHECK_CHUNK = 1000;

  private final Function<String, Model> construct;

  /** @param construct runs a SPARQL CONSTRUCT query against the store */
  RdfEntityWritePlanner(final Function<String, Model> construct) {
    this.construct = Objects.requireNonNull(construct, "construct");
  }

  /** What to send, and what it does. An empty update sends nothing. */
  record Plan(RdfEntityWriteResult result, String update) {
    boolean sendsUpdate() {
      return !update.isEmpty();
    }
  }

  /**
   * Plans the write, sends it through {@code send}, and repairs it when another write interfered. A
   * difference is computed from a read, and a write already queued for TDB2's writer when that read
   * ran, such as a request OpenMetadata stopped waiting for or a server that died sending it,
   * commits between the read and this update. TDB2 admits writers in arrival order, so once this
   * update has returned every such write has committed: reading the projection back shows whether
   * one interfered, and a replacement, whose delete is evaluated when it applies, repairs it (see
   * ADR:2026-11-03-live-rdf-entity-writes-send-only-the-changed-triples).
   */
  RdfEntityWriteResult write(
      final String entityUri,
      final Model projection,
      final RdfEntityWriteStrategy strategy,
      final Consumer<String> send) {
    final Plan plan = plan(entityUri, projection, strategy);
    if (plan.sendsUpdate()) {
      send.accept(plan.update());
    }
    final boolean interfered =
        plan.result().outcome() == RdfEntityWriteResult.Outcome.CHANGED_TRIPLES
            && !holds(entityUri, projection);
    if (interfered) {
      send.accept(replacementPlan(entityUri, projection).update());
    }
    return interfered ? RdfEntityWriteResult.CORRECTED : plan.result();
  }

  /** Whether the store now holds exactly the projection: one more difference would send nothing. */
  private boolean holds(final String entityUri, final Model projection) {
    return plan(entityUri, projection, RdfEntityWriteStrategy.DIFFERENCE).result()
        == RdfEntityWriteResult.UNCHANGED;
  }

  Plan plan(final String entityUri, final Model projection, final RdfEntityWriteStrategy strategy) {
    final Graph graph = projection.getGraph();
    final Optional<RdfEntityDifference> difference =
        strategy == RdfEntityWriteStrategy.DIFFERENCE && !hasBlankNode(graph)
            ? difference(entityUri, graph)
            : Optional.empty();
    return difference
        .map(RdfEntityWritePlanner::differencePlan)
        .orElseGet(() -> replacementPlan(entityUri, projection));
  }

  /**
   * Empty when only a replacement is correct or cheaper: DELETE DATA cannot name a blank node, and
   * the stored projection still has blank list cells when it was written before cells were named;
   * a difference larger than the projection itself, such as after a rename, costs more than
   * replacing it.
   */
  private Optional<RdfEntityDifference> difference(final String entityUri, final Graph projection) {
    final Set<String> predicates = RdfEntityScope.translatorPredicates(entityUri, projection);
    final Graph stored = read(RdfEntityScope.storedTriplesQuery(entityUri, predicates));
    return hasBlankNode(stored)
        ? Optional.empty()
        : Optional.of(
                RdfEntityDifference.between(
                    stored,
                    existing(RdfEntityScope.outsideScope(projection, entityUri, predicates)),
                    projection))
            .filter(found -> found.size() <= projection.size());
  }

  private Graph existing(final List<Triple> triples) {
    final Graph existing = GraphMemFactory.createDefaultGraph();
    for (int start = 0; start < triples.size(); start += EXISTENCE_CHECK_CHUNK) {
      final List<Triple> chunk =
          triples.subList(start, Math.min(start + EXISTENCE_CHECK_CHUNK, triples.size()));
      read(RdfEntityScope.existingTriplesQuery(chunk)).find().forEachRemaining(existing::add);
    }
    return existing;
  }

  private Graph read(final String query) {
    return construct.apply(query).getGraph();
  }

  private static Plan differencePlan(final RdfEntityDifference difference) {
    return difference.isEmpty()
        ? new Plan(RdfEntityWriteResult.UNCHANGED, "")
        : new Plan(
            RdfEntityWriteResult.changedTriples(
                difference.toDelete().size(), difference.toInsert().size()),
            changeUpdate(difference));
  }

  private static Plan replacementPlan(final String entityUri, final Model projection) {
    return new Plan(
        RdfEntityWriteResult.REPLACED,
        JenaFusekiStorage.buildEntityUpsertUpdate(entityUri, projection));
  }

  /**
   * Neither operation has a WHERE, so the request stays within the one WHERE-bearing operation
   * Fuseki accepts when {@code arq:updateTimeout} is set, and both apply in one transaction.
   */
  static String changeUpdate(final RdfEntityDifference difference) {
    final StringBuilder update = new StringBuilder();
    if (!difference.toDelete().isEmpty()) {
      update.append(dataOperation("DELETE DATA", difference.toDelete()));
    }
    if (!difference.toInsert().isEmpty()) {
      if (!update.isEmpty()) {
        update.append(" ;\n");
      }
      update.append(dataOperation("INSERT DATA", difference.toInsert()));
    }
    return update.toString();
  }

  private static String dataOperation(final String operation, final Graph triples) {
    return operation
        + " { GRAPH <"
        + JenaFusekiStorage.KNOWLEDGE_GRAPH
        + "> { "
        + RDFWriter.source(triples).lang(Lang.NTRIPLES).asString()
        + " } }";
  }

  static boolean hasBlankNode(final Graph graph) {
    final ExtendedIterator<Triple> triples = graph.find();
    try {
      boolean found = false;
      while (!found && triples.hasNext()) {
        final Triple triple = triples.next();
        found = triple.getSubject().isBlank() || triple.getObject().isBlank();
      }
      return found;
    } finally {
      triples.close();
    }
  }
}
