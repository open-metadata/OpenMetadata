package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The vector index of the configured search engine. Callers reach it through {@code
 * SearchRepository.getVectorIndexService()}, never through an engine class, so every capability
 * here exists on both Elasticsearch and OpenSearch.
 */
public interface VectorIndexService {

  String VECTOR_EMBEDDING_ALIAS = "dataAssetEmbeddings";

  /**
   * Starts the error of a partition failed for good by {@link
   * #requireStagedChunkFailuresRecorded}, so the coordinator can keep the run's chunk generation
   * from going live.
   */
  String UNRECORDED_STAGED_DELETE = "Unrecorded staged chunk delete";

  EmbeddingClient getEmbeddingClient();

  /**
   * The engine's kNN clause over the embedding field, for use inside a {@code bool} or {@code
   * function_score} query. Carries the structured filters, the query filter and the context memory
   * visibility rule of {@code parameters}. {@code parameters.threshold()} is on the cosine score
   * scale {@code (1 + cosine) / 2}; 0 or less means top-k. An index whose mapping has no embedding
   * field contributes no match instead of failing its shard.
   */
  String knnQueryClause(float[] vector, VectorSearchParameters parameters);

  Map<String, Object> generateEmbeddingFields(EntityInterface<?> entity);

  void updateEntityEmbedding(EntityInterface<?> entity, String entityIndexName);

  /**
   * Multi-chunk write path (issue #4789): index one document per body chunk into the dedicated
   * chunk index so long articles are fully retrievable.
   */
  void updateEntityEmbeddingChunks(EntityInterface<?> entity);

  default void updateEntityEmbeddings(
      EntityInterface<?> entity, String indexName, String ontologyBody) {
    updateEntityEmbeddings(entity, indexName);
  }

  /**
   * Remove all chunk documents for the given parent entity (hard/soft delete cleanup). Throws when
   * the live index could not be cleared, so the caller can retry the delete.
   */
  void deleteEntityChunks(String parentId);

  /**
   * Removes, once per chunk index, the chunk documents no chunk header counts, which chunk sets
   * written before the header was a conditional write can hold. Runs in the background at startup
   * and logs a failure, which the next start retries.
   */
  void removeChunksNoHeaderCounts();

  /**
   * Strip the embedding fields from an entity document. Entity-doc embedding writes are partial
   * merges, so an entity whose repository stops considering it embeddable would otherwise keep a
   * stale {@code embedding} and stay matchable by kNN.
   */
  void clearEntityEmbedding(String entityIndexName, String entityId);

  /**
   * Combined write: refresh both the legacy entity-doc embedding (read by hybrid search) and the
   * chunk documents (read by the semantic vector path), embedding each chunk once and reusing
   * chunk 0 for the entity doc.
   */
  void updateEntityEmbeddings(EntityInterface<?> entity, String entityIndexName);

  /**
   * Reindex-sink write of prebuilt chunk documents. {@code stagedChunkTarget} is the generation
   * the run staged with {@link #beginStagedChunkRecreate}, or null to write to the live index.
   * Returns false when the chunks could not be written, a miss the caller counts and retries.
   */
  boolean writeEntityChunks(
      String parentId, List<Map<String, Object>> chunkDocs, String stagedChunkTarget);

  /**
   * Reindex-sink backfill of chunk documents for an entity whose stored embedding is reused, into
   * {@code stagedChunkTarget} or, when null, the live index. Returns false when the chunks could
   * not be written, or needed the embedding provider while it was unavailable.
   */
  boolean backfillEntityChunks(EntityInterface<?> entity, String stagedChunkTarget);

  /**
   * Reindex-sink write of an entity's embedding fields into its already indexed document in
   * {@code entityIndexName}, for an entity the run could not embed on its first attempt. Returns
   * false when the document could not be updated, a miss the caller counts.
   */
  boolean writeEntityEmbedding(
      String entityIndexName, String entityId, Map<String, Object> embeddingFields);

  /**
   * The stored entity-doc embeddings a reindex may reuse, keyed by entity id: those whose stored
   * fingerprint equals the current one.
   *
   * @param currentFingerprintById each entity's current fingerprint, computed only when a stored
   *     one exists
   */
  Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, Supplier<String>> currentFingerprintById);

  /**
   * The {@code textToLLMContext} of the {@code k} chunks of one parent entity most relevant to
   * {@code query}, resolving context memory visibility for {@code subjectContext}.
   */
  List<String> searchChunksByParent(
      String parentId, String query, int k, SubjectContext subjectContext);

  /**
   * Begins a staged recreate of the chunk index for a full-recreate run and returns the staged
   * generation, or null when nothing was staged and the run reindexes in place.
   */
  String beginStagedChunkRecreate();

  /**
   * Waits until every node's cached lookup of the staged generation, see {@link
   * #beginStagedChunkRecreate}, has expired, so a node outside the run can no longer miss {@code
   * generation}. The run calls it before it reads its first entity.
   */
  void awaitStagedGenerationDiscovery(String generation);

  /** Forgets {@code generation} as this node's staged recreate, without touching the index. */
  void clearStagedChunkState(String generation);

  /**
   * Records whether one entity type's staged entity index replaced its live index, for the run
   * that staged {@code runGeneration}. Once every expected type has finalized, the staged chunk
   * generation is promoted when all their entity indexes were.
   */
  void markEntityTypeReindexed(
      String entityType, boolean entityIndexPromoted, String runGeneration);

  /** Routes this participant node's live chunk writes to the run's staged generation as well. */
  void latchParticipantStagedTarget(String staged);

  void clearParticipantStagedTarget();

  /**
   * Throws {@link UnrecordedStagedChunkDeleteException} when this node missed a delete from the
   * run's staged generation and could not record it, so the caller's partition fails for good and
   * the generation is not promoted.
   */
  void requireStagedChunkFailuresRecorded();

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold) {
    return search(query, filters, size, from, k, threshold, null);
  }

  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference) {
    return search(query, filters, size, from, k, threshold, preference, null);
  }

  /**
   * As above, resolving context memory visibility for {@code subjectContext}. A null subject is
   * fail-closed: only org-wide memories match, so a caller that cannot identify its user never sees
   * a restricted one. Callers whose filters already exclude memories can leave it null.
   */
  default VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference,
      SubjectContext subjectContext) {
    return search(
        new VectorSearchParameters(
            query, filters, size, from, k, threshold, preference, subjectContext, null));
  }

  /** Search with a compiled query filter in addition to the structured vector filters. */
  VectorSearchResponse search(VectorSearchParameters parameters);

  String getExistingFingerprint(String indexName, String entityId);

  Map<String, String> getExistingFingerprintsBatch(String indexName, List<String> entityIds);

  String executeGenericRequest(String method, String endpoint, String body);

  default String getIndexAlias() {
    String alias = VECTOR_EMBEDDING_ALIAS;
    try {
      String clusterAlias = Entity.getSearchRepository().getClusterAlias();
      if (clusterAlias != null && !clusterAlias.isEmpty()) {
        alias = clusterAlias + "_" + VECTOR_EMBEDDING_ALIAS;
      }
    } catch (Exception ex) {
      alias = VECTOR_EMBEDDING_ALIAS;
    }
    return alias;
  }
}
