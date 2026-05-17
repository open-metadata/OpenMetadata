package org.openmetadata.service.rdf.storage;

import java.util.List;
import java.util.Set;
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
   * Bulk store multiple relationships for performance. Defaults to using the
   * relationships' from-source URIs as the reconciliation set, which is unsafe
   * when the batch includes lineage rows whose source is outside the current
   * entity batch — those outside-batch sources would have their unrelated
   * outgoing edges wiped. Prefer the 2-arg overload below.
   */
  default void bulkStoreRelationships(List<RelationshipData> relationships) {
    java.util.LinkedHashSet<String> derived = new java.util.LinkedHashSet<>();
    for (RelationshipData rel : relationships) {
      derived.add(buildEntityUri(rel.getFromType(), rel.getFromId().toString()));
    }
    bulkStoreRelationships(relationships, derived);
  }

  /**
   * Bulk store multiple relationships for performance, reconciling only the
   * outgoing relationship-hook edges for the specified source URIs. Sources
   * present in {@code relationships} but NOT in {@code sourcesToReconcile} get
   * their new edges inserted but their existing edges are left untouched —
   * use this overload from the indexer to avoid wiping the outgoing edges of
   * outside-batch entities that appear only in incoming lineage rows.
   */
  void bulkStoreRelationships(List<RelationshipData> relationships, Set<String> sourcesToReconcile);

  /** Build an entity URI in the same shape both writes and queries use. */
  default String buildEntityUri(String entityType, String entityId) {
    // Implementations override if they don't use the default baseUri/entity/ shape.
    return "https://open-metadata.org/entity/" + entityType + "/" + entityId;
  }

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
   * Verify the underlying storage is reachable and the configured dataset/graph is accessible,
   * attempting to create it if missing. Implementations must throw if the storage cannot be
   * brought to a ready state so callers can surface a clear error instead of silently producing
   * partial results.
   */
  default void ensureStorageReady() {}

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
    // Full predicate URI to write. Set by RdfRepository.bulkAddRelationships via
    // getRelationshipPredicate so bulkStoreRelationships writes the same predicate
    // that addRelationship/removeRelationship would (e.g. prov:wasDerivedFrom for
    // "upstream"), instead of a naive "<baseUri>ontology/<relationshipType>"
    // concat that wouldn't match the live remove path.
    private final String predicateUri;

    public RelationshipData(
        String fromType, UUID fromId, String toType, UUID toId, String relationshipType) {
      this(fromType, fromId, toType, toId, relationshipType, null);
    }

    public RelationshipData(
        String fromType,
        UUID fromId,
        String toType,
        UUID toId,
        String relationshipType,
        String predicateUri) {
      this.fromType = fromType;
      this.fromId = fromId;
      this.toType = toType;
      this.toId = toId;
      this.relationshipType = relationshipType;
      this.predicateUri = predicateUri;
    }
  }
}
