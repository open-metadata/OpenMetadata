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
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.service.rdf.RdfWriteMode;

/** Forwards the complete storage contract so decorators retain backend capabilities. */
public abstract class ForwardingRdfStorage implements RdfStorageInterface {
  protected abstract RdfStorageInterface delegate();

  @Override
  public void storeEntity(String type, UUID id, Model model) {
    delegate().storeEntity(type, id, model);
  }

  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests) {
    delegate().bulkStoreEntities(requests);
  }

  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests, RdfWriteMode mode) {
    delegate().bulkStoreEntities(requests, mode);
  }

  @Override
  public void bulkStoreEntities(List<EntityWriteRequest> requests, RdfWriteMode mode, long budget) {
    delegate().bulkStoreEntities(requests, mode, budget);
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String type) {
    delegate().storeRelationship(fromType, fromId, toType, toId, type);
  }

  @Override
  public void bulkStoreRelationships(List<RelationshipData> relationships, Set<String> sources) {
    delegate().bulkStoreRelationships(relationships, sources);
  }

  @Override
  public String buildEntityUri(String type, String id) {
    return delegate().buildEntityUri(type, id);
  }

  @Override
  public Model getEntity(String type, UUID id) {
    return delegate().getEntity(type, id);
  }

  @Override
  public void deleteEntity(String type, UUID id) {
    delegate().deleteEntity(type, id);
  }

  @Override
  public String executeSparqlQuery(String query, String format) {
    return delegate().executeSparqlQuery(query, format);
  }

  @Override
  public void executeSparqlUpdate(String update) {
    delegate().executeSparqlUpdate(update);
  }

  @Override
  public void loadTurtleFile(InputStream input, String graph) {
    delegate().loadTurtleFile(input, graph);
  }

  @Override
  public List<String> getAllGraphs() {
    return delegate().getAllGraphs();
  }

  @Override
  public long getTripleCount() {
    return delegate().getTripleCount();
  }

  @Override
  public long getTripleCount(String graph) {
    return delegate().getTripleCount(graph);
  }

  @Override
  public void clearGraph(String graph) {
    delegate().clearGraph(graph);
  }

  @Override
  public void compactStorage() {
    delegate().compactStorage();
  }

  @Override
  public boolean testConnection() {
    return delegate().testConnection();
  }

  @Override
  public void ensureStorageReady() {
    delegate().ensureStorageReady();
  }

  @Override
  public boolean supportsDatasetManagement() {
    return delegate().supportsDatasetManagement();
  }

  @Override
  public void createDatasetIfMissing(String dataset) {
    delegate().createDatasetIfMissing(dataset);
  }

  @Override
  public void deleteDataset(String dataset) {
    delegate().deleteDataset(dataset);
  }

  @Override
  public boolean datasetExists(String dataset) {
    return delegate().datasetExists(dataset);
  }

  @Override
  public String currentDatasetName() {
    return delegate().currentDatasetName();
  }

  @Override
  public void repointToDataset(String dataset) {
    delegate().repointToDataset(dataset);
  }

  @Override
  public OptionalLong fetchServerMaxHeapBytes() {
    return delegate().fetchServerMaxHeapBytes();
  }

  @Override
  public String getStorageType() {
    return delegate().getStorageType();
  }

  @Override
  public void close() {
    delegate().close();
  }
}
