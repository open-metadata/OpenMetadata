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

import java.io.InputStream;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.service.rdf.RdfWriteMode;
import org.openmetadata.service.rdf.inference.InferenceDirtyMarker;

/** Marks inference output stale after each successful mutation of the source RDF dataset. */
public final class InferenceInvalidatingRdfStorage implements RdfStorageInterface {
  private final RdfStorageInterface delegate;
  private final InferenceDirtyMarker dirtyMarker;

  public InferenceInvalidatingRdfStorage(
      final RdfStorageInterface delegate, final InferenceDirtyMarker dirtyMarker) {
    this.delegate = Objects.requireNonNull(delegate);
    this.dirtyMarker = Objects.requireNonNull(dirtyMarker);
  }

  @Override
  public void storeEntity(final String entityType, final UUID entityId, final Model entityModel) {
    mutate(() -> delegate.storeEntity(entityType, entityId, entityModel));
  }

  @Override
  public void bulkStoreEntities(final List<EntityWriteRequest> requests) {
    mutate(() -> delegate.bulkStoreEntities(requests));
  }

  @Override
  public void bulkStoreEntities(
      final List<EntityWriteRequest> requests, final RdfWriteMode writeMode) {
    mutate(() -> delegate.bulkStoreEntities(requests, writeMode));
  }

  @Override
  public void storeRelationship(
      final String fromType,
      final UUID fromId,
      final String toType,
      final UUID toId,
      final String relationshipType) {
    mutate(() -> delegate.storeRelationship(fromType, fromId, toType, toId, relationshipType));
  }

  @Override
  public void bulkStoreRelationships(
      final List<RelationshipData> relationships, final Set<String> sourcesToReconcile) {
    mutate(() -> delegate.bulkStoreRelationships(relationships, sourcesToReconcile));
  }

  @Override
  public String buildEntityUri(final String entityType, final String entityId) {
    return delegate.buildEntityUri(entityType, entityId);
  }

  @Override
  public Model getEntity(final String entityType, final UUID entityId) {
    return delegate.getEntity(entityType, entityId);
  }

  @Override
  public void deleteEntity(final String entityType, final UUID entityId) {
    mutate(() -> delegate.deleteEntity(entityType, entityId));
  }

  @Override
  public String executeSparqlQuery(final String sparqlQuery, final String format) {
    return delegate.executeSparqlQuery(sparqlQuery, format);
  }

  @Override
  public void executeSparqlUpdate(final String sparqlUpdate) {
    mutate(() -> delegate.executeSparqlUpdate(sparqlUpdate));
  }

  @Override
  public void loadTurtleFile(final InputStream turtleStream, final String graphUri) {
    mutate(() -> delegate.loadTurtleFile(turtleStream, graphUri));
  }

  @Override
  public List<String> getAllGraphs() {
    return delegate.getAllGraphs();
  }

  @Override
  public long getTripleCount() {
    return delegate.getTripleCount();
  }

  @Override
  public long getTripleCount(final String graphUri) {
    return delegate.getTripleCount(graphUri);
  }

  @Override
  public void clearGraph(final String graphUri) {
    mutate(() -> delegate.clearGraph(graphUri));
  }

  @Override
  public void compactStorage() {
    delegate.compactStorage();
  }

  @Override
  public boolean testConnection() {
    return delegate.testConnection();
  }

  @Override
  public void ensureStorageReady() {
    delegate.ensureStorageReady();
  }

  @Override
  public String getStorageType() {
    return delegate.getStorageType();
  }

  @Override
  public void close() {
    delegate.close();
  }

  private void mutate(final Runnable mutation) {
    mutation.run();
    dirtyMarker.markAllDirty();
  }
}
