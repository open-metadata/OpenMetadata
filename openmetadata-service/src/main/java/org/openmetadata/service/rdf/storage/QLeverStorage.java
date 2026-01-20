package org.openmetadata.service.rdf.storage;

import java.util.List;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;

/**
 * QLever implementation of RDF storage.
 * QLever is a SPARQL engine designed for very large knowledge graphs.
 *
 * TODO: Implement when QLever provides a stable Java client or REST API
 * See: https://github.com/ad-freiburg/qlever
 */
@Slf4j
public class QLeverStorage implements RdfStorageInterface {

  private final String baseUri;
  private final String endpoint;

  public QLeverStorage(RdfConfiguration config) {
    this.baseUri =
        config.getBaseUri() != null ? config.getBaseUri().toString() : "https://open-metadata.org/";
    this.endpoint = config.getRemoteEndpoint() != null ? config.getRemoteEndpoint().toString() : "";

    LOG.warn("QLever storage is not yet implemented. Using as placeholder.");
    throw new UnsupportedOperationException(
        "QLever storage implementation is pending. Use JenaFusekiStorage instead.");
  }

  @Override
  public void storeEntity(String entityType, UUID entityId, Model entityModel) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void bulkStoreRelationships(List<RelationshipData> relationships) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public Model getEntity(String entityType, UUID entityId) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void deleteEntity(String entityType, UUID entityId) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public String executeSparqlQuery(String sparqlQuery, String format) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void executeSparqlUpdate(String sparqlUpdate) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void loadTurtleFile(java.io.InputStream turtleStream, String graphUri) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public List<String> getAllGraphs() {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public long getTripleCount() {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public void clearGraph(String graphUri) {
    throw new UnsupportedOperationException("QLever storage not yet implemented");
  }

  @Override
  public boolean testConnection() {
    return false;
  }

  @Override
  public String getStorageType() {
    return "QLever";
  }

  @Override
  public void close() {
    // No-op for now
  }
}
