package org.openmetadata.service.rdf.storage;

import java.util.List;
import java.util.OptionalLong;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import org.apache.jena.rdf.model.Model;
import org.openmetadata.schema.api.configuration.rdf.RdfConfiguration;
import org.openmetadata.service.rdf.RdfWriteMode;

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
   * Maximum JVM heap of the remote storage server in bytes, when the backend exposes it (Fuseki
   * publishes it at {@code /$/metrics}). Empty when unknown or unreachable — callers fall back to
   * configured defaults.
   */
  default OptionalLong fetchServerMaxHeapBytes() {
    return OptionalLong.empty();
  }

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

  /**
   * Bulk-write entity models using the requested reconciliation mode. Backends that do not support
   * insert-only writes retain their existing behavior through the one-argument overload.
   */
  default void bulkStoreEntities(List<EntityWriteRequest> requests, RdfWriteMode writeMode) {
    bulkStoreEntities(requests);
  }

  /** Payload for {@link #bulkStoreEntities}. */
  record EntityWriteRequest(String entityType, UUID entityId, Model model) {}

  /**
   * Planning factor for budgeting bulk requests before serialization. TDB2 N-Triples payloads for
   * OpenMetadata graphs run 150-250 bytes per triple (see docs/rdf-production-setup.md); 220 keeps
   * the estimate on the conservative side without serializing twice.
   */
  int ESTIMATED_BYTES_PER_TRIPLE = 220;

  int DEFAULT_MAX_UPDATE_PAYLOAD_BYTES = 4_194_304;

  int DEFAULT_MAX_APPEND_PAYLOAD_BYTES = 16_777_216;

  int DEFAULT_BULK_APPEND_ENTITY_BATCH_SIZE = 1_000;

  long DEFAULT_REQUEST_TIMEOUT_MS = 60_000L;

  static long resolveRequestTimeoutMs(RdfConfiguration config) {
    Integer configured = config != null ? config.getRequestTimeoutMs() : null;
    return configured != null && configured > 0 ? configured : DEFAULT_REQUEST_TIMEOUT_MS;
  }

  /**
   * Approximate serialized-size cap for one bulk write request. Callers budget chunks by {@link
   * #ESTIMATED_BYTES_PER_TRIPLE}; backends enforce a hard guard on the serialized body. Without a
   * cap, entity-count batching lets a batch of wide tables produce multi-MB requests that time out
   * server-side, and each same-size retry multiplies backend load.
   */
  static int resolveMaxUpdatePayloadBytes(RdfConfiguration config) {
    Integer configured = config != null ? config.getMaxUpdatePayloadBytes() : null;
    return configured != null && configured > 0 ? configured : DEFAULT_MAX_UPDATE_PAYLOAD_BYTES;
  }

  /**
   * Budget for insert-only appends. These carry no DELETE statements and are parsed by the
   * streaming RDF parser instead of the SPARQL grammar, so the backend tolerates far larger bodies
   * than a reconciling update — and fewer, larger transactions is the throughput lever that matters
   * on a single-writer store. The ceiling is indexer heap: a whole chunk is materialized as an
   * in-memory model before it is sent.
   */
  static int resolveMaxAppendPayloadBytes(RdfConfiguration config) {
    Integer configured = config != null ? config.getMaxAppendPayloadBytes() : null;
    return configured != null && configured > 0 ? configured : DEFAULT_MAX_APPEND_PAYLOAD_BYTES;
  }

  static int resolveBulkAppendEntityBatchSize(RdfConfiguration config) {
    Integer configured = config != null ? config.getBulkAppendEntityBatchSize() : null;
    return configured != null && configured > 0
        ? configured
        : DEFAULT_BULK_APPEND_ENTITY_BATCH_SIZE;
  }

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

  /** Get the exact triple count for one named graph. */
  long getTripleCount(String graphUri);

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
   * Whether this backend can create and delete datasets on demand. Blue/green rebuilds require it;
   * backends that return false fall back to clearing the served dataset in place.
   */
  default boolean supportsDatasetManagement() {
    return false;
  }

  /** Create a dataset on the configured server. No-op if it already exists. */
  default void createDatasetIfMissing(String datasetName) {
    throw new UnsupportedOperationException(
        "Dataset management is not supported by " + getStorageType());
  }

  /**
   * Remove a dataset from the server. Implementations should treat "already absent" as success.
   * Note that removal from the server does not necessarily reclaim disk — see the implementation
   * for backend-specific behaviour.
   */
  default void deleteDataset(String datasetName) {
    throw new UnsupportedOperationException(
        "Dataset management is not supported by " + getStorageType());
  }

  /** Whether the named dataset currently exists on the server. */
  default boolean datasetExists(String datasetName) {
    throw new UnsupportedOperationException(
        "Dataset management is not supported by " + getStorageType());
  }

  /** Dataset this instance currently reads and writes, or null if the backend has no concept. */
  default String currentDatasetName() {
    return null;
  }

  /**
   * Re-point this instance at another dataset on the same server, so a blue/green flip does not
   * require rebuilding every caller's storage handle.
   */
  default void repointToDataset(String datasetName) {
    throw new UnsupportedOperationException(
        "Dataset management is not supported by " + getStorageType());
  }

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
