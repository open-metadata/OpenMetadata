package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingUnavailableException;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import os.org.opensearch.client.json.JsonData;
import os.org.opensearch.client.json.jackson.JacksonJsonpMapper;
import os.org.opensearch.client.opensearch.OpenSearchClient;
import os.org.opensearch.client.opensearch.core.MgetResponse;
import os.org.opensearch.client.opensearch.core.get.GetResult;
import os.org.opensearch.client.opensearch.core.mget.MultiGetResponseItem;
import os.org.opensearch.client.opensearch.generic.Body;
import os.org.opensearch.client.opensearch.generic.OpenSearchGenericClient;
import os.org.opensearch.client.opensearch.generic.Requests;

@Slf4j
public class OpenSearchVectorService implements VectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int OVER_FETCH_MULTIPLIER = 2;
  public static final String HYBRID_PIPELINE_NAME = "hybrid-rrf";

  private static volatile OpenSearchVectorService instance;

  private final OpenSearchClient client;
  @Getter private final EmbeddingClient embeddingClient;

  public OpenSearchVectorService(OpenSearchClient client, EmbeddingClient embeddingClient) {
    this.client = client;
    this.embeddingClient = embeddingClient;
  }

  public static synchronized void init(OpenSearchClient client, EmbeddingClient embeddingClient) {
    if (instance != null) {
      LOG.warn("OpenSearchVectorService already initialized, reinitializing");
      instance.shutdownPoisonRetryLoop();
    }
    instance = new OpenSearchVectorService(client, embeddingClient);
    instance.registerVectorEmbeddingHandler();
    LOG.info(
        "OpenSearchVectorService initialized with model={}, dimension={}",
        embeddingClient.getModelId(),
        embeddingClient.getDimension());
  }

  public static OpenSearchVectorService getInstance() {
    return instance;
  }

  private void registerVectorEmbeddingHandler() {
    try {
      VectorEmbeddingHandler handler = new VectorEmbeddingHandler(this);
      EntityLifecycleEventDispatcher.getInstance().registerHandler(handler);
      LOG.info("Registered VectorEmbeddingHandler for entity lifecycle events");
    } catch (Exception e) {
      LOG.error("Failed to register VectorEmbeddingHandler", e);
    }
  }

  public void close() {
    // The opensearch-java client stored here is deliberately NOT closed: it was constructed
    // elsewhere and its transport is shared with OpenSearchClient and every other manager.
    // Closing the transport from here permanently shuts down the HC5 IOReactor for the whole
    // application, which was a root cause of production "I/O reactor has been shut down" errors.
    // The poison-retry executor, however, is owned by this instance and must not outlive it.
    shutdownPoisonRetryLoop();
  }

  public void ensureHybridSearchPipeline(double keywordWeight, double semanticWeight) {
    var weights = MAPPER.createArrayNode().add(keywordWeight).add(semanticWeight);
    var combination =
        MAPPER
            .createObjectNode()
            .put("technique", "rrf")
            .put("rank_constant", 30)
            .set("parameters", MAPPER.createObjectNode().set("weights", weights));
    var scoreRanker =
        MAPPER
            .createObjectNode()
            .set(
                "score-ranker-processor",
                MAPPER.createObjectNode().set("combination", combination));

    var pipeline = MAPPER.createObjectNode();
    pipeline.set("phase_results_processors", MAPPER.createArrayNode().add(scoreRanker));

    executeGenericRequest("PUT", "/_search/pipeline/" + HYBRID_PIPELINE_NAME, pipeline.toString());
    LOG.info(
        "Hybrid search pipeline '{}' created/updated with weights keyword={}, semantic={}",
        HYBRID_PIPELINE_NAME,
        keywordWeight,
        semanticWeight);
  }

  public Optional<String> checkHybridSearchPipeline() {
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request =
          Requests.builder()
              .endpoint("/_search/pipeline/" + HYBRID_PIPELINE_NAME)
              .method("GET")
              .build();
      try (var response = genericClient.execute(request)) {
        int status = response.getStatus();
        if (status < 400) {
          return Optional.empty();
        }
        if (status == 404) {
          return Optional.of(
              "Hybrid search pipeline '"
                  + HYBRID_PIPELINE_NAME
                  + "' not found. Run a reindex to create it.");
        }
        String detail =
            response
                .getBody()
                .map(
                    b -> {
                      try {
                        String body = new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                        return body.length() > 200 ? body.substring(0, 200) : body;
                      } catch (Exception ignored) {
                        return "";
                      }
                    })
                .orElse("");
        return Optional.of(
            "Unexpected status "
                + status
                + " when checking hybrid search pipeline '"
                + HYBRID_PIPELINE_NAME
                + "'."
                + (detail.isEmpty() ? "" : " Response: " + detail));
      }
    } catch (Exception e) {
      LOG.error("Failed to check hybrid search pipeline '{}'", HYBRID_PIPELINE_NAME, e);
      return Optional.of("Failed to check hybrid search pipeline: " + e.toString());
    }
  }

  @Override
  public Map<String, Object> generateEmbeddingFields(EntityInterface entity) {
    return VectorDocBuilder.buildEmbeddingFields(entity, embeddingClient);
  }

  @Override
  public void updateEntityEmbedding(EntityInterface entity, String entityIndexName) {
    if (!embeddingClient.isAvailable()) {
      LOG.debug("Embedding provider unavailable; skipping entity {}", entity.getId());
      return;
    }
    try {
      String entityId = entity.getId().toString();
      String existingFingerprint = getExistingFingerprint(entityIndexName, entityId);
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (currentFingerprint.equals(existingFingerprint)) {
        LOG.debug("Skipping entity {} - fingerprint unchanged", entityId);
        return;
      }

      Map<String, Object> embeddingFields = generateEmbeddingFields(entity);
      partialUpdateEntity(entityIndexName, entityId, embeddingFields);
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping embedding for entity {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update embedding for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private static final String CHUNK_INDEX_BASE = "data_asset_embeddings_chunks";
  private volatile boolean chunkIndexEnsured = false;

  /**
   * Name of the dedicated chunk index (issue #4789). Lives alongside the entity indices; the
   * {@code dataAssetEmbeddings} alias is attached to it so the vector read path sees chunk docs
   * together with legacy entity-doc embeddings during migration.
   */
  public String getChunkIndexName() {
    String clusterAlias = null;
    try {
      clusterAlias = Entity.getSearchRepository().getClusterAlias();
    } catch (Exception ignored) {
      // No SearchRepository in standalone/test contexts; fall back to the unprefixed name.
    }
    return clusterAlias == null || clusterAlias.isEmpty()
        ? CHUNK_INDEX_BASE
        : clusterAlias.toLowerCase(Locale.ROOT) + "_" + CHUNK_INDEX_BASE;
  }

  @Override
  public void updateEntityEmbeddingChunks(EntityInterface entity) {
    requireChunkIndexForWrite();
    updateEntityEmbeddingChunks(entity, getChunkIndexName());
  }

  /**
   * Reindex-sink entry point for the reused-embedding backfill. During a staged recreate the write
   * must go to the staged generation — chunks written to the live target die at promotion,
   * silently dropping every unchanged entity from vector retrieval. The {@code recreateRun} flag
   * comes from the sink's own ReindexContext, so writers of normal (non-recreate) runs never
   * consult generation discovery and can never land in a crashed run's orphan.
   */
  public void backfillEntityChunks(EntityInterface entity, String stagedChunkTarget) {
    if (stagedChunkTarget == null) {
      updateEntityEmbeddingChunks(entity);
    } else {
      backfillChunksToStagedGeneration(entity, stagedChunkTarget);
    }
  }

  /**
   * Staged-recreate variant of the sink backfill: writes the entity's chunk docs into the staged
   * generation, reusing the live generation's stored vectors when the content fingerprint is
   * unchanged (the sink only takes this path for unchanged entities), so a full recreate does not
   * re-embed the whole catalog. Nothing is skipped — the staged generation starts empty, so every
   * entity passes through exactly once ({@code stagedHeader} short-circuits retries).
   */
  private void backfillChunksToStagedGeneration(EntityInterface entity, String staged) {
    try {
      String parentId = entity.getId().toString();
      String fingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
      ChunkHeader stagedHeader = getChunkHeader(staged, parentId);
      boolean alreadyBackfilled =
          stagedHeader != null
              && fingerprint.equals(stagedHeader.fingerprint())
              && !docVersionStale(stagedHeader);
      if (!alreadyBackfilled) {
        String live = getChunkIndexName();
        ChunkHeader liveHeader = getChunkHeader(live, parentId);
        List<Map<String, Object>> chunkDocs =
            (liveHeader != null && fingerprint.equals(liveHeader.fingerprint()))
                ? rebuildChunksReusingEmbeddings(entity, live, parentId, liveHeader)
                : VectorDocBuilder.fromEntity(entity, embeddingClient);
        replaceChunks(staged, parentId, chunkDocs, previousCount(stagedHeader));
      }
    } catch (Exception e) {
      recordStagedWriteFailure(staged, entity.getId().toString(), e);
    }
  }

  /**
   * Single-embed dual-target write: builds the chunk documents once (one embedding call per
   * chunk) and reuses chunk 0's embedding fields for the legacy entity-doc partial update, so a
   * content change costs N embedding calls instead of N+1. Each target keeps its own
   * fingerprint-based staleness check.
   */
  @Override
  public void updateEntityEmbeddings(EntityInterface entity, String entityIndexName) {
    if (!embeddingClient.isAvailable()) {
      LOG.debug("Embedding provider unavailable; skipping entity {}", entity.getId());
      return;
    }
    try {
      String parentId = entity.getId().toString();
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
      requireChunkIndexForWrite();
      String chunkIndexName = getChunkIndexName();
      boolean entityDocStale =
          !currentFingerprint.equals(getExistingFingerprint(entityIndexName, parentId));
      ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
      boolean fingerprintChanged =
          header == null || !currentFingerprint.equals(header.fingerprint());
      boolean chunksStale = fingerprintChanged || docVersionStale(header);
      if (entityDocStale || chunksStale) {
        // Reuse cached vectors only when nothing content-related changed and the chunks are stale
        // purely by docVersion; any content change (entity doc or chunks) re-embeds for
        // correctness.
        List<Map<String, Object>> chunkDocs =
            (chunksStale && !fingerprintChanged && !entityDocStale)
                ? rebuildChunksReusingEmbeddings(entity, chunkIndexName, parentId, header)
                : VectorDocBuilder.fromEntity(entity, embeddingClient);
        if (chunksStale) {
          replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
        }
        if (entityDocStale && !chunkDocs.isEmpty()) {
          partialUpdateEntity(entityIndexName, parentId, legacyEmbeddingFields(chunkDocs.get(0)));
        }
      }
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping embeddings for entity {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  /**
   * Write the given prebuilt chunk documents for an entity. Used by the reindex sink, which builds
   * the chunk docs itself so chunk 0 can also be spliced into the staged entity doc without a
   * second embedding pass.
   */
  public void writeEntityChunks(String parentId, List<Map<String, Object>> chunkDocs) {
    writeEntityChunks(parentId, chunkDocs, null);
  }

  /**
   * Reindex-sink chunk write. {@code stagedChunkTarget} is the staged generation created by the
   * run's own reCreateIndexes call and carried in its ReindexContext — the same propagation the
   * staged ENTITY indexes rely on — so writes are scoped to the current run by construction:
   * partial recreates and normal runs carry no target and write to the live index, and a crashed
   * run's orphan can never capture anything.
   */
  public void writeEntityChunks(
      String parentId, List<Map<String, Object>> chunkDocs, String stagedChunkTarget) {
    try {
      String target = stagedChunkTarget;
      String liveTarget = null;
      if (target == null) {
        requireChunkIndexForWrite();
        target = getChunkIndexName();
        liveTarget = target;
      }
      try {
        ChunkHeader header = getChunkHeader(target, parentId);
        replaceChunks(target, parentId, chunkDocs, previousCount(header));
      } catch (Exception e) {
        if (liveTarget == null) {
          // A hole in the staged generation becomes a silent drop at promotion — poison the run.
          recordStagedWriteFailure(target, parentId, e);
        } else {
          throw e;
        }
      }
    } catch (Exception e) {
      LOG.error("Failed to write chunk docs for {}: {}", parentId, e.getMessage(), e);
    }
  }

  /**
   * The legacy entity-doc embedding payload extracted from a chunk document: only the embedding
   * fields, never the chunk doc's trimmed filter fields (tags/domains/tier), which would clobber
   * the entity doc's rich versions of those fields on partial update.
   */
  public static Map<String, Object> legacyEmbeddingFields(Map<String, Object> chunkDoc) {
    Map<String, Object> fields = new HashMap<>();
    for (String key : EMBEDDING_SOURCE_FIELDS) {
      Object value = chunkDoc.get(key);
      if (value != null) {
        fields.put(key, value);
      }
    }
    return fields;
  }

  @Override
  public void deleteEntityChunks(String parentId) {
    // Always delete from the live index: a staged run can be abandoned, and a delete applied only
    // to the staged generation would then be lost — the deleted entity's chunks would keep
    // surfacing until the next full recreate, the exact staleness this feature exists to prevent.
    deleteChunksFrom(getChunkIndexName(), parentId);
    // Also delete from an in-flight staged generation so a promoted run does not resurrect them.
    String staged = resolveChunkSinkTarget();
    if (staged != null) {
      try {
        ChunkHeader header = getChunkHeader(staged, parentId);
        replaceChunks(staged, parentId, List.of(), previousCount(header));
      } catch (Exception e) {
        // A delete missing from the staged generation resurrects the chunks at promotion.
        recordStagedWriteFailure(staged, parentId, e);
      }
    }
  }

  private void deleteChunksFrom(String indexName, String parentId) {
    try {
      ChunkHeader header = getChunkHeader(indexName, parentId);
      replaceChunks(indexName, parentId, List.of(), previousCount(header));
    } catch (Exception e) {
      LOG.debug("Failed to delete chunks for {} from {}: {}", parentId, indexName, e.getMessage());
    }
  }

  /**
   * Progressive disclosure for a single knowledge entity (the issue #4789 payoff): KNN over just
   * this parent's chunks in the dedicated chunk index, returning the {@code textToLLMContext} of the
   * top {@code k} chunks most relevant to {@code query}. Unlike {@link #search}, results are not
   * collapsed by parent, so this yields several passages of one long article rather than a single
   * representative — the mechanism that lets a get_asset_context bundle carry only excerpts.
   */
  public List<String> searchChunksByParent(String parentId, String query, int k) {
    List<String> passages = new ArrayList<>();
    try {
      ensureChunkIndex();
      float[] vector = embeddingClient.embedQuery(query);
      Map<String, List<String>> filters = Map.of("parentId", List.of(parentId));
      String queryJson = VectorSearchQueryBuilder.build(vector, k, 0, k, filters, 0.0);
      String response =
          executeGenericRequest("POST", "/" + getChunkIndexName() + "/_search", queryJson);
      JsonNode hits = MAPPER.readTree(response).path("hits").path("hits");
      for (JsonNode hit : hits) {
        String text = hit.path("_source").path("textToLLMContext").asText(null);
        if (text != null && !text.isBlank()) {
          passages.add(text);
        }
      }
    } catch (Exception e) {
      LOG.warn("Chunk retrieval failed for parent {}: {}", parentId, e.getMessage());
    }
    return passages;
  }

  // --- Staged chunk-index recreate: generation indexes promoted behind the read alias ---
  //
  // Full-recreate runs must sweep orphaned chunks (entities deleted without events — DB restore,
  // wipe-and-remigrate), but dropping the live index up front turns any mid-run failure into a
  // retrieval outage. Instead the run writes into a bare next-generation index
  // ({chunk_base}_g<N>), invisible to reads, and only when every vector-indexable entity type
  // finalizes successfully is the generation promoted: one atomic _aliases call points the read
  // and search aliases at it and removes the previous target. Any failure before promotion leaves
  // the old chunks fully live; abandoned generations are swept at the next staged recreate.

  private final Object stagedChunkLock = new Object();
  private volatile String stagedChunkIndex;
  private volatile Set<String> stagedExpectedTypes = Set.of();
  private final Set<String> stagedCompletedTypes = ConcurrentHashMap.newKeySet();
  private volatile boolean stagedChunkRunFailed;

  /**
   * Begins a staged recreate for a full-recreate run: pre-flights the embedding client (a broken
   * client would make the whole run pointless), sweeps generations orphaned by crashed runs, and
   * creates the next generation bare — no aliases, so reads keep hitting the old chunks. Throws on
   * any failure; nothing has been destroyed at that point.
   */
  public String beginStagedChunkRecreate() {
    preflightEmbedding();
    synchronized (stagedChunkLock) {
      String base = getChunkIndexName();
      String liveTarget = resolveLiveChunkTarget(base);
      deleteOrphanChunkGenerations(base, liveTarget);
      String generation = nextChunkGenerationName(base);
      try {
        executeGenericRequest("PUT", "/" + generation, buildChunkIndexMapping(false));
      } catch (Exception e) {
        throw new RuntimeException("Failed to create staged chunk index " + generation, e);
      }
      stagedChunkIndex = generation;
      stagedExpectedTypes = Set.copyOf(AvailableEntityTypes.SET);
      stagedCompletedTypes.clear();
      stagedChunkRunFailed = false;
      LOG.info(
          "Staged chunk index {} created; chunks stay live at {} until promotion",
          generation,
          liveTarget);
      return generation;
    }
  }

  /**
   * Clears this JVM's staged-recreate state when the owning run dies before any type finalizes —
   * without this, a later unrelated run's callbacks could complete and promote the dead
   * generation. The bare generation index is left for the next staged recreate's sweep.
   */
  public void clearStagedChunkState(String generation) {
    synchronized (stagedChunkLock) {
      if (generation.equals(stagedChunkIndex)) {
        stagedChunkIndex = null;
        stagedCompletedTypes.clear();
        LOG.warn(
            "Cleared staged chunk state for {} — its run died before finalization; the "
                + "generation will be swept by the next staged recreate",
            generation);
      }
    }
  }

  /**
   * Records that an entity's chunks were knowingly skipped during a staged recreate (e.g. the
   * embedding provider's circuit is open) — a hole in the staged generation must block promotion
   * exactly like a failed write, or it becomes a silent chunk drop at the swap.
   */
  public void recordStagedChunkGap(String stagedChunkTarget, String parentId, String reason) {
    recordStagedWriteFailure(
        stagedChunkTarget, parentId, new IllegalStateException("chunk write skipped: " + reason));
  }

  private void preflightEmbedding() {
    try {
      embeddingClient.embedQuery("chunk index recreate pre-flight");
    } catch (Exception e) {
      throw new RuntimeException(
          "Refusing to start a staged chunk-index recreate: embedding client pre-flight failed", e);
    }
  }

  /**
   * Records one entity type's reindex outcome for an active staged chunk recreate. A failed type
   * poisons the run — the old generation stays live and the staged one is swept by the next
   * recreate. Once every vector-indexable type completes successfully, the staged generation is
   * promoted atomically. No-op when no staged recreate is active or for non-vector types.
   */
  public void markEntityTypeReindexed(String entityType, boolean success, String runGeneration) {
    String normalized = entityType == null ? null : entityType.toLowerCase(Locale.ROOT);
    String generation = stagedChunkIndex;
    if (generation != null && runGeneration != null && !generation.equals(runGeneration)) {
      // Mark from a different run than the one that staged this generation — never count it.
      LOG.warn(
          "Ignoring chunk-type mark for {} bound to run generation {} while {} is staged",
          entityType,
          runGeneration,
          generation);
      return;
    }
    if (generation != null && runGeneration == null && normalized != null) {
      // A run WITHOUT chunk staging is finalizing types while staged state lingers on this JVM —
      // stale leftovers of a dead run. Never count these marks toward promotion.
      LOG.warn(
          "Ignoring unbound chunk-type mark for {} — staged generation {} belongs to a dead run "
              + "and will be swept by the next staged recreate",
          entityType,
          generation);
      return;
    }
    if (stagedChunkIndex != null
        && normalized != null
        && stagedExpectedTypes.contains(normalized)) {
      if (success) {
        stagedCompletedTypes.add(normalized);
        if (!stagedChunkRunFailed && stagedCompletedTypes.containsAll(stagedExpectedTypes)) {
          promoteStagedChunkIndex();
        }
      } else {
        stagedChunkRunFailed = true;
        // Poison only — never delete mid-run: writers on other nodes may still be flushing into
        // the generation, and a write against a deleted index auto-creates a junk index. The
        // un-promoted generation is swept by the next staged recreate.
        LOG.warn(
            "Staged chunk recreate: entity type {} failed to reindex — promotion blocked, old "
                + "chunks stay live; staged index {} will be swept by the next recreate",
            entityType,
            stagedChunkIndex);
      }
    }
  }

  /**
   * Points the read and search aliases at the staged generation and removes the previous target in
   * one atomic {@code _aliases} call — no window where reads see neither or both generations.
   */
  private void promoteStagedChunkIndex() {
    synchronized (stagedChunkLock) {
      String generation = stagedChunkIndex;
      if (generation != null
          && (stagedChunkRunFailed || pendingPoisonMarkers.contains(generation))) {
        // Re-check under the lock: a concurrent live-delete failure may have poisoned the run
        // between the caller's check and this swap.
        LOG.warn(
            "Staged chunk index {} poisoned by a concurrent write failure — promotion blocked",
            generation);
        stagedChunkIndex = null;
        generation = null;
      }
      if (generation != null && stagedGenerationPoisoned(generation)) {
        LOG.warn(
            "Staged chunk index {} carries a write-failure poison marker — promotion blocked, "
                + "old chunks stay live; the generation will be swept by the next recreate",
            generation);
        stagedChunkIndex = null;
        generation = null;
      }
      if (generation != null) {
        String base = getChunkIndexName();
        String oldTarget = resolveLiveChunkTarget(base);
        try {
          executeGenericRequest(
              "POST",
              "/_aliases",
              buildChunkPromoteActions(generation, base, getSearchAlias(), oldTarget));
        } catch (Exception e) {
          throw new RuntimeException("Failed to promote staged chunk index " + generation, e);
        }
        stagedChunkIndex = null;
        chunkIndexEnsured = true;
        LOG.info("Promoted staged chunk index {} (previous target: {})", generation, oldTarget);
      }
    }
  }

  private static final String STAGED_POISON_DOC_PREFIX = "__staged_write_failure__";
  private static final int POISON_SIGNAL_ATTEMPTS = 3;

  private static String poisonDocId(String generation) {
    return STAGED_POISON_DOC_PREFIX + generation;
  }

  /**
   * Records a failed write against the staged generation: sets the local poison flag and writes a
   * generation-scoped marker document into the LIVE chunk index — deliberately NOT the staged
   * generation, whose unavailability may be the very reason the write failed. The live index is
   * the store promotion already depends on (the swap removes it), so a coordinator that can
   * promote can necessarily observe the marker; and a successful promotion of a later run removes
   * the old live index and its stale markers with it. The marker carries no embedding or parentId,
   * so it is invisible to every chunk query.
   */
  private void recordStagedWriteFailure(String target, String parentId, Exception e) {
    stagedChunkRunFailed = true;
    LOG.error(
        "Staged chunk write failed for {} in {} — promotion will be blocked so the old chunks "
            + "stay live: {}",
        parentId,
        target,
        e.getMessage(),
        e);
    String liveIndex = resolveLiveChunkTarget(getChunkIndexName());
    // Dual-location signal: the live index first (the store promotion must be able to read
    // anyway), the staged generation itself as fallback — a transient blip on one store at
    // failure time must not let a later, recovered promotion read "clean". Fresh installs have
    // no live index (and nothing to lose at the swap); writing to the bare base name would
    // auto-create a junk index squatting on the promotion alias name.
    boolean recorded = liveIndex != null && writePoisonMarker(liveIndex, target);
    if (!recorded) {
      recorded = writePoisonMarker(target, target);
    }
    if (!recorded) {
      // Neither store took the signal right now. Throwing here is useless — the sink's broad
      // embedding catch swallows it — so instead the marker is queued for persistent retry: a
      // daemon loop re-attempts it every few seconds until one store accepts it. Promotion
      // happens at run end, long after any transient blip recovers, so the signal arrives late
      // rather than never.
      pendingPoisonMarkers.add(target);
      ensurePoisonRetryLoop();
      LOG.error(
          "Staged poison marker for {} could not be recorded anywhere — queued for persistent "
              + "retry until a store accepts it",
          target);
    }
  }

  private final Set<String> pendingPoisonMarkers = ConcurrentHashMap.newKeySet();
  private volatile ScheduledExecutorService poisonRetryExecutor;

  /**
   * Check-and-create must stay atomic with {@link #stopPoisonRetryLoop}'s check-and-destroy
   * (same lock, no lock-free fast path): reading the executor outside the lock can observe an
   * instance the retry thread is about to shut down, skip scheduling, and strand the just-queued
   * marker with no loop left to persist it.
   */
  private void ensurePoisonRetryLoop() {
    synchronized (stagedChunkLock) {
      if (poisonRetryExecutor == null) {
        poisonRetryExecutor =
            Executors.newSingleThreadScheduledExecutor(
                runnable -> {
                  Thread thread = new Thread(runnable, "chunk-poison-marker-retry");
                  thread.setDaemon(true);
                  return thread;
                });
        poisonRetryExecutor.scheduleWithFixedDelay(
            this::retryPendingPoisonMarkers, 5, 15, TimeUnit.SECONDS);
      }
    }
  }

  private void retryPendingPoisonMarkers() {
    for (String generation : pendingPoisonMarkers) {
      if (!indexExists(generation)) {
        // The generation was swept — its run is dead and can never be promoted, so the signal is
        // moot. Writing anyway would auto-create a phantom index squatting on the dead name.
        pendingPoisonMarkers.remove(generation);
        continue;
      }
      String liveIndex = resolveLiveChunkTarget(getChunkIndexName());
      boolean recorded =
          (liveIndex != null && writePoisonMarker(liveIndex, generation))
              || writePoisonMarker(generation, generation);
      if (recorded) {
        pendingPoisonMarkers.remove(generation);
        LOG.info("Persistent retry recorded staged poison marker for {}", generation);
      }
    }
    if (pendingPoisonMarkers.isEmpty()) {
      stopPoisonRetryLoop();
    }
  }

  private boolean indexExists(String indexName) {
    try {
      return client.indices().exists(x -> x.index(indexName)).value();
    } catch (Exception e) {
      // Unknown — keep the marker pending rather than dropping a live signal.
      return true;
    }
  }

  private void stopPoisonRetryLoop() {
    synchronized (stagedChunkLock) {
      if (poisonRetryExecutor != null && pendingPoisonMarkers.isEmpty()) {
        poisonRetryExecutor.shutdown();
        poisonRetryExecutor = null;
      }
    }
  }

  /**
   * Unconditional teardown for instance shutdown/replacement — unlike {@link
   * #stopPoisonRetryLoop}, this stops the loop even with markers still pending (a retry thread
   * held past {@code close()} would spin against a stale client). The instance's staged-run gate
   * state dies with it, so the affected generation can never be promoted anyway — it is swept,
   * unpromoted, by the next staged recreate.
   */
  private void shutdownPoisonRetryLoop() {
    synchronized (stagedChunkLock) {
      if (poisonRetryExecutor != null) {
        poisonRetryExecutor.shutdownNow();
        poisonRetryExecutor = null;
      }
      if (!pendingPoisonMarkers.isEmpty()) {
        LOG.warn(
            "Vector service closing with {} unpersisted staged poison marker(s): {} — the "
                + "affected staged generation(s) are swept unpromoted by the next recreate",
            pendingPoisonMarkers.size(),
            pendingPoisonMarkers);
        pendingPoisonMarkers.clear();
      }
    }
  }

  private boolean writePoisonMarker(String indexName, String generation) {
    for (int attempt = 1; attempt <= POISON_SIGNAL_ATTEMPTS; attempt++) {
      try {
        // refresh=true makes the marker search-visible immediately — promotion may check within
        // the same second, before a periodic refresh would surface it.
        executeGenericRequest(
            "PUT",
            "/" + indexName + "/_doc/" + poisonDocId(generation) + "?refresh=true",
            "{\"poisoned\":true}");
        return true;
      } catch (Exception markerFailure) {
        LOG.warn(
            "Staged poison marker write to {} failed (attempt {}/{}): {}",
            indexName,
            attempt,
            POISON_SIGNAL_ATTEMPTS,
            markerFailure.getMessage());
      }
    }
    return false;
  }

  /**
   * True when any node recorded a failed write against this staged generation. The marker lives in
   * the LIVE chunk index (see {@link #recordStagedWriteFailure}); the check uses search-by-id so
   * "no marker" is an unambiguous 200 with zero hits (a GET 404 is indistinguishable from a
   * transport error here). Read errors retry and then FAIL CLOSED: promoting a generation whose
   * integrity cannot be verified risks the silent chunk drop this whole feature exists to prevent,
   * while blocking costs only a rerun.
   */
  private boolean stagedGenerationPoisoned(String generation) {
    String liveIndex = resolveLiveChunkTarget(getChunkIndexName());
    // Check both marker locations: the live index (primary) and the generation itself (the
    // fallback used when the live index rejected the marker write). Fresh installs have no live
    // index — and nothing to lose at the swap — so only the generation check runs.
    boolean poisoned = markerPresent(generation, generation);
    if (!poisoned && liveIndex != null) {
      poisoned = markerPresent(liveIndex, generation);
    }
    return poisoned;
  }

  private boolean markerPresent(String indexName, String generation) {
    String query =
        "{\"size\":0,\"query\":{\"ids\":{\"values\":[\"" + poisonDocId(generation) + "\"]}}}";
    for (int attempt = 1; attempt <= POISON_SIGNAL_ATTEMPTS; attempt++) {
      try {
        String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
        long hits = MAPPER.readTree(response).path("hits").path("total").path("value").asLong(0);
        return hits > 0;
      } catch (Exception e) {
        LOG.warn(
            "Staged poison marker check failed for {} (attempt {}/{}): {}",
            generation,
            attempt,
            POISON_SIGNAL_ATTEMPTS,
            e.getMessage());
      }
    }
    LOG.error(
        "Staged poison marker check kept failing for {} — failing closed: promotion blocked, "
            + "old chunks stay live, generation swept by the next recreate",
        generation);
    return true;
  }

  private static final long SINK_TARGET_CACHE_MS = 15_000;
  private volatile String cachedSinkTarget;
  private volatile long cachedSinkTargetAt;

  /**
   * Additional delete target for live chunk deletes: the coordinator's staged generation when this
   * JVM began the recreate, else the newest un-promoted generation found in cluster state (short
   * cache). Sink WRITES no longer use discovery — they receive the run-scoped target explicitly
   * via ReindexContext — so this only serves deletes, where hitting a crashed run's orphan is
   * harmless idempotent removal.
   */
  private String resolveChunkSinkTarget() {
    String target = stagedChunkIndex;
    if (target == null) {
      long now = System.currentTimeMillis();
      if (now - cachedSinkTargetAt > SINK_TARGET_CACHE_MS) {
        cachedSinkTarget = findActiveStagedGeneration();
        cachedSinkTargetAt = now;
      }
      target = cachedSinkTarget;
    }
    return target;
  }

  /** Newest generation index not yet holding the read alias, or null when none exists. */
  private String findActiveStagedGeneration() {
    String base = getChunkIndexName();
    String result = null;
    long best = 0;
    try {
      JsonNode response = MAPPER.readTree(executeGenericRequest("GET", "/" + base + "_g*", null));
      Iterator<String> names = response.fieldNames();
      while (names.hasNext()) {
        String name = names.next();
        boolean promoted = response.path(name).path("aliases").has(base);
        long generation = chunkGenerationNumber(name, base);
        if (!promoted && generation > best) {
          best = generation;
          result = name;
        }
      }
    } catch (Exception e) {
      LOG.debug("Staged chunk generation lookup failed: {}", e.getMessage());
    }
    return result;
  }

  /**
   * {@code _aliases} actions promoting a generation: attach the read alias and the search alias,
   * and atomically remove the previous target (the legacy physical index on first promotion, an
   * older generation afterwards). Null {@code oldTarget} (fresh install) emits no removal.
   */
  static String buildChunkPromoteActions(
      String generation, String readAlias, String searchAlias, String oldTarget) {
    var actions = MAPPER.createArrayNode();
    actions.add(
        MAPPER
            .createObjectNode()
            .set(
                "add", MAPPER.createObjectNode().put("index", generation).put("alias", readAlias)));
    actions.add(
        MAPPER
            .createObjectNode()
            .set(
                "add",
                MAPPER.createObjectNode().put("index", generation).put("alias", searchAlias)));
    if (oldTarget != null && !oldTarget.equals(generation)) {
      actions.add(
          MAPPER
              .createObjectNode()
              .set("remove_index", MAPPER.createObjectNode().put("index", oldTarget)));
    }
    ObjectNode body = MAPPER.createObjectNode();
    body.set("actions", actions);
    return body.toString();
  }

  /**
   * The physical index currently serving chunk reads: the alias target when the read name is an
   * alias (post-promotion layout), the legacy physical index when it exists under the read name,
   * or null on a fresh install.
   */
  private String resolveLiveChunkTarget(String base) {
    String target = null;
    try {
      String response = executeGenericRequest("GET", "/_alias/" + base, null);
      Iterator<String> names = MAPPER.readTree(response).fieldNames();
      if (names.hasNext()) {
        target = names.next();
      }
    } catch (Exception e) {
      LOG.debug("No alias named {} — checking for a legacy physical index", base);
    }
    if (target == null) {
      try {
        if (client.indices().exists(x -> x.index(base)).value()) {
          target = base;
        }
      } catch (Exception e) {
        LOG.warn("Could not resolve live chunk target for {}: {}", base, e.getMessage());
      }
    }
    return target;
  }

  /**
   * Sweeps generation indexes that are not the live target — leftovers of crashed or never-promoted
   * staged runs. Runs before creating the next generation, so an orphan can never swallow writes.
   */
  private void deleteOrphanChunkGenerations(String base, String liveTarget) {
    try {
      String response = executeGenericRequest("GET", "/" + base + "_g*", null);
      Iterator<String> names = MAPPER.readTree(response).fieldNames();
      while (names.hasNext()) {
        String name = names.next();
        if (!name.equals(liveTarget)) {
          deleteOrphanGeneration(name);
        }
      }
    } catch (Exception e) {
      LOG.warn("Orphaned chunk generation sweep failed: {}", e.getMessage());
    }
  }

  private void deleteOrphanGeneration(String name) {
    try {
      executeGenericRequest("DELETE", "/" + name, null);
      LOG.info("Deleted orphaned staged chunk index {}", name);
    } catch (Exception e) {
      LOG.warn("Failed to delete orphaned staged chunk index {}: {}", name, e.getMessage());
    }
  }

  /** Generation stamp of a chunk index name, or 0 for the legacy physical / non-generation name. */
  static long chunkGenerationNumber(String indexName, String chunkBase) {
    long number = 0;
    String prefix = chunkBase + "_g";
    if (indexName != null && indexName.startsWith(prefix)) {
      try {
        number = Long.parseLong(indexName.substring(prefix.length()));
      } catch (NumberFormatException e) {
        number = 0;
      }
    }
    return number;
  }

  /**
   * Run-unique generation name (epoch-millis stamp). Uniqueness matters twice: a blocked run's
   * poison marker (keyed by generation name) must never match a later run's generation, and a
   * pending promote from a superseded run must fail loudly on a missing index rather than
   * silently aliasing another run's half-built one.
   */
  static String nextChunkGenerationName(String chunkBase) {
    return chunkBase + "_g" + System.currentTimeMillis();
  }

  /**
   * Write-path gate: throws when the chunk index could not be ensured. A raw write against a
   * missing index would auto-create it with dynamic mappings ({@code embedding} as float, not
   * knn_vector), permanently wedging vector search until manual index surgery — worse than the
   * skipped write. Read paths stay lenient: reads cannot auto-create an index.
   */
  private void requireChunkIndexForWrite() {
    ensureChunkIndex();
    if (!chunkIndexEnsured) {
      throw new IllegalStateException(
          "Vector chunk index unavailable (create/upgrade failed); refusing chunk write that "
              + "would auto-create it with a non-knn mapping");
    }
  }

  private void ensureChunkIndex() {
    if (!chunkIndexEnsured) {
      synchronized (this) {
        if (!chunkIndexEnsured) {
          // Only latch on success so a transient failure (e.g. OpenSearch outage during startup)
          // is retried on the next write instead of disabling chunk indexing until restart.
          chunkIndexEnsured = createChunkIndexIfAbsent();
        }
      }
    }
  }

  private boolean createChunkIndexIfAbsent() {
    String base = getChunkIndexName();
    boolean ensured = false;
    try {
      // Post-promotion the read name is an alias over the live generation; operate on the
      // resolved physical target. On a fresh install, create the legacy physical layout —
      // generations appear at the first staged recreate.
      String target = resolveLiveChunkTarget(base);
      if (target == null) {
        executeGenericRequest("PUT", "/" + base, buildChunkIndexMapping(true));
        LOG.info("Created dedicated vector chunk index {}", base);
        ensured = true;
      } else {
        // The search alias is normally attached at creation, but an index left over from a partial
        // or manual setup may miss it — and reads via the alias would then silently skip all chunk
        // docs. The alias PUT is idempotent. Only report "ensured" once the mapping is at the
        // current version so a failed upgrade does not latch (and so docs are not stamped with the
        // new docVersion into a still-stale mapping).
        executeGenericRequest("PUT", "/" + target + "/_alias/" + getSearchAlias(), "{}");
        ensured = applyChunkMappingUpgradeIfStale(target);
      }
    } catch (Exception e) {
      LOG.error("Failed to ensure chunk index {}: {}", base, e.getMessage());
    }
    return ensured;
  }

  /**
   * When the chunk index already exists, compare its {@code _meta.chunkDocVersion} against the code
   * {@link VectorDocBuilder#CHUNK_DOC_VERSION}; if the index is older, apply the additive
   * {@code PUT _mapping} so the new denormalized fields become mappable. This is legal on a
   * {@code dynamic:false} index and safe pre-backfill: old docs simply lack the new fields until a
   * Search Reindex re-materializes them (the reindex reuses embeddings, so there is no re-embed
   * cost — see {@link #updateEntityEmbeddingChunks(EntityInterface, String)}).
   *
   * @return {@code true} when the index is (already or now) at the current version; {@code false}
   *     when the upgrade could not be applied, so the caller leaves the index un-ensured and the
   *     PUT is retried on the next write rather than silently proceeding with a stale mapping.
   */
  private boolean applyChunkMappingUpgradeIfStale(String indexName) {
    try {
      String mappingJson = executeGenericRequest("GET", "/" + indexName + "/_mapping", null);
      JsonNode mappings = MAPPER.readTree(mappingJson).path(indexName).path("mappings");
      int existingVersion = mappings.path("_meta").path("chunkDocVersion").asInt(0);
      if (existingVersion >= VectorDocBuilder.CHUNK_DOC_VERSION) {
        return true;
      }
      executeGenericRequest("PUT", "/" + indexName + "/_mapping", buildChunkMappingUpgradeBody());
      LOG.info(
          "Upgraded chunk index {} mapping chunkDocVersion {} -> {} (denormalized fields backfill "
              + "on next Search Reindex)",
          indexName,
          existingVersion,
          VectorDocBuilder.CHUNK_DOC_VERSION);
      return true;
    } catch (Exception e) {
      LOG.error(
          "Failed to upgrade chunk index {} mapping; leaving it un-ensured to retry on the next "
              + "write rather than stamping docs with the new docVersion into a stale mapping: {}",
          indexName,
          e.getMessage());
      return false;
    }
  }

  private String buildChunkIndexMapping(boolean withSearchAlias) {
    var mappings = MAPPER.createObjectNode().put("dynamic", false);
    mappings.set("properties", buildChunkProperties());
    mappings.set("_meta", chunkMeta());
    var root = MAPPER.createObjectNode();
    root.set(
        "settings",
        MAPPER.createObjectNode().set("index", MAPPER.createObjectNode().put("knn", true)));
    root.set("mappings", mappings);
    // Staged generations are created bare: attaching the search alias before promotion would make
    // the half-built generation searchable alongside the live one.
    if (withSearchAlias) {
      root.set(
          "aliases", MAPPER.createObjectNode().set(getSearchAlias(), MAPPER.createObjectNode()));
    }
    return root.toString();
  }

  /**
   * Additive {@code PUT _mapping} body applied by {@link #applyChunkMappingUpgradeIfStale}. Sends the
   * property set <b>minus the {@code embedding} knn_vector</b> plus the bumped
   * {@code _meta.chunkDocVersion}. Re-declaring the existing {@code knn_vector} is rejected by some
   * OpenSearch versions/plugins even with identical parameters; because {@code PUT _mapping} is
   * atomic, that would fail the whole request and silently leave the genuinely new denormalized
   * fields unmapped (on a {@code dynamic:false} index) while docs are still stamped with the new
   * {@code docVersion} — defeating the rollout. Omitting the unchanged vector avoids that
   * all-or-nothing failure; the remaining fields are additive (new fields) or legal no-ops
   * (unchanged keyword/text/integer). Absent-on-old-docs fields simply do not match until a Search
   * Reindex backfills them, so there is zero regression before the backfill runs.
   */
  private String buildChunkMappingUpgradeBody() {
    ObjectNode properties = buildChunkProperties();
    properties.remove("embedding");
    var body = MAPPER.createObjectNode();
    body.set("properties", properties);
    body.set("_meta", chunkMeta());
    return body.toString();
  }

  private ObjectNode chunkMeta() {
    return MAPPER.createObjectNode().put("chunkDocVersion", VectorDocBuilder.CHUNK_DOC_VERSION);
  }

  private ObjectNode buildChunkProperties() {
    var method =
        MAPPER
            .createObjectNode()
            .put("name", "hnsw")
            .put("engine", "lucene")
            .put("space_type", "cosinesimil")
            .set("parameters", MAPPER.createObjectNode().put("m", 48).put("ef_construction", 256));
    var embedding =
        MAPPER
            .createObjectNode()
            .put("type", "knn_vector")
            .put("dimension", embeddingClient.getDimension())
            .set("method", method);
    var properties = MAPPER.createObjectNode();
    properties.set("embedding", embedding);
    for (String keyword :
        List.of("parentId", "fingerprint", "entityType", "fullyQualifiedName", "serviceType")) {
      properties.set(keyword, MAPPER.createObjectNode().put("type", "keyword"));
    }
    // name/displayName keep a keyword root but gain a `.keyword` subfield so the shard-fair exact
    // (case_insensitive term) clauses, which target `<field>.keyword`, resolve on chunk docs.
    for (String keywordWithSub : List.of("name", "displayName")) {
      properties.set(keywordWithSub, keywordWithKeywordSubfield());
    }
    for (String integer : List.of("chunkIndex", "chunkCount", "docVersion")) {
      properties.set(integer, MAPPER.createObjectNode().put("type", "integer"));
    }
    // Analyzed lexical parity fields. The dedicated chunk index defines no custom analyzers, so
    // these use the default standard analyzer; full om_analyzer/compound parity is a Phase 4
    // index recreate.
    for (String text :
        List.of("textToEmbed", "textToLLMContext", "description", "fqnParts", "synonyms")) {
      properties.set(text, MAPPER.createObjectNode().put("type", "text"));
    }
    properties.set("deleted", MAPPER.createObjectNode().put("type", "boolean"));
    properties.set("tags", objectKeyword("tagFQN"));
    properties.set("domains", objectKeyword("name"));
    properties.set("tier", objectKeyword("tagFQN"));
    properties.set("certification", certificationMapping());
    // owners is a `nested` type: NLQ owner filters run a nested query over owners.name.
    properties.set("owners", nestedNameKeyword());
    properties.set("service", nameDisplayNameObject());
    properties.set("database", nameDisplayNameObject());
    // Map name+displayName like service/database: buildDenormalizedFields copies both onto the
    // chunk doc, so mapping only `name` would leave the denormalized displayName in _source but
    // unindexed (dynamic:false), silently unfilterable and inconsistent with the entity index.
    properties.set("databaseSchema", nameDisplayNameObject());
    properties.set("columns", columnsMapping());
    properties.set(
        "relatedTerms", MAPPER.createObjectNode().put("type", "object").put("enabled", false));
    return properties;
  }

  private ObjectNode keywordWithKeywordSubfield() {
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .put("type", "keyword")
            .set(
                "fields",
                MAPPER
                    .createObjectNode()
                    .set("keyword", MAPPER.createObjectNode().put("type", "keyword")));
  }

  private ObjectNode objectKeyword(String field) {
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .set(
                "properties",
                MAPPER
                    .createObjectNode()
                    .set(field, MAPPER.createObjectNode().put("type", "keyword")));
  }

  private ObjectNode nestedNameKeyword() {
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .put("type", "nested")
            .set(
                "properties",
                MAPPER
                    .createObjectNode()
                    .set("name", MAPPER.createObjectNode().put("type", "keyword")));
  }

  private ObjectNode nameDisplayNameObject() {
    var props = MAPPER.createObjectNode();
    props.set("name", MAPPER.createObjectNode().put("type", "keyword"));
    props.set("displayName", MAPPER.createObjectNode().put("type", "keyword"));
    return (ObjectNode) MAPPER.createObjectNode().set("properties", props);
  }

  private ObjectNode certificationMapping() {
    var tagLabel = objectKeyword("tagFQN");
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .put("type", "object")
            .set("properties", MAPPER.createObjectNode().set("tagLabel", tagLabel));
  }

  private ObjectNode columnsMapping() {
    var name = keywordWithKeywordSubfield();
    return (ObjectNode)
        MAPPER.createObjectNode().set("properties", MAPPER.createObjectNode().set("name", name));
  }

  /**
   * Multi-chunk write path (issue #4789): index one standalone document per body chunk into the
   * dedicated chunk index, keyed {@code <parentId>_<chunkIndex>}. Skips work when the whole-body
   * fingerprint is unchanged. Chunk ids are deterministic, so a shrinking body is handled by
   * bulk-deleting the trailing stale ids in the same request — no delete-by-query and no forced
   * refresh on this hot path; visibility follows the index refresh interval.
   */
  public void updateEntityEmbeddingChunks(EntityInterface entity, String chunkIndexName) {
    try {
      String parentId = entity.getId().toString();
      ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
      boolean fingerprintChanged =
          header == null || !currentFingerprint.equals(header.fingerprint());
      boolean docVersionStale = docVersionStale(header);
      if (!fingerprintChanged && !docVersionStale) {
        LOG.debug("Skipping chunk embedding for {} - fingerprint and docVersion current", parentId);
        return;
      }
      // docVersion-only staleness (content unchanged) reuses the stored vectors so a mapping
      // upgrade
      // backfills with zero embedding-provider cost; a content change re-embeds as before.
      List<Map<String, Object>> chunkDocs =
          (docVersionStale && !fingerprintChanged)
              ? rebuildChunksReusingEmbeddings(entity, chunkIndexName, parentId, header)
              : VectorDocBuilder.fromEntity(entity, embeddingClient);
      replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping chunk embeddings for {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update chunk embeddings for {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  /**
   * Rebuild an entity's chunk docs for a docVersion migration by reusing the embeddings already
   * stored on those chunk docs (fingerprint unchanged ⇒ same body ⇒ same chunking ⇒ 1:1 reusable
   * vectors), so only the denormalized fields and {@code docVersion} change and no embedding call is
   * made. Falls back to a full re-embed if the cached vectors can't all be recovered (partial/corrupt
   * chunk set) or the re-chunk disagrees with the cached count.
   */
  private List<Map<String, Object>> rebuildChunksReusingEmbeddings(
      EntityInterface entity, String chunkIndexName, String parentId, ChunkHeader header) {
    Map<Integer, float[]> vectors =
        fetchExistingChunkVectors(chunkIndexName, parentId, header.chunkCount());
    if (vectors.size() != header.chunkCount()) {
      LOG.info(
          "Chunk docVersion rebuild for {} recovered {}/{} cached vectors; re-embedding",
          parentId,
          vectors.size(),
          header.chunkCount());
      return VectorDocBuilder.fromEntity(entity, embeddingClient);
    }
    try {
      return VectorDocBuilder.fromEntityReusingEmbeddings(entity, vectors);
    } catch (RuntimeException e) {
      LOG.info(
          "Chunk docVersion rebuild for {} fell back to re-embedding: {}",
          parentId,
          e.getMessage());
      return VectorDocBuilder.fromEntity(entity, embeddingClient);
    }
  }

  /**
   * Batch-fetch the stored embedding vectors for an entity's chunk docs ({@code <parentId>_0..N-1}),
   * keyed by {@code chunkIndex}. Pulls only {@code embedding}+{@code chunkIndex} so the large vector
   * payload is the only thing on the wire.
   */
  private Map<Integer, float[]> fetchExistingChunkVectors(
      String chunkIndexName, String parentId, int chunkCount) {
    Map<Integer, float[]> vectors = new HashMap<>();
    if (chunkCount <= 0) {
      return vectors;
    }
    try {
      List<String> ids = new ArrayList<>(chunkCount);
      for (int i = 0; i < chunkCount; i++) {
        ids.add(parentId + "_" + i);
      }
      MgetResponse<JsonData> response =
          client.mget(
              m ->
                  m.index(chunkIndexName)
                      .ids(ids)
                      .sourceIncludes(List.of("embedding", "chunkIndex")),
              JsonData.class);
      for (MultiGetResponseItem<JsonData> item : response.docs()) {
        if (!item.isResult()) {
          continue;
        }
        GetResult<JsonData> doc = item.result();
        if (!doc.found() || doc.source() == null) {
          continue;
        }
        JsonNode source = doc.source().to(JsonNode.class, JACKSON_JSONP_MAPPER);
        float[] vector = toFloatArray(source.path("embedding"));
        if (vector != null) {
          vectors.put(source.path("chunkIndex").asInt(0), vector);
        }
      }
    } catch (Exception e) {
      LOG.debug("Failed to fetch existing chunk vectors for {}: {}", parentId, e.getMessage());
    }
    return vectors;
  }

  private static float[] toFloatArray(JsonNode node) {
    if (node == null || !node.isArray() || node.isEmpty()) {
      return null;
    }
    float[] out = new float[node.size()];
    for (int i = 0; i < node.size(); i++) {
      out[i] = (float) node.get(i).asDouble();
    }
    return out;
  }

  /** Header of an entity's chunk set, read from chunk 0. */
  private record ChunkHeader(String fingerprint, int chunkCount, int docVersion) {}

  private static boolean docVersionStale(ChunkHeader header) {
    return header != null && header.docVersion() < VectorDocBuilder.CHUNK_DOC_VERSION;
  }

  private static int previousCount(ChunkHeader header) {
    return header == null ? 0 : header.chunkCount();
  }

  /**
   * Real-time by-id GET of chunk 0's fingerprint and chunkCount. A GET by id sees un-refreshed
   * writes, so staleness checks and stale-id deletes never race the refresh interval, and it is
   * far cheaper than the {@code _search} it replaces on the per-entity write path.
   */
  private ChunkHeader getChunkHeader(String indexName, String parentId) {
    ChunkHeader header = null;
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request =
          Requests.builder()
              .endpoint(
                  "/"
                      + indexName
                      + "/_doc/"
                      + parentId
                      + "_0?_source_includes=fingerprint,chunkCount,docVersion")
              .method("GET")
              .build();
      try (var response = genericClient.execute(request)) {
        if (response.getStatus() < 400) {
          String body =
              response
                  .getBody()
                  .map(
                      b -> {
                        try {
                          return new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                        } catch (Exception ignored) {
                          return "{}";
                        }
                      })
                  .orElse("{}");
          JsonNode root = MAPPER.readTree(body);
          if (root.path("found").asBoolean(false)) {
            JsonNode source = root.path("_source");
            header =
                new ChunkHeader(
                    source.path("fingerprint").asText(null),
                    source.path("chunkCount").asInt(0),
                    source.path("docVersion").asInt(0));
          }
        }
      }
    } catch (Exception e) {
      LOG.debug("No chunk header for {} in {}: {}", parentId, indexName, e.getMessage());
    }
    return header;
  }

  /**
   * One bulk request that overwrites chunk ids {@code 0..N-1} and deletes the trailing stale ids
   * {@code N..previousCount-1} left behind by a shrinking body. Deletes are by id, so they do not
   * depend on search visibility of prior writes.
   */
  private void replaceChunks(
      String indexName, String parentId, List<Map<String, Object>> chunkDocs, int previousCount)
      throws IOException {
    if (previousCount == 0) {
      cleanOrphanChunks(indexName, parentId);
    }
    if (chunkDocs.isEmpty() && previousCount == 0) {
      return;
    }
    StringBuilder bulk = new StringBuilder();
    for (int i = 0; i < chunkDocs.size(); i++) {
      bulk.append("{\"index\":{\"_index\":\"")
          .append(indexName)
          .append("\",\"_id\":\"")
          .append(parentId)
          .append('_')
          .append(i)
          .append("\"}}\n")
          .append(MAPPER.writeValueAsString(chunkDocs.get(i)))
          .append('\n');
    }
    appendChunkDeletes(bulk, indexName, parentId, chunkDocs.size(), previousCount);
    String response = executeGenericRequest("POST", "/_bulk", bulk.toString());
    failOnBulkItemErrors(indexName, parentId, response);
  }

  /**
   * The bulk API reports per-item failures (rejected executions under load, mapping conflicts) as
   * HTTP 200 with {@code errors:true} — exactly the failure class a heavy reindex produces.
   * Silently accepting them would leave holes that, in a staged generation, become silent chunk
   * drops at promotion; throwing routes the failure into the callers' poison/log handling.
   */
  private void failOnBulkItemErrors(String indexName, String parentId, String response) {
    try {
      JsonNode root = MAPPER.readTree(response);
      if (!root.path("errors").asBoolean(false)) {
        return;
      }
      StringBuilder reasons = new StringBuilder();
      int reported = 0;
      for (JsonNode item : root.path("items")) {
        // replaceChunks emits index AND delete actions (trailing-chunk cleanup); create for
        // completeness — each item is keyed by whichever action it was.
        for (String action : BULK_ACTIONS) {
          JsonNode error = item.path(action).path("error");
          if (!error.isMissingNode() && reported < 3) {
            reasons.append(action).append(' ');
            reasons.append(error.path("type").asText("?")).append(": ");
            reasons.append(error.path("reason").asText("?")).append("; ");
            reported++;
          }
        }
      }
      throw new IllegalStateException(
          "Bulk chunk write for "
              + parentId
              + " into "
              + indexName
              + " had item failures: "
              + reasons);
    } catch (IllegalStateException e) {
      throw e;
    } catch (Exception parseFailure) {
      // Conservative: an unparseable 200 could be hiding item failures, and in a staged
      // generation silently accepting it becomes a chunk drop at promotion.
      throw new IllegalStateException(
          "Bulk chunk write for "
              + parentId
              + " into "
              + indexName
              + " returned an unparseable response",
          parseFailure);
    }
  }

  private static final List<String> BULK_ACTIONS = List.of("index", "delete", "create");

  /**
   * Belt-and-braces for a missing or corrupt chunk-0 header (e.g. a partial bulk failure).
   * {@code previousCount == 0} is overwhelmingly the brand-new-entity case on the write and
   * reindex-backfill hot paths, so the guard is the cheapest primitive available — a real-time
   * by-id existence probe of chunk 1 that never touches the search layer. Only when a trailing
   * chunk survived without its header do we pay a delete-by-query heal. (A failure that drops
   * both chunk 0 and chunk 1 while later chunks survive would evade the probe; the next
   * successful full write overwrites those ids anyway.)
   */
  private void cleanOrphanChunks(String indexName, String parentId) {
    try {
      if (chunkDocExists(indexName, parentId + "_1")) {
        LOG.warn("Healing orphan chunk docs for parent {} with missing chunk-0 header", parentId);
        String body =
            "{\"query\":{\"term\":{\"parentId\":\""
                + VectorSearchQueryBuilder.escape(parentId)
                + "\"}}}";
        executeGenericRequest(
            "POST", "/" + indexName + "/_delete_by_query?conflicts=proceed", body);
      }
    } catch (Exception e) {
      LOG.debug("Orphan chunk cleanup skipped for {}: {}", parentId, e.getMessage());
    }
  }

  private boolean chunkDocExists(String indexName, String docId) {
    boolean exists = false;
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request =
          Requests.builder()
              .endpoint("/" + indexName + "/_doc/" + docId + "?_source=false")
              .method("HEAD")
              .build();
      try (var response = genericClient.execute(request)) {
        exists = response.getStatus() < 300;
      }
    } catch (Exception e) {
      LOG.debug("Chunk existence probe failed for {}: {}", docId, e.getMessage());
    }
    return exists;
  }

  private static void appendChunkDeletes(
      StringBuilder bulk, String indexName, String parentId, int fromIndex, int toExclusive) {
    for (int i = fromIndex; i < toExclusive; i++) {
      bulk.append("{\"delete\":{\"_index\":\"")
          .append(indexName)
          .append("\",\"_id\":\"")
          .append(parentId)
          .append('_')
          .append(i)
          .append("\"}}\n");
    }
  }

  @Override
  @SuppressWarnings("unchecked")
  public VectorSearchResponse search(
      String query,
      Map<String, List<String>> filters,
      int size,
      int from,
      int k,
      double threshold,
      String preference) {
    long start = System.currentTimeMillis();
    try {
      float[] queryVector = embeddingClient.embedQuery(query);
      LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
      int rawOffset = 0;
      long totalHits = -1L;
      boolean exhausted = false;
      int requestedParents = from + size + 1; // Fetch one extra parent so hasMore is accurate.
      int overFetchSize = Math.max(requestedParents * OVER_FETCH_MULTIPLIER, OVER_FETCH_MULTIPLIER);
      if (threshold <= 0.0) {
        overFetchSize = Math.min(overFetchSize, k);
      }

      String aliasName = getSearchAlias();
      while (!exhausted && byParent.size() < requestedParents) {
        String queryJson =
            VectorSearchQueryBuilder.build(
                queryVector, overFetchSize, rawOffset, k, filters, threshold);
        String endpoint =
            SearchUtils.appendPreferenceParam("/" + aliasName + "/_search", preference);
        String responseBody = executeGenericRequest("POST", endpoint, queryJson);

        JsonNode root = MAPPER.readTree(responseBody);
        JsonNode hitsNode = root.path("hits").path("hits");
        totalHits = extractTotalHits(root);

        int pageHitCount = collectSearchHits(hitsNode, threshold, byParent);
        if (pageHitCount == 0) {
          exhausted = true;
          break;
        }

        rawOffset += pageHitCount;
        exhausted = totalHits >= 0 ? rawOffset >= totalHits : pageHitCount < overFetchSize;
      }

      List<Map<String, Object>> results = new ArrayList<>();
      int parentCount = 0;
      int skipped = 0;
      for (List<Map<String, Object>> chunks : byParent.values()) {
        if (skipped < from) {
          skipped++;
          continue;
        }
        if (parentCount >= size) {
          break;
        }
        results.addAll(chunks);
        parentCount++;
      }

      boolean hasMore = byParent.size() > (from + parentCount);
      long tookMillis = System.currentTimeMillis() - start;
      return new VectorSearchResponse(
          tookMillis, results, totalHits >= 0 ? totalHits : null, hasMore);
    } catch (Exception e) {
      LOG.error("Vector search failed: {}", e.getMessage(), e);
      throw new RuntimeException("Vector search failed", e);
    }
  }

  private static int collectSearchHits(
      JsonNode hitsNode,
      double threshold,
      LinkedHashMap<String, List<Map<String, Object>>> byParent) {
    int pageHitCount = 0;
    for (JsonNode hit : hitsNode) {
      pageHitCount++;
      double score = hit.path("_score").asDouble(0.0);
      // When threshold > 0, OpenSearch already applies min_score at the KNN query level.
      // This post-filter acts as a safety net for the no-threshold case (k-based retrieval),
      // where low-scoring neighbors may still be returned to fill the k count.
      if (score < threshold) {
        continue;
      }

      Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
      hitMap.put("_score", score);

      String parentId = (String) hitMap.getOrDefault("parentId", hit.path("_id").asText());
      List<Map<String, Object>> group =
          byParent.computeIfAbsent(parentId, ignored -> new ArrayList<>());
      // During chunk-index migration the same chunk can surface twice — once from the legacy
      // entity-doc embedding and once from the dedicated chunk index. Keep the first (higher
      // scoring) occurrence per chunkIndex.
      if (!isDuplicateChunk(group, hitMap.get("chunkIndex"))) {
        group.add(hitMap);
      }
    }
    return pageHitCount;
  }

  private static boolean isDuplicateChunk(List<Map<String, Object>> group, Object chunkIndex) {
    boolean duplicate = false;
    Object key = normalizeChunkIndex(chunkIndex);
    for (Map<String, Object> member : group) {
      if (key.equals(normalizeChunkIndex(member.get("chunkIndex")))) {
        duplicate = true;
        break;
      }
    }
    return duplicate;
  }

  /**
   * Every embedding writer (legacy entity-doc and chunk-index) sets {@code chunkIndex} — 0 for the
   * legacy single-doc format — so a missing value can only come from exotic/manual docs. Treat it
   * as chunk 0 so such a doc still dedupes against the real chunk 0 during dual-write migration.
   */
  private static Object normalizeChunkIndex(Object chunkIndex) {
    return chunkIndex == null ? 0 : chunkIndex;
  }

  private static long extractTotalHits(JsonNode root) {
    JsonNode totalNode = root.path("hits").path("total");
    if (totalNode.isIntegralNumber()) {
      return totalNode.asLong(-1L);
    }
    if (totalNode.isObject()) {
      return totalNode.path("value").asLong(-1L);
    }
    return -1L;
  }

  public String getExistingFingerprint(String indexName, String entityId) {
    try {
      String query =
          "{\"size\":1,\"_source\":[\"fingerprint\"],"
              + "\"query\":{\"term\":{\"_id\":\""
              + VectorSearchQueryBuilder.escape(entityId)
              + "\"}}}";
      String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
      JsonNode root = MAPPER.readTree(response);
      JsonNode hits = root.path("hits").path("hits");
      if (hits.isArray() && !hits.isEmpty()) {
        return hits.get(0).path("_source").path("fingerprint").asText(null);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to get fingerprint for entityId={} in index={}: {}",
          entityId,
          indexName,
          e.getMessage());
    }
    return null;
  }

  private static final List<String> EMBEDDING_SOURCE_FIELDS =
      List.of(
          "fingerprint",
          "embedding",
          "textToLLMContext",
          "textToEmbed",
          "chunkIndex",
          "chunkCount",
          "parentId");

  // Jackson-backed mapper so JsonData.to(JsonNode.class, ...) deserializes via Jackson
  // and produces a tree of Jackson types (TextNode, ArrayNode, etc.) rather than
  // jakarta.json.JsonValue wrappers like org.glassfish.json.JsonStringImpl.
  private static final JacksonJsonpMapper JACKSON_JSONP_MAPPER = new JacksonJsonpMapper(MAPPER);

  /**
   * Per-entity input to {@link #getExistingEmbeddingsBatch(String, Map)}. {@code currentFingerprint}
   * is a {@link Supplier} so the caller doesn't pay the MD5 + meta-text construction cost when the
   * cheaper {@code updatedAt} fast-path resolves the match. {@code updatedAt} may be {@code null}
   * for entities that don't expose it; in that case the supplier is consulted unconditionally.
   */
  public record EntityFingerprintInput(Long updatedAt, Supplier<String> currentFingerprint) {}

  private static final List<String> FINGERPRINT_HEADER_FIELDS = List.of("fingerprint", "updatedAt");

  /**
   * Two-step batch fetch of cached embedding documents from {@code indexName}, scoped to entities
   * whose cached state matches the caller-provided current state. Designed to keep large vector
   * payloads off the wire for entities that will be re-embedded anyway.
   *
   * <p>Step 1 — {@code mget} {@code fingerprint} + {@code updatedAt} only for every requested ID,
   * then decide which IDs "match":
   *
   * <ul>
   *   <li>Fast path: cached {@code updatedAt} equals current {@code updatedAt} — the entity hasn't
   *       been touched since the prior index, so the embedding is reusable without recomputing the
   *       fingerprint.
   *   <li>Fallback: the lazy fingerprint {@link Supplier} is invoked and compared against the
   *       cached fingerprint.
   * </ul>
   *
   * <p>Step 2 — issue a second {@code mget} that pulls the full embedding {@code _source} only for
   * matching IDs. Entries that don't match are dropped, and the caller can rely on every returned
   * value being safe to splice into a staged index document.
   */
  public Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, EntityFingerprintInput> currentById) {
    if (currentById == null || currentById.isEmpty()) {
      return Collections.emptyMap();
    }
    try {
      List<String> entityIds = new ArrayList<>(currentById.keySet());
      MgetResponse<JsonData> headerResponse =
          client.mget(
              m -> m.index(indexName).ids(entityIds).sourceIncludes(FINGERPRINT_HEADER_FIELDS),
              JsonData.class);

      List<String> matchingIds = new ArrayList<>();
      for (MultiGetResponseItem<JsonData> item : headerResponse.docs()) {
        if (!item.isResult()) {
          continue;
        }
        GetResult<JsonData> doc = item.result();
        if (!doc.found() || doc.source() == null) {
          continue;
        }
        JsonNode header = doc.source().to(JsonNode.class, JACKSON_JSONP_MAPPER);
        if (header == null || !header.isObject()) {
          continue;
        }
        EntityFingerprintInput input = currentById.get(doc.id());
        if (input == null) {
          continue;
        }
        if (cachedStateMatches(header, input)) {
          matchingIds.add(doc.id());
        }
      }
      if (matchingIds.isEmpty()) {
        return Collections.emptyMap();
      }

      MgetResponse<JsonData> response =
          client.mget(
              m -> m.index(indexName).ids(matchingIds).sourceIncludes(EMBEDDING_SOURCE_FIELDS),
              JsonData.class);

      Map<String, JsonNode> result = new HashMap<>();
      for (MultiGetResponseItem<JsonData> item : response.docs()) {
        if (!item.isResult()) {
          continue;
        }
        GetResult<JsonData> doc = item.result();
        if (!doc.found() || doc.source() == null) {
          continue;
        }
        JsonNode cached = doc.source().to(JsonNode.class, JACKSON_JSONP_MAPPER);
        if (isSpliceable(cached)) {
          result.put(doc.id(), cached);
        }
      }
      return result;
    } catch (Exception e) {
      LOG.error("Failed to batch get embeddings in index={}", indexName, e);
      return Collections.emptyMap();
    }
  }

  /**
   * The splice-site contract: callers can rely on every returned entry being a JSON object whose
   * {@code embedding} is a non-empty array and whose {@code fingerprint} is non-blank text.
   * Anything else is dropped — silently, since these only fail on corrupt or partial cached docs
   * that the caller will regenerate from scratch anyway.
   */
  private static boolean isSpliceable(JsonNode cached) {
    if (cached == null || !cached.isObject()) {
      return false;
    }
    JsonNode embedding = cached.path("embedding");
    if (!embedding.isArray() || embedding.isEmpty()) {
      return false;
    }
    JsonNode fingerprint = cached.path("fingerprint");
    return fingerprint.isTextual() && !fingerprint.asText().isBlank();
  }

  private static boolean cachedStateMatches(JsonNode header, EntityFingerprintInput input) {
    JsonNode cachedUpdatedAt = header.path("updatedAt");
    if (cachedUpdatedAt.isIntegralNumber()
        && input.updatedAt() != null
        && cachedUpdatedAt.asLong() == input.updatedAt()) {
      return true;
    }
    String cachedFp = header.path("fingerprint").asText(null);
    return cachedFp != null && cachedFp.equals(input.currentFingerprint().get());
  }

  public void partialUpdateEntity(
      String indexName, String entityId, Map<String, Object> embeddingFields) {
    try {
      String docJson = MAPPER.writeValueAsString(embeddingFields);
      String updateBody = "{\"doc\":" + docJson + "}";
      executeGenericRequest(
          "POST", "/" + indexName + "/_update/" + entityId + "?retry_on_conflict=3", updateBody);
    } catch (Exception e) {
      LOG.error(
          "Failed to partial update entity {} in {}: {}", entityId, indexName, e.getMessage(), e);
    }
  }

  String executeGenericRequest(String method, String endpoint, String body) {
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var builder = Requests.builder().endpoint(endpoint).method(method);
      if (body != null) {
        builder.json(body);
      }
      var request = builder.build();
      try (var response = genericClient.execute(request)) {
        if (response.getStatus() >= 400) {
          String errorBody = response.getBody().map(Body::bodyAsString).orElse("no body");
          throw new IOException(
              "OpenSearch request failed with status " + response.getStatus() + ": " + errorBody);
        }
        return response
            .getBody()
            .map(
                b -> {
                  try {
                    return new String(b.bodyAsBytes(), StandardCharsets.UTF_8);
                  } catch (Exception e) {
                    return "{}";
                  }
                })
            .orElse("{}");
      }
    } catch (Exception e) {
      LOG.error("Generic request failed: {} {}", method, endpoint, e);
      throw new RuntimeException("OpenSearch generic request failed", e);
    }
  }

  private String getSearchAlias() {
    try {
      String clusterAlias = Entity.getSearchRepository().getClusterAlias();
      if (clusterAlias == null || clusterAlias.isEmpty()) {
        return VECTOR_EMBEDDING_ALIAS;
      }
      return clusterAlias + "_" + VECTOR_EMBEDDING_ALIAS;
    } catch (Exception ex) {
      return VECTOR_EMBEDDING_ALIAS;
    }
  }
}
