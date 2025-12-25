package org.openmetadata.service.rdf.storage;

import java.util.List;
import java.util.UUID;
import lombok.Getter;
import org.apache.jena.rdf.model.Model;

/**
 * Interface for remote RDF storage implementations.
 * OpenMetadata maintains a stateless architecture, so all RDF storage must be remote.
 */
public interface RdfStorageInterface {

  /**
   * Store an entity model in the RDF store
   */
  void storeEntity(String entityType, UUID entityId, Model entityModel);

  /**
   * Store a relationship between two entities
   */
  void storeRelationship(
      String fromType, UUID fromId, String toType, UUID toId, String relationshipType);

  /**
   * Bulk store multiple relationships for performance
   */
  void bulkStoreRelationships(List<RelationshipData> relationships);

  /**
   * Retrieve an entity model from the RDF store
   */
  Model getEntity(String entityType, UUID entityId);

  /**
   * Delete an entity from the RDF store
   */
  void deleteEntity(String entityType, UUID entityId);

  /**
   * Execute a SPARQL query and return results in the specified format
   * @param sparqlQuery The SPARQL query string
   * @param format Output format: json, xml, csv, turtle, jsonld, etc.
   */
  String executeSparqlQuery(String sparqlQuery, String format);

  /**
   * Execute a SPARQL update operation
   */
  void executeSparqlUpdate(String sparqlUpdate);

  /**
   * Load a Turtle file directly into a named graph
   */
  void loadTurtleFile(java.io.InputStream turtleStream, String graphUri);

  /**
   * Get all graph URIs in the store
   */
  List<String> getAllGraphs();

  /**
   * Get total triple count across all graphs
   */
  long getTripleCount();

  /**
   * Clear all triples from a specific graph
   */
  void clearGraph(String graphUri);

  /**
   * Test connection to the remote store
   */
  boolean testConnection();

  /**
   * Get storage type identifier
   */
  String getStorageType();

  /**
   * Close connections and cleanup resources
   */
  void close();

  /**
   * Data class for relationship information
   */
  @Getter
  class RelationshipData {
    private final String fromType;
    private final UUID fromId;
    private final String toType;
    private final UUID toId;
    private final String relationshipType;

    public RelationshipData(
        String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {
      this.fromType = fromType;
      this.fromId = fromId;
      this.toType = toType;
      this.toId = toId;
      this.relationshipType = relationshipType;
    }
  }
}
