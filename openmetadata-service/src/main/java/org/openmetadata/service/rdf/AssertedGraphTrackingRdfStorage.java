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

import java.io.InputStream;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.graph.Node;
import org.apache.jena.query.Syntax;
import org.apache.jena.rdf.model.Model;
import org.apache.jena.sparql.core.Quad;
import org.apache.jena.sparql.modify.request.UpdateBinaryOp;
import org.apache.jena.sparql.modify.request.UpdateClear;
import org.apache.jena.sparql.modify.request.UpdateCreate;
import org.apache.jena.sparql.modify.request.UpdateDataDelete;
import org.apache.jena.sparql.modify.request.UpdateDataInsert;
import org.apache.jena.sparql.modify.request.UpdateDeleteWhere;
import org.apache.jena.sparql.modify.request.UpdateDrop;
import org.apache.jena.sparql.modify.request.UpdateLoad;
import org.apache.jena.sparql.modify.request.UpdateModify;
import org.apache.jena.update.Update;
import org.apache.jena.update.UpdateFactory;
import org.apache.jena.update.UpdateRequest;
import org.openmetadata.service.rdf.storage.ForwardingRdfStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/**
 * Tells {@link AssertedOnlyQueries} which graphs this server's writes reach, so a graph created
 * by OpenMetadata, such as an insights graph, is part of asserted-only reads from the next query.
 * Entity and relationship writes all go to the knowledge graph; a SPARQL update names its own
 * targets, and an update whose targets cannot be read relists the graphs.
 */
final class AssertedGraphTrackingRdfStorage extends ForwardingRdfStorage {
  private final RdfStorageInterface delegate;
  private final AssertedOnlyQueries assertedOnlyQueries;
  private final Set<String> entityGraphs;

  AssertedGraphTrackingRdfStorage(
      final RdfStorageInterface delegate,
      final AssertedOnlyQueries assertedOnlyQueries,
      final String knowledgeGraph) {
    this.delegate = Objects.requireNonNull(delegate);
    this.assertedOnlyQueries = Objects.requireNonNull(assertedOnlyQueries);
    this.entityGraphs = Set.of(knowledgeGraph);
  }

  @Override
  protected RdfStorageInterface delegate() {
    return delegate;
  }

  @Override
  public void storeEntity(final String entityType, final UUID entityId, final Model entityModel) {
    delegate.storeEntity(entityType, entityId, entityModel);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void bulkStoreEntities(final List<EntityWriteRequest> requests) {
    delegate.bulkStoreEntities(requests);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void bulkStoreEntities(
      final List<EntityWriteRequest> requests, final RdfWriteMode writeMode) {
    delegate.bulkStoreEntities(requests, writeMode);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void bulkStoreEntities(
      final List<EntityWriteRequest> requests, final RdfWriteMode mode, final long budget) {
    delegate.bulkStoreEntities(requests, mode, budget);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void storeRelationship(
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId,
      final String relationshipType) {
    delegate.storeRelationship(fromType, fromId, toType, toId, relationshipType);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void bulkStoreRelationships(
      final List<RelationshipData> relationships, final Set<String> sourcesToReconcile) {
    delegate.bulkStoreRelationships(relationships, sourcesToReconcile);
    assertedOnlyQueries.graphsWritten(entityGraphs);
  }

  @Override
  public void executeSparqlUpdate(final String sparqlUpdate) {
    try {
      delegate.executeSparqlUpdate(sparqlUpdate);
    } finally {
      // A failed or timed-out update may still have been applied.
      targetGraphs(sparqlUpdate)
          .ifPresentOrElse(assertedOnlyQueries::graphsWritten, assertedOnlyQueries::graphsChanged);
    }
  }

  @Override
  public void loadTurtleFile(final InputStream turtleStream, final String graphUri) {
    try {
      delegate.loadTurtleFile(turtleStream, graphUri);
    } finally {
      assertedOnlyQueries.graphsWritten(Set.of(graphUri));
    }
  }

  @Override
  public void replaceGraph(final String graph, final Model model) {
    try {
      delegate.replaceGraph(graph, model);
    } finally {
      assertedOnlyQueries.graphsWritten(Set.of(graph));
    }
  }

  /**
   * The named graphs an update can add triples to, or empty when they cannot be determined.
   * Writes to the default graph are left out: with a union default graph, Fuseki answers no query
   * from it.
   */
  static Optional<Set<String>> targetGraphs(final String sparqlUpdate) {
    final UpdateRequest request;
    try {
      request = UpdateFactory.create(sparqlUpdate, Syntax.syntaxARQ);
    } catch (RuntimeException unparseable) {
      return Optional.empty();
    }
    final Set<String> graphs = new HashSet<>();
    for (final Update update : request.getOperations()) {
      if (!addTargets(update, graphs)) {
        return Optional.empty();
      }
    }
    return Optional.of(graphs);
  }

  private static boolean addTargets(final Update update, final Set<String> graphs) {
    return switch (update) {
      case UpdateDataInsert insert -> addQuadGraphs(insert.getQuads(), null, graphs);
      case UpdateModify modify -> addQuadGraphs(
          modify.getInsertQuads(), modify.getWithIRI(), graphs);
      case UpdateLoad load -> addGraph(load.getDest(), graphs);
      case UpdateCreate create -> addGraph(create.getGraph(), graphs);
      case UpdateBinaryOp copy -> !copy.getDest().isOneNamedGraph()
          || addGraph(copy.getDest().getGraph(), graphs);
      case UpdateDataDelete ignored -> true;
      case UpdateDeleteWhere ignored -> true;
      case UpdateClear ignored -> true;
      case UpdateDrop ignored -> true;
      default -> false;
    };
  }

  private static boolean addQuadGraphs(
      final List<Quad> quads, final Node withGraph, final Set<String> graphs) {
    boolean known = true;
    for (final Quad quad : quads) {
      known &= addGraph(quad.isDefaultGraph() ? withGraph : quad.getGraph(), graphs);
    }
    return known;
  }

  /** False for a graph named by a variable, whose value only the store knows. */
  private static boolean addGraph(final Node graph, final Set<String> graphs) {
    if (graph == null || Quad.isDefaultGraph(graph)) {
      return true;
    }
    if (!graph.isURI()) {
      return false;
    }
    graphs.add(graph.getURI());
    return true;
  }
}
