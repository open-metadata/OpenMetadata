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
package org.openmetadata.service.rdf.rebuild;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.UncheckedIOException;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Supplier;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.storage.ForwardingRdfStorage;
import org.openmetadata.service.rdf.storage.RdfStorageInterface;

/** Captures live mutations or fences a fixed rebuild generation before touching Fuseki. */
final class RebuildingRdfStorage extends ForwardingRdfStorage {
  private static final int MAX_TURTLE_BYTES = 64 * 1024 * 1024;
  private final RdfDatasetManager manager;
  private final RdfDatasetManager.BuildTarget target;

  RebuildingRdfStorage(
      final RdfDatasetManager manager, final RdfDatasetManager.BuildTarget target) {
    this.manager = manager;
    this.target = target;
  }

  @Override
  protected RdfStorageInterface delegate() {
    return target == null ? manager.servingStorage() : manager.storage(target.dataset());
  }

  private void mutate(
      final Consumer<RdfStorageInterface> mutation, final Supplier<RdfMutation> captured) {
    if (target == null) {
      manager.writeActive(mutation, captured);
    } else {
      manager.writeBuild(target, mutation);
    }
  }

  @Override
  public void storeEntity(final String type, final UUID id, final Model model) {
    mutate(
        storage -> storage.storeEntity(type, id, model),
        () -> RdfMutation.EntityWrite.capture(type, id, model));
  }

  @Override
  public void bulkStoreEntities(final List<EntityWriteRequest> requests) {
    bulkStoreEntities(requests, RdfWriteMode.RECONCILE);
  }

  @Override
  public void bulkStoreEntities(final List<EntityWriteRequest> requests, final RdfWriteMode mode) {
    mutate(
        storage -> storage.bulkStoreEntities(requests, mode),
        () -> RdfMutation.EntityBatch.capture(requests, mode));
  }

  @Override
  public void bulkStoreEntities(
      final List<EntityWriteRequest> requests, final RdfWriteMode mode, final long budget) {
    mutate(
        storage -> storage.bulkStoreEntities(requests, mode, budget),
        () -> RdfMutation.EntityBatch.capture(requests, mode));
  }

  @Override
  public void storeRelationship(
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId,
      final String type) {
    final RdfMutation.Relation relation =
        new RdfMutation.Relation(
            new RdfMutation.EntityKey(fromType, fromId),
            new RdfMutation.EntityKey(toType, toId),
            type,
            null);
    mutate(
        storage -> storage.storeRelationship(fromType, fromId, toType, toId, type),
        () -> new RdfMutation.RelationshipWrite(relation));
  }

  @Override
  public void bulkStoreRelationships(
      final List<RelationshipData> relationships, final Set<String> sources) {
    mutate(
        storage -> storage.bulkStoreRelationships(relationships, sources),
        () -> RdfMutation.RelationshipBatch.capture(relationships, sources));
  }

  @Override
  public void deleteEntity(final String type, final UUID id) {
    mutate(storage -> storage.deleteEntity(type, id), () -> new RdfMutation.EntityDelete(type, id));
  }

  @Override
  public void executeSparqlUpdate(final String statement) {
    mutate(
        storage -> storage.executeSparqlUpdate(statement), () -> new RdfMutation.Sparql(statement));
  }

  @Override
  public void loadTurtleFile(final InputStream input, final String graph) {
    final byte[] body = readTurtle(input);
    mutate(
        storage -> storage.loadTurtleFile(new ByteArrayInputStream(body), graph),
        () -> new RdfMutation.Turtle(body, graph));
  }

  private static byte[] readTurtle(final InputStream input) {
    try {
      final byte[] body = input.readNBytes(MAX_TURTLE_BYTES + 1);
      if (body.length > MAX_TURTLE_BYTES) {
        throw new IllegalArgumentException("RDF Turtle input exceeds 64 MiB");
      }
      return body;
    } catch (IOException exception) {
      throw new UncheckedIOException("Unable to read RDF Turtle input", exception);
    }
  }

  @Override
  public void clearGraph(final String graph) {
    mutate(storage -> storage.clearGraph(graph), () -> new RdfMutation.GraphClear(graph));
  }

  @Override
  public void repointToDataset(final String dataset) {
    if (!manager.activeDataset().equals(dataset)) {
      throw new IllegalArgumentException("Serving dataset must match the durable routing pointer");
    }
  }

  @Override
  public void close() {
    // Handles belong to the manager; closing a temporary repository view must not close serving.
  }
}
