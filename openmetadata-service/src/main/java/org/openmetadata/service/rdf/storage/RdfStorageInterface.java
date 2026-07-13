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
   * Bulk-write multiple entity models in a single SPARQL transaction.
   *
   * <p>The default loops over {@link #storeEntity(String, UUID, Model)} per
   * entity — backward-compatible for backends that don't expose a batch path.
   * Backends with a streaming/transactional protocol (e.g. Fuseki's SPARQL
   * UPDATE) SHOULD override this to issue one combined DELETE+INSERT per
   * batch, reducing both request count and Fuseki transaction overhead during
   * re-indexing.
   *
   * <p>Failure semantics: a batch is all-or-nothing — if the combined update
   * fails, the caller MUST fall back to per-entity {@link #storeEntity} to
   * preserve fine-grained success / failure accounting in the indexer stats.
   */
  default void bulkStoreEntities(List<EntityWriteRequest> requests) {
    if (requests == null || requests.isEmpty()) {
      return;
    }
    for (EntityWriteRequest req : requests) {
      storeEntity(req.entityType(), req.entityId(), req.model());
    }
  }

  /** Payload for {@link #bulkStoreEntities}. */
  record EntityWriteRequest(String entityType, UUID entityId, Model model) {}

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
   * Compact the underlying storage to reclaim disk space after large deletes.
   *
   * <p>Apache Jena TDB2 (the Fuseki backend) marks deleted triples as free space
   * in its B+Tree indexes but never returns blocks to the OS, and its write-ahead
   * journal grows monotonically until compaction is invoked. Without an explicit
   * compaction call after {@code CLEAR ALL} / {@code DELETE WHERE}, the on-disk
   * dataset keeps growing across re-index runs even though the live triple count
   * stays bounded.
   *
   * <p>Implementations should run compaction synchronously (block until the task
   * finishes on the server) so callers can safely resume writes against a fresh
   * dataset directory. Failures should be logged and swallowed — a missing
   * compaction degrades disk usage, not correctness, so it must not fail the
   * caller's higher-level operation (e.g. the re-index run).
   *
   * <p>Default implementation is a no-op for storage backends that auto-compact
   * or don't expose a compaction API.
   */
  default void compactStorage() {}

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
