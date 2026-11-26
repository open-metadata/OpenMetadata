package org.openmetadata.service.search.vector;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.github.resilience4j.core.IntervalFunction;
import io.github.resilience4j.retry.Retry;
import io.github.resilience4j.retry.RetryConfig;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;
import java.util.function.Supplier;
import java.util.stream.Collectors;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.context.ContextMemory;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.EmbeddingFieldUpdate;
import org.openmetadata.service.search.LiveEmbeddingField;
import org.openmetadata.service.search.OntologyChunkIndex;
import org.openmetadata.service.search.OntologyTermSearch;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.VectorFieldHealth;
import org.openmetadata.service.search.indexes.ContextMemoryIndex;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingModel;
import org.openmetadata.service.search.vector.client.EmbeddingUnavailableException;
import org.openmetadata.service.search.vector.utils.DTOs.VectorSearchResponse;
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;
import org.openmetadata.service.security.policyevaluator.SubjectContext;

/**
 * The engine-neutral vector index: the dedicated chunk index and its staged recreate, chunk and
 * entity-doc embedding writes, embedding reuse, and parent-grouped kNN search. An engine supplies
 * only its dialect through the abstract hooks: how a request is sent, how the vector field is
 * mapped, and how a kNN search is phrased.
 */
@Slf4j
public abstract class AbstractVectorIndexService implements VectorIndexService {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String ALREADY_CLOSED_EXCEPTION = "already_closed_exception";
  private static final Retry GENERIC_REQUEST_RETRY =
      Retry.of(
          "vector-index-request",
          RetryConfig.custom()
              .maxAttempts(3)
              .intervalFunction(IntervalFunction.ofExponentialBackoff(200, 2))
              .retryOnException(
                  error ->
                      error instanceof UncheckedIOException
                          && error.getCause() instanceof ClosedSegmentException)
              .build());
  private static final int OVER_FETCH_MULTIPLIER = 2;
  private static final long UNKNOWN_COUNT = -1L;
  private static final String FINGERPRINT_FIELD = "fingerprint";
  private static final String PARENT_ID_FIELD = "parentId";
  private static final String ENTITY_TYPE_FILTER = "entityType";
  private static final String CHUNK_HEADER_FIELDS =
      "fingerprint,chunkCount,docVersion,"
          + String.join(
              ",",
              ContextMemoryIndex.FIELD_STATUS,
              ContextMemoryIndex.FIELD_ANCHOR_ID,
              ContextMemoryIndex.FIELD_MEMORY_SCOPE,
              ContextMemoryIndex.FIELD_MEMORY_TYPE,
              ContextMemoryIndex.FIELD_PINNED);

  @Getter private final EmbeddingClient embeddingClient;
  private final Function<VectorSearchParameters, Set<String>> readableAnchors;

  protected AbstractVectorIndexService(
      EmbeddingClient embeddingClient,
      Function<VectorSearchParameters, Set<String>> readableAnchors) {
    this.embeddingClient = embeddingClient;
    this.readableAnchors = readableAnchors;
  }

  /** Status and body of one engine response. {@code body} is null when the engine sent none. */
  protected record RawResponse(int status, String body) {}

  /** The engine's name as it appears in error messages. */
  protected abstract String engineName();

  /**
   * Sends one request and returns whatever the engine answered, error statuses included, so the
   * shared code decides what a 404 or a 5xx means. Throws only when no response arrived.
   */
  protected abstract RawResponse performRequest(String method, String endpoint, String body)
      throws IOException;

  /** The index-creation body that chunk mappings and aliases are added to: the engine's settings. */
  protected abstract ObjectNode chunkIndexSettings();

  /** The mapping of the {@code embedding} field for vectors of {@code dimension}. */
  protected abstract ObjectNode embeddingFieldMapping(int dimension);

  /** A full search request body for a kNN over {@code vector}, honouring the parameters' filters. */
  protected abstract String buildKnnSearch(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds);

  /** The engine's kNN clause, for use inside another query; see {@link #knnQueryClause}. */
  protected abstract String buildKnnQueryClause(
      float[] vector, VectorSearchParameters parameters, Set<String> readableAnchorIds);

  /**
   * Whether a kNN at {@code threshold} returns at most {@code k} hits. When it does, a larger page
   * fetches nothing extra and, at larger offsets, can push from+size past {@code
   * index.max_result_window}.
   */
  protected abstract boolean knnReturnsAtMostK(double threshold);

  @Override
  public String knnQueryClause(float[] vector, VectorSearchParameters parameters) {
    return buildKnnQueryClause(vector, parameters, readableAnchors.apply(parameters));
  }

  /**
   * Whether ontology terms keep their chunks in {@link OntologyChunkIndex}. When they do not, a
   * term's vector lives only on its term document and a kNN over ontology terms reads the term
   * indexes. ADR:2026-11-23-ontology-terms-have-dedicated-search-indexes
   */
  protected abstract boolean chunksOntologyTerms();

  protected void registerVectorEmbeddingHandler() {
    try {
      VectorEmbeddingHandler handler = new VectorEmbeddingHandler(this);
      // Replace, so a re-init hands over to the new service without a window in which entity
      // writes see no vector handler at all.
      EntityLifecycleEventDispatcher.getInstance().replaceHandler(handler);
      LOG.info("Registered VectorEmbeddingHandler for entity lifecycle events");
    } catch (Exception e) {
      LOG.error("Failed to register VectorEmbeddingHandler", e);
    }
  }

  @Override
  public Map<String, Object> generateEmbeddingFields(EntityInterface<?> entity) {
    return VectorDocBuilder.buildEmbeddingFields(entity, embeddingClient);
  }

  @Override
  public void updateEntityEmbedding(EntityInterface<?> entity, String entityIndexName) {
    if (!canHoldVectors(entityIndexName)) {
      LOG.debug(
          "{} cannot hold the model's vectors; skipping entity {}",
          entityIndexName,
          entity.getId());
    } else if (embeddingClient.isAvailable()) {
      refreshEntityEmbedding(entity, entityIndexName);
    } else {
      LOG.debug("Embedding provider unavailable; skipping entity {}", entity.getId());
    }
  }

  /**
   * Whether the embedding model's vectors may be written to, or searched in, {@code index}: not
   * when its live vector field cannot hold them, which would fail every write and every kNN on it
   * (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
   */
  protected static boolean canHoldVectors(String index) {
    return vectorFieldHealth().map(health -> health.canHold(index)).orElse(true);
  }

  private static Optional<VectorFieldHealth> vectorFieldHealth() {
    SearchRepository searchRepository = Entity.getSearchRepository();
    return Optional.ofNullable(
        searchRepository == null ? null : searchRepository.getVectorFieldHealth());
  }

  @Override
  public List<String> chunkIndexNames() {
    List<String> names = new ArrayList<>(List.of(getChunkIndexName()));
    if (chunksOntologyTerms()) {
      names.add(OntologyChunkIndex.name());
    }
    return names;
  }

  private void refreshEntityEmbedding(EntityInterface<?> entity, String entityIndexName) {
    try {
      String entityId = entity.getId().toString();
      String existingFingerprint = getExistingFingerprint(entityIndexName, entityId);
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);

      if (currentFingerprint.equals(existingFingerprint)) {
        LOG.debug("Skipping entity {} - fingerprint unchanged", entityId);
      } else {
        Map<String, Object> embeddingFields = generateEmbeddingFields(entity);
        partialUpdateEntity(entityIndexName, entityId, embeddingFields);
      }
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping embedding for entity {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update embedding for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private static final String CHUNK_INDEX_BASE = "data_asset_embeddings_chunks";
  private static final String INCOMPLETE_CHUNK_WRITES = "incompleteChunkWrites";
  private static final String CHUNK_DOC_VERSION = "chunkDocVersion";
  private volatile boolean chunkIndexEnsured = false;
  private volatile boolean ontologyChunkIndexEnsured;

  /**
   * Name of the dedicated chunk index (issue #4789). Lives alongside the entity indices; the
   * {@code dataAssetEmbeddings} alias is attached to it so the vector read path sees chunk docs
   * together with legacy entity-doc embeddings during migration.
   */
  @Override
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
  public void updateEntityEmbeddingChunks(EntityInterface<?> entity) {
    if (!OntologyTermSearch.isTerm(entity.getEntityReference().getType())) {
      requireChunkIndexForWrite();
      updateEntityEmbeddingChunks(entity, getChunkIndexName());
    } else if (chunksOntologyTerms()) {
      updateEntityEmbeddingChunks(entity, ontologyChunkWriteTarget());
    }
  }

  /**
   * Reindex-sink entry point for the reused-embedding backfill. During a staged recreate the write
   * must go to the staged generation — chunks written to the live target die at promotion,
   * silently dropping every unchanged entity from vector retrieval. The {@code recreateRun} flag
   * comes from the sink's own ReindexContext, so writers of normal (non-recreate) runs never
   * consult generation discovery and can never land in a crashed run's orphan. A chunk set that
   * cannot be written, or needs the embedding provider while it is unavailable, is a miss the
   * caller counts and retries; it never fails the entity, whose own embedding is already spliced.
   */
  @Override
  public boolean backfillEntityChunks(EntityInterface<?> entity, String stagedChunkTarget) {
    boolean written;
    try {
      String entityType = entity.getEntityReference().getType();
      written =
          stagedChunkTarget == null || OntologyTermSearch.isTerm(entityType)
              ? writeChunksIfStale(entity, chunkWriteTarget(entityType, null))
              : backfillStagedChunks(entity, requireVectorsFit(stagedChunkTarget));
    } catch (IOException | RuntimeException e) {
      LOG.debug("Failed to backfill chunks for {}: {}", entity.getId(), e.getMessage());
      written = false;
    }
    return written;
  }

  private String liveChunkWriteTarget() {
    requireChunkIndexForWrite();
    return getChunkIndexName();
  }

  /** Ontology terms are not part of the data-asset chunk generation, staged or live. */
  private String chunkWriteTarget(String entityType, String stagedChunkTarget) {
    return OntologyTermSearch.isTerm(entityType)
        ? ontologyChunkWriteTarget()
        : dataAssetChunkWriteTarget(stagedChunkTarget);
  }

  private String dataAssetChunkWriteTarget(String stagedChunkTarget) {
    return stagedChunkTarget == null
        ? liveChunkWriteTarget()
        : requireVectorsFit(stagedChunkTarget);
  }

  private static String requireVectorsFit(String chunkIndex) {
    if (!canHoldVectors(chunkIndex)) {
      throw new IllegalStateException(chunkIndex + " cannot hold the embedding model's vectors");
    }
    return chunkIndex;
  }

  /**
   * The ontology chunk index term chunks go to: the generation a run staged to rebuild it while
   * that run lasts, and otherwise the live one, created on the first write without the data-asset
   * read alias, since ontology terms are read through their own index. Like the data-asset chunk
   * index, the live one is only marked ensured once its mapping is current, and a write is refused
   * while it is not.
   */
  private String ontologyChunkWriteTarget() {
    if (!chunksOntologyTerms()) {
      throw new IllegalStateException(engineName() + " keeps no ontology chunk index");
    }
    return requireVectorsFit(
        stagedOntologyChunkTarget().orElseGet(this::ensuredLiveOntologyChunkIndex));
  }

  private String ensuredLiveOntologyChunkIndex() {
    String index = OntologyChunkIndex.name();
    if (!ontologyChunkIndexEnsured) {
      synchronized (this) {
        if (!ontologyChunkIndexEnsured) {
          ontologyChunkIndexEnsured = ensureOntologyChunkIndex(index);
        }
      }
    }
    if (!ontologyChunkIndexEnsured) {
      throw new IllegalStateException("Ontology vector chunk index unavailable");
    }
    return index;
  }

  private boolean ensureOntologyChunkIndex(String index) {
    String target = resolveLiveChunkTarget(index);
    boolean ensured;
    if (target == null) {
      executeGenericRequest("PUT", "/" + index, buildChunkIndexMapping(false));
      ensured = true;
    } else {
      ensured = applyChunkMappingUpgradeIfStale(target);
    }
    return ensured;
  }

  /**
   * Staged-recreate variant of the sink backfill: writes the entity's chunk docs into the staged
   * generation, reusing the live generation's stored vectors when the content fingerprint is
   * unchanged (the sink only takes this path for unchanged entities), so a full recreate does not
   * re-embed the whole catalog. Nothing is skipped — the staged generation starts empty, so every
   * entity passes through exactly once ({@code stagedHeader} short-circuits retries).
   */
  private boolean backfillStagedChunks(EntityInterface<?> entity, String staged)
      throws IOException {
    String parentId = entity.getId().toString();
    String fingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
    ChunkHeader stagedHeader = getChunkHeader(staged, parentId);
    boolean written = true;
    if (chunkRefresh(entity, fingerprint, stagedHeader) != ChunkRefresh.NONE) {
      Optional<List<Map<String, Object>>> chunkDocs =
          stagedBackfillChunks(entity, parentId, fingerprint);
      if (chunkDocs.isPresent()) {
        replaceChunks(staged, parentId, chunkDocs.get(), previousCount(stagedHeader));
      }
      written = chunkDocs.isPresent();
    }
    return written;
  }

  /**
   * The entity's chunk documents, reusing the live generation's vectors when its text is
   * unchanged, or empty when they need the embedding provider and it is unavailable.
   */
  private Optional<List<Map<String, Object>>> stagedBackfillChunks(
      EntityInterface<?> entity, String parentId, String fingerprint) {
    String live = getChunkIndexName();
    ChunkHeader liveHeader = getChunkHeader(live, parentId);
    Optional<List<Map<String, Object>>> chunkDocs = Optional.empty();
    if (liveHeader != null && fingerprint.equals(liveHeader.fingerprint())) {
      chunkDocs = Optional.of(rebuildChunksReusingEmbeddings(entity, live, parentId, liveHeader));
    } else if (embeddingClient.isAvailable()) {
      chunkDocs = Optional.of(VectorDocBuilder.fromEntity(entity, embeddingClient));
    }
    return chunkDocs;
  }

  /**
   * Single-embed dual-target write: builds the chunk documents once (one embedding call per
   * chunk) and reuses chunk 0's embedding fields for the legacy entity-doc partial update, so a
   * content change costs N embedding calls instead of N+1. Each target keeps its own
   * fingerprint-based staleness check.
   */
  @Override
  public void updateEntityEmbeddings(EntityInterface<?> entity, String entityIndexName) {
    updateEntityEmbeddings(entity, entityIndexName, null);
  }

  /**
   * {@code ontologyBody} is the embedding text of an ontology term's active release. A term's
   * embeddings are then written only while that release is still the published one, see {@link
   * OntologyTermSearch#writeCurrentEmbedding}. A term without it is refused: embedding from the
   * mutable working (draft) row would publish unpublished, not-in-active-release or deprecated
   * terms with no publication check. Term rebuilds go through the release-aware bulk writer
   * (reindex), see VectorEmbeddingHandler.refreshOntologyEmbedding and OntologyTermBulkWrite.
   */
  @Override
  public void updateEntityEmbeddings(
      EntityInterface<?> entity, String entityIndexName, String ontologyBody) {
    boolean term = OntologyTermSearch.isTerm(entity.getEntityReference().getType());
    if (term && ontologyBody == null) {
      LOG.warn(
          "Skipping embedding for ontology term {} without a release body; rebuild term "
              + "embeddings via the release-aware reindex path",
          entity.getId());
    } else if (!embeddingClient.isAvailable()) {
      LOG.debug("Embedding provider unavailable; skipping entity {}", entity.getId());
    } else if (term && !ontologyTargetsCanHoldVectors(entityIndexName)) {
      LOG.debug("An ontology index cannot hold the model's vectors; skipping {}", entity.getId());
    } else if (term) {
      refreshOntologyEmbeddings(entity, entityIndexName, ontologyBody);
    } else {
      refreshEntityEmbeddings(entity, entityIndexName);
    }
  }

  private boolean ontologyTargetsCanHoldVectors(String entityIndexName) {
    return canHoldVectors(entityIndexName)
        && (!chunksOntologyTerms()
            || canHoldVectors(stagedOntologyChunkTarget().orElseGet(OntologyChunkIndex::name)));
  }

  private void refreshOntologyEmbeddings(
      EntityInterface<?> entity, String entityIndexName, String ontologyBody) {
    try {
      String fingerprint = VectorDocBuilder.computeFingerprintForEntity(entity, ontologyBody);
      if (chunksOntologyTerms()) {
        refreshOntologyChunksAndEntityDoc(entity, entityIndexName, ontologyBody, fingerprint);
      } else {
        refreshOntologyEntityDoc(entity, entityIndexName, ontologyBody, fingerprint);
      }
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping embeddings for entity {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private void refreshOntologyChunksAndEntityDoc(
      EntityInterface<?> entity, String entityIndexName, String ontologyBody, String fingerprint)
      throws IOException {
    String parentId = entity.getId().toString();
    String chunkIndexName = ontologyChunkWriteTarget();
    boolean entityDocStale = !fingerprint.equals(getExistingFingerprint(entityIndexName, parentId));
    ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
    ChunkRefresh refresh = chunkRefresh(entity, fingerprint, header);
    if (entityDocStale || refresh != ChunkRefresh.NONE) {
      List<Map<String, Object>> chunkDocs =
          refresh == ChunkRefresh.RESTAMP
              ? rebuildChunksReusingEmbeddings(
                  entity, chunkIndexName, parentId, header, ontologyBody)
              : VectorDocBuilder.fromEntity(entity, embeddingClient, ontologyBody);
      OntologyTermSearch.writeCurrentEmbedding(
          entity.getEntityReference(),
          fingerprint,
          () -> writeOntologyChunksAndEntityDoc(entity, fingerprint, entityIndexName, chunkDocs));
    }
  }

  /** The chunk header is read again, under the term lock when the write is guarded. */
  private void writeOntologyChunksAndEntityDoc(
      EntityInterface<?> entity,
      String fingerprint,
      String entityIndexName,
      List<Map<String, Object>> chunkDocs)
      throws IOException {
    String parentId = entity.getId().toString();
    String chunkIndexName = ontologyChunkWriteTarget();
    ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
    if (chunkRefresh(entity, fingerprint, header) != ChunkRefresh.NONE) {
      replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
    }
    if (!chunkDocs.isEmpty()) {
      partialUpdateEntity(
          entityIndexName, parentId, VectorDocBuilder.legacyEmbeddingFields(chunkDocs.getFirst()));
    }
  }

  private void refreshOntologyEntityDoc(
      EntityInterface<?> entity, String entityIndexName, String ontologyBody, String fingerprint)
      throws IOException {
    String entityId = entity.getId().toString();
    if (fingerprint.equals(getExistingFingerprint(entityIndexName, entityId))) {
      LOG.debug("Skipping entity {} - fingerprint unchanged", entityId);
    } else {
      Map<String, Object> embeddingFields =
          VectorDocBuilder.buildEmbeddingFields(entity, embeddingClient, ontologyBody);
      OntologyTermSearch.writeCurrentEmbedding(
          entity.getEntityReference(),
          fingerprint,
          () -> partialUpdateEntity(entityIndexName, entityId, embeddingFields));
    }
  }

  private void refreshEntityEmbeddings(EntityInterface<?> entity, String entityIndexName) {
    try {
      String parentId = entity.getId().toString();
      String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
      boolean chunkIndexWritable = isChunkIndexWritable();
      boolean entityDocStale =
          canHoldVectors(entityIndexName)
              && !currentFingerprint.equals(getExistingFingerprint(entityIndexName, parentId));
      if (chunkIndexWritable) {
        refreshChunksAndEntityDoc(entity, entityIndexName, currentFingerprint, entityDocStale);
      } else if (entityDocStale) {
        logChunkIndexUnwritable(parentId);
        refreshEntityDocOnly(entity, entityIndexName);
      }
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping embeddings for entity {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update embeddings for entity {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  private void refreshChunksAndEntityDoc(
      EntityInterface<?> entity,
      String entityIndexName,
      String currentFingerprint,
      boolean entityDocStale)
      throws IOException {
    String parentId = entity.getId().toString();
    String chunkIndexName = getChunkIndexName();
    ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
    ChunkRefresh refresh = chunkRefresh(entity, currentFingerprint, header);
    if (entityDocStale || refresh != ChunkRefresh.NONE) {
      List<Map<String, Object>> chunkDocs =
          refresh == ChunkRefresh.RESTAMP
              ? rebuildChunksReusingEmbeddings(entity, chunkIndexName, parentId, header)
              : VectorDocBuilder.fromEntity(entity, embeddingClient);
      if (refresh != ChunkRefresh.NONE) {
        writeLiveChunks(chunkIndexName, parentId, chunkDocs, header);
        mirrorToStagedGeneration(parentId, chunkDocs);
      }
      if (entityDocStale && !chunkDocs.isEmpty()) {
        partialUpdateEntity(
            entityIndexName,
            parentId,
            VectorDocBuilder.legacyEmbeddingFields(chunkDocs.getFirst()));
      }
    }
  }

  // A chunk index that cannot hold the model's vectors is reported once, by VectorFieldHealth.
  private void logChunkIndexUnwritable(String parentId) {
    if (chunkIndexEnsured) {
      LOG.debug("The chunk index cannot hold the model's vectors; refreshing {} only", parentId);
    } else {
      LOG.warn(
          "Vector chunk index unavailable; refreshing only the entity embedding for {}", parentId);
    }
  }

  /**
   * A failed chunk write leaves the old chunk header in place, so the entity's next update sees the
   * chunks as stale and writes them again, even when the entity document is already current.
   */
  private void writeLiveChunks(
      String chunkIndexName,
      String parentId,
      List<Map<String, Object>> chunkDocs,
      ChunkHeader header) {
    try {
      replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
    } catch (IOException | RuntimeException e) {
      LOG.error(
          "Failed to write chunks for {} into {}; the entity embedding is still refreshed: {}",
          parentId,
          chunkIndexName,
          e.getMessage(),
          e);
    }
  }

  private void refreshEntityDocOnly(EntityInterface<?> entity, String entityIndexName) {
    List<Map<String, Object>> chunkDocs = VectorDocBuilder.fromEntity(entity, embeddingClient);
    if (!chunkDocs.isEmpty()) {
      partialUpdateEntity(
          entityIndexName,
          entity.getId().toString(),
          VectorDocBuilder.legacyEmbeddingFields(chunkDocs.getFirst()));
    }
  }

  /**
   * Reindex-sink chunk write. {@code stagedChunkTarget} is the staged generation created by the
   * run's own reCreateIndexes call and carried in its ReindexContext — the same propagation the
   * staged ENTITY indexes rely on — so writes are scoped to the current run by construction:
   * partial recreates and normal runs carry no target and write to the live index, and a crashed
   * run's orphan can never capture anything.
   */
  @Override
  public boolean writeEntityChunks(
      String parentId, List<Map<String, Object>> chunkDocs, String stagedChunkTarget) {
    boolean written;
    try {
      String entityType =
          chunkDocs.isEmpty() ? null : (String) chunkDocs.getFirst().get(ENTITY_TYPE_FILTER);
      String target = chunkWriteTarget(entityType, stagedChunkTarget);
      replaceChunks(target, parentId, chunkDocs, previousCount(getChunkHeader(target, parentId)));
      written = true;
    } catch (IOException | RuntimeException e) {
      // The entity keeps its embedding either way; the caller counts and retries the miss.
      LOG.debug("Failed to write chunk docs for {}: {}", parentId, e.getMessage());
      written = false;
    }
    return written;
  }

  @Override
  public void deleteEntityChunks(String parentId) {
    // Always delete from the live index: a staged run can be abandoned, and a delete applied only
    // to the staged generation would then be lost — the deleted entity's chunks would keep
    // surfacing until the next full recreate, the exact staleness this feature exists to prevent.
    deleteChunksFrom(getChunkIndexName(), parentId);
    // Also delete from an in-flight staged generation so a promoted run does not resurrect them.
    String staged = resolveChunkSinkTarget();
    if (staged != null && !deleteChunksFrom(staged, parentId)) {
      blockPromotionForMissedDelete(staged);
    }
  }

  private boolean deleteChunksFrom(String indexName, String parentId) {
    boolean deleted;
    try {
      ChunkHeader header = getChunkHeader(indexName, parentId);
      if (header != null || !indexMissing(indexName)) {
        removeChunkSet(indexName, parentId, previousCount(header));
      }
      deleted = true;
    } catch (Exception e) {
      LOG.debug("Failed to delete chunks for {} from {}: {}", parentId, indexName, e.getMessage());
      deleted = false;
    }
    return deleted;
  }

  /**
   * Progressive disclosure for a single knowledge entity (the issue #4789 payoff): KNN over just
   * this parent's chunks in the dedicated chunk index, returning the {@code textToLLMContext} of the
   * top {@code k} chunks most relevant to {@code query}. Unlike {@link #search}, results are not
   * collapsed by parent, so this yields several passages of one long article rather than a single
   * representative — the mechanism that lets a get_asset_context bundle carry only excerpts.
   *
   * <p>Context memory visibility is resolved for {@code subjectContext} even though the parent is
   * known: a parent may be a restricted memory, which yields no passages without it.
   */
  @Override
  public List<String> searchChunksByParent(
      String parentId, String query, int k, SubjectContext subjectContext) {
    List<String> passages = new ArrayList<>();
    if (canHoldVectors(getChunkIndexName())) {
      try {
        ensureChunkIndex();
        passages.addAll(searchChunkPassages(parentId, query, k, subjectContext));
      } catch (Exception e) {
        LOG.warn("Chunk retrieval failed for parent {}: {}", parentId, e.getMessage());
      }
    } else {
      LOG.debug("The chunk index cannot hold the model's vectors; no passages for {}", parentId);
    }
    return passages;
  }

  private List<String> searchChunkPassages(
      String parentId, String query, int k, SubjectContext subjectContext) throws IOException {
    float[] vector = embeddingClient.embedQuery(query);
    Map<String, List<String>> filters = Map.of("parentId", List.of(parentId));
    VectorSearchParameters parameters =
        new VectorSearchParameters(null, filters, k, 0, k, 0.0, null, subjectContext, null);
    String queryJson = buildKnnSearch(vector, parameters, Set.of());
    String response =
        executeGenericRequest("POST", "/" + getChunkIndexName() + "/_search", queryJson);
    List<String> passages = new ArrayList<>();
    for (JsonNode hit : MAPPER.readTree(response).path("hits").path("hits")) {
      String text = hit.path("_source").path("textToLLMContext").asText(null);
      if (text != null && !text.isBlank()) {
        passages.add(text);
      }
    }
    return passages;
  }

  // --- Staged chunk-index recreate: generation indexes promoted behind the read alias ---
  //
  // Full-recreate runs must sweep orphaned chunks (entities deleted without events — DB restore,
  // wipe-and-remigrate), but dropping the live index up front turns any mid-run failure into a
  // retrieval outage. Instead the run writes into a bare next-generation index
  // ({chunk_base}_g<N>), invisible to reads, and only when every vector-indexable entity type
  // finalizes successfully, and no chunk write into the generation failed, is the generation
  // promoted: one atomic _aliases call points the read and search aliases at it and removes the
  // previous target. Any failure before promotion leaves the old chunks fully live; abandoned
  // generations are swept at the next staged recreate.

  private final Object stagedChunkLock = new Object();
  private volatile String stagedChunkIndex;
  private static final Set<String> DATA_ASSET_TYPES_LOWERCASE =
      EmbeddedEntityTypes.DATA_ASSETS.stream()
          .map(type -> type.toLowerCase(Locale.ROOT))
          .collect(Collectors.toUnmodifiableSet());

  private volatile Set<String> stagedExpectedTypes = Set.of();
  private final Set<String> stagedFinalizedTypes = ConcurrentHashMap.newKeySet();
  // Types whose entity index kept its live index. Any of them keeps the live chunks too.
  private final Set<String> stagedKeptLiveTypes = ConcurrentHashMap.newKeySet();
  // Generations this JVM saved, or failed to save, the missed-delete flag on. A new staged run or
  // a participant leaving its run clears them.
  private final Set<String> flaggedGenerations = ConcurrentHashMap.newKeySet();
  private final Set<String> unflaggedGenerations = ConcurrentHashMap.newKeySet();
  private final Set<String> warnedMirrorGenerations = ConcurrentHashMap.newKeySet();
  private volatile boolean stagedDeleteMissed;
  // Run-scoped staged chunk index latched by a non-coordinator participant from its ReindexContext
  // (see latchParticipantStagedTarget). Null on the coordinator, which uses stagedChunkIndex; null
  // on a participant whose reindex thread has not yet latched (startup race). Volatile: set by the
  // participant's reindex thread, read by request threads via resolveChunkSinkTarget.
  private volatile String participantStagedTarget;

  /**
   * Begins a staged recreate for a full-recreate run: pre-flights the embedding client (a broken
   * client would make the whole run pointless), sweeps generations orphaned by crashed runs, and
   * creates the next generation bare — no aliases, so reads keep hitting the old chunks.
   *
   * <p>Returns {@code null} when the embedding client cannot serve a request, meaning "not staged":
   * the caller carries on with a normal in-place reindex and the existing chunks stay live, exactly
   * as they do for a partial recreate. An unreachable embedding provider is a reason not to stage a
   * generation we could never finish — it is not a reason to fail the entity reindex, which does
   * not need embeddings at all. Note the provider is only exercised here: client construction makes
   * no call to it, and live indexing logs and continues on embedding errors, so a deployment with
   * semantic search enabled but no working provider looks healthy right up until a reindex.
   *
   * <p>Also returns {@code null} when the live-target probe is indeterminate. Skipping the stage
   * deletes nothing — the sweep below never runs — so an unanswerable probe is a reason to leave
   * the chunk index alone, not to fail an entity reindex that does not depend on it. Throwing here
   * took down the whole run before its first record. The promote path stays strict: that swap does
   * remove the previous target, so it must know what the target is.
   *
   * <p>Still throws on index create — a half-made generation is a state the next run must not
   * inherit silently.
   */
  @Override
  public String beginStagedChunkRecreate() {
    String generation = null;
    if (isEmbeddingAvailable()) {
      synchronized (stagedChunkLock) {
        generation = stageChunkGenerationIfLiveTargetKnown();
      }
    } else {
      LOG.warn(
          "Embedding pre-flight failed — skipping the staged chunk recreate. The entity reindex "
              + "continues and existing chunks stay live; orphaned chunks, if any, are swept by the "
              + "next recreate that runs with a working embedding provider.");
    }
    return generation;
  }

  /** Returns the new staged generation, or null when the live chunk target cannot be resolved. */
  private String stageChunkGenerationIfLiveTargetKnown() {
    String base = getChunkIndexName();
    ResolvedLiveTarget resolved = tryResolveLiveChunkTarget(base);
    String generation = null;
    if (resolved.known()) {
      String liveTarget = resolved.name();
      deleteOrphanChunkGenerations(base, liveTarget);
      generation = nextChunkGenerationName(base);
      createStagedGeneration(generation);
      stagedChunkIndex = generation;
      stagedExpectedTypes = DATA_ASSET_TYPES_LOWERCASE;
      stagedFinalizedTypes.clear();
      stagedKeptLiveTypes.clear();
      flaggedGenerations.clear();
      unflaggedGenerations.clear();
      stagedDeleteMissed = false;
      LOG.info(
          "Staged chunk index {} created; chunks stay live at {} until promotion",
          generation,
          liveTarget);
    }
    return generation;
  }

  // Created bare, for the configured model: attaching an alias before promotion would make the
  // half-built generation readable.
  private void createStagedGeneration(String generation) {
    try {
      executeGenericRequest("PUT", "/" + generation, buildChunkIndexMapping(false));
    } catch (Exception e) {
      throw new RuntimeException("Failed to create staged chunk index " + generation, e);
    }
  }

  /** {@code name} is null on a fresh install; {@code known} is false when resolution failed. */
  private record ResolvedLiveTarget(boolean known, String name) {}

  private ResolvedLiveTarget tryResolveLiveChunkTarget(String base) {
    ResolvedLiveTarget resolved;
    try {
      resolved = new ResolvedLiveTarget(true, requireResolvedLiveChunkTarget(base));
    } catch (RuntimeException e) {
      LOG.warn(
          "Could not determine the live chunk target for {} — skipping the staged chunk "
              + "recreate. The entity reindex continues and existing chunks stay live.",
          base,
          e);
      resolved = new ResolvedLiveTarget(false, null);
    }
    return resolved;
  }

  /**
   * Clears this JVM's staged-recreate state when the owning run dies before any type finalizes —
   * without this, a later unrelated run's callbacks could complete and promote the dead
   * generation. The bare generation index is left for the next staged recreate's sweep.
   */
  @Override
  public void clearStagedChunkState(String generation) {
    synchronized (stagedChunkLock) {
      if (generation.equals(stagedChunkIndex)) {
        stagedChunkIndex = null;
        stagedFinalizedTypes.clear();
        stagedKeptLiveTypes.clear();
        LOG.warn(
            "Cleared staged chunk state for {} — its run died before finalization; the "
                + "generation will be swept by the next staged recreate",
            generation);
      }
    }
    clearStagedOntologyChunkState(generation);
  }

  /**
   * Whether the embedding client can actually serve a request. Logged rather than thrown: the only
   * caller treats an unavailable provider as "do not stage", and the stack trace belongs in the log
   * next to the provider's own error, not wrapped in a reindex failure.
   */
  private boolean isEmbeddingAvailable() {
    boolean available;
    try {
      embeddingClient.embedQuery("chunk index recreate pre-flight");
      available = true;
    } catch (Exception e) {
      LOG.warn("Embedding client pre-flight failed: {}", e.getMessage(), e);
      available = false;
    }
    return available;
  }

  /**
   * Records whether one entity type's staged entity index replaced its live index, for an active
   * staged chunk recreate. Once every vector-indexable type has finalized, the chunk generation
   * goes live with the entity indexes: it is promoted when they all were. A type whose entity index
   * kept its live index keeps the live chunks too, so its chunks never vanish while its entities
   * are still served. Missed per-entity chunk writes do not block promotion; they are counted,
   * retried and heal later. This runs on the coordinator, the only JVM that finalizes entity types.
   * No-op when no staged recreate is active or for non-vector types.
   */
  @Override
  public void markEntityTypeReindexed(
      String entityType, boolean entityIndexPromoted, String runGeneration) {
    if (OntologyTermSearch.isTerm(entityType)) {
      markOntologyTypeReindexed(entityType, entityIndexPromoted, runGeneration);
    } else {
      markDataAssetTypeReindexed(entityType, entityIndexPromoted, runGeneration);
    }
  }

  private void markDataAssetTypeReindexed(
      String entityType, boolean entityIndexPromoted, String runGeneration) {
    String normalized = entityType == null ? null : entityType.toLowerCase(Locale.ROOT);
    String generation = stagedChunkIndex;
    if (generation != null && runGeneration != null && !generation.equals(runGeneration)) {
      // Mark from a different run than the one that staged this generation — never count it.
      LOG.warn(
          "Ignoring chunk-type mark for {} bound to run generation {} while {} is staged",
          entityType,
          runGeneration,
          generation);
    } else if (generation != null && runGeneration == null && normalized != null) {
      // A run WITHOUT chunk staging is finalizing types while staged state lingers on this JVM —
      // stale leftovers of a dead run. Never count these marks toward promotion.
      LOG.warn(
          "Ignoring unbound chunk-type mark for {} — staged generation {} belongs to a dead run "
              + "and will be swept by the next staged recreate",
          entityType,
          generation);
    } else if (stagedChunkIndex != null
        && normalized != null
        && stagedExpectedTypes.contains(normalized)) {
      recordTypeOutcome(normalized, entityIndexPromoted);
    }
  }

  // A type finalized twice keeps the live chunks once either call kept them, so a later call can
  // never undo a run-level reason to keep them.
  private void recordTypeOutcome(String entityType, boolean entityIndexPromoted) {
    if (!entityIndexPromoted) {
      stagedKeptLiveTypes.add(entityType);
    }
    stagedFinalizedTypes.add(entityType);
    if (stagedFinalizedTypes.containsAll(stagedExpectedTypes)) {
      promoteStagedChunkIndex();
    }
  }

  /**
   * Points the read and search aliases at the staged generation and removes the previous target in
   * one atomic {@code _aliases} call — no window where reads see neither or both generations.
   * Strict like the orphan sweep: a live target that cannot be resolved fails the promotion.
   */
  private void promoteStagedChunkIndex() {
    synchronized (stagedChunkLock) {
      String generation = stagedChunkIndex;
      if (generation != null) {
        String base = getChunkIndexName();
        String liveTarget = requireResolvedLiveChunkTarget(base);
        Optional<String> keepLive = reasonToKeepLiveChunks(generation, liveTarget);
        if (keepLive.isPresent()) {
          LOG.warn(
              "Staged chunk index {} is not promoted because {}; the live chunks stay and the "
                  + "next staged recreate sweeps it",
              generation,
              keepLive.get());
        } else {
          swapInStagedGeneration(generation, base, liveTarget);
        }
        stagedChunkIndex = null;
      }
    }
  }

  private Optional<String> reasonToKeepLiveChunks(String generation, String liveTarget) {
    Set<String> keptLive = new TreeSet<>(stagedKeptLiveTypes);
    String reason = null;
    if (!keptLive.isEmpty()) {
      reason = "the entity indexes of " + keptLive + " kept their live index";
    } else if (stagedDeleteMissed || isStagedGenerationIncomplete(generation)) {
      reason = "a delete of a removed entity's chunks failed";
    } else if (!stagedCanReplaceLive(generation, liveTarget)) {
      reason = "it holds no chunks while the live index does, or a count could not be read";
    }
    return Optional.ofNullable(reason);
  }

  /** An empty generation replaces only an empty live index; an unknown count keeps the live one. */
  private boolean stagedCanReplaceLive(String generation, String liveTarget) {
    long staged = chunkDocCount(generation);
    long live = liveTarget == null ? 0 : chunkDocCount(liveTarget);
    return staged > 0 || (staged == 0 && live == 0);
  }

  private long chunkDocCount(String indexName) {
    long count = UNKNOWN_COUNT;
    try {
      executeGenericRequest("POST", "/" + indexName + "/_refresh", null);
      String response = executeGenericRequest("GET", "/" + indexName + "/_count", null);
      count = MAPPER.readTree(response).path("count").asLong(UNKNOWN_COUNT);
    } catch (IOException | RuntimeException e) {
      LOG.warn("Could not count the chunks in {}: {}", indexName, e.getMessage());
    }
    return count;
  }

  private void swapInStagedGeneration(String generation, String base, String oldTarget) {
    try {
      executeGenericRequest(
          "POST",
          "/_aliases",
          buildChunkPromoteActions(generation, base, getIndexAlias(), oldTarget));
    } catch (RuntimeException e) {
      throw new RuntimeException("Failed to promote staged chunk index " + generation, e);
    }
    chunkIndexEnsured = true;
    vectorFieldHealth().ifPresent(health -> health.refresh(base));
    LOG.info("Promoted staged chunk index {} (previous target: {})", generation, oldTarget);
  }

  /**
   * Any node whose delete from the generation failed flagged it on the index itself (see {@link
   * #blockPromotionForMissedDelete}), so the coordinator sees participants' failures too. Strict
   * like the swap: a flag that cannot be read fails the promotion.
   */
  private boolean isStagedGenerationIncomplete(String generation) {
    boolean incomplete;
    try {
      String mappingJson = executeGenericRequest("GET", "/" + generation + "/_mapping", null);
      incomplete =
          MAPPER
              .readTree(mappingJson)
              .path(generation)
              .path("mappings")
              .path("_meta")
              .path(INCOMPLETE_CHUNK_WRITES)
              .asBoolean(false);
    } catch (IOException | RuntimeException e) {
      throw new RuntimeException("Failed to read staged chunk index state " + generation, e);
    }
    return incomplete;
  }

  /**
   * A delete the staged generation missed would bring a removed entity's chunks back at promotion,
   * so it is the one chunk failure that blocks promotion. The flag is a {@code _meta} entry rather
   * than JVM state because the delete may fail on a participant while the coordinator promotes.
   */
  private void blockPromotionForMissedDelete(String generation) {
    if (generation.equals(stagedChunkIndex)) {
      stagedDeleteMissed = true;
    }
    saveMissedDeleteFlagOnce(generation);
  }

  private void saveMissedDeleteFlagOnce(String generation) {
    if (!flaggedGenerations.contains(generation)) {
      if (flagStagedGenerationIncomplete(generation)) {
        flaggedGenerations.add(generation);
        unflaggedGenerations.remove(generation);
      } else {
        unflaggedGenerations.add(generation);
      }
    }
  }

  private boolean flagStagedGenerationIncomplete(String generation) {
    boolean flagged;
    try {
      ObjectNode body = MAPPER.createObjectNode();
      body.set("_meta", chunkMeta().put(INCOMPLETE_CHUNK_WRITES, true));
      executeGenericRequest("PUT", "/" + generation + "/_mapping", body.toString());
      flagged = true;
    } catch (RuntimeException e) {
      LOG.error(
          "Could not flag staged chunk index {} as missing a delete; this node's partition will "
              + "fail unless a retry saves the flag: {}",
          generation,
          e.getMessage());
      flagged = false;
    }
    return flagged;
  }

  /**
   * Fails the caller's partition when this node missed a delete from the run's generation and
   * could not save the flag that blocks its promotion. The failed partition reaches the coordinator
   * through the job's partition records and keeps the type's live index, which blocks the swap.
   */
  @Override
  public void requireStagedChunkFailuresRecorded() {
    String generation = stagedChunkIndex != null ? stagedChunkIndex : participantStagedTarget;
    if (generation != null && unflaggedGenerations.contains(generation)) {
      saveMissedDeleteFlagOnce(generation);
      if (unflaggedGenerations.contains(generation)) {
        throw new UnrecordedStagedChunkDeleteException(generation);
      }
    }
  }

  private static final long SINK_TARGET_CACHE_MS = 15_000;
  private volatile String cachedSinkTarget;
  private volatile long cachedSinkTargetAt;

  /**
   * Resolves the staged chunk target for the live-edit mirror ({@link #mirrorToStagedGeneration})
   * and delete ({@link #deleteEntityChunks}) paths. Resolution order:
   *
   * <ol>
   *   <li>{@link #stagedChunkIndex} — the coordinator's own run-scoped generation, set by {@link
   *       #beginStagedChunkRecreate}. Coordinator-only; also gates promotion in {@link
   *       #markEntityTypeReindexed}, so it must never be set on a participant.
   *   <li>{@link #participantStagedTarget} — a non-coordinator participant's run-scoped
   *       generation, latched from its {@code ReindexContext} by {@link
   *       #latchParticipantStagedTarget}. Authoritative for the run, so mirroring and deletes
   *       never depend on best-effort discovery — the gap that lost live edits when discovery
   *       cached a stale {@code null} on a participant JVM (see fd054753fa).
   *   <li>Best-effort cluster-state probe ({@link #findActiveStagedGeneration}) with a short
   *       JVM-local cache that may hold {@code null} (no un-promoted {@code *_g*} index exists
   *       yet, or a transient probe failure). Reached only before a participant latches (startup
   *       race) or on a JVM with no run context; a {@code null} here is harmless for deletes but
   *       causes {@link #mirrorToStagedGeneration} to skip the mirror.
   * </ol>
   *
   * <p>Sink writes ({@code writeEntityChunks} / {@code backfillEntityChunks}) do not use this
   * helper: they receive the run-scoped target explicitly via {@code ReindexContext}.
   */
  private String resolveChunkSinkTarget() {
    String target = stagedChunkIndex; // coordinator-only fast path (also gates promotion)
    if (target == null) {
      target = participantStagedTarget; // participant latch from ReindexContext
    }
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

  /**
   * Latches the run-scoped staged chunk index a participant received via its {@code
   * ReindexContext}, so live-edit mirroring ({@link #mirrorToStagedGeneration}) and deletes ({@link
   * #deleteEntityChunks}) read the authoritative run-scoped target instead of falling through to
   * the best-effort probe in {@link #findActiveStagedGeneration}. That probe can hold a stale
   * {@code null} for up to {@value SINK_TARGET_CACHE_MS}ms on a non-coordinator JVM (cached before
   * the coordinator created the generation, or after a transient cluster-state failure), in which
   * case the mirror silently no-ops and the live edit is stranded in the soon-to-be-removed old
   * generation. Called once per run by {@code DistributedJobParticipant} before it streams, and
   * cleared by {@link #clearParticipantStagedTarget} when the run ends.
   *
   * <p>Must NOT set {@link #stagedChunkIndex}: that field gates promotion in {@link
   * #markEntityTypeReindexed} (checking {@code stagedFinalizedTypes} against {@code
   * stagedExpectedTypes}) and is coordinator-only. {@code participantStagedTarget} is safe because
   * the promotion path never reads it.
   */
  @Override
  public void latchParticipantStagedTarget(String staged) {
    if (staged != null) {
      vectorFieldHealth().ifPresent(health -> health.check(staged));
    }
    participantStagedTarget = staged;
  }

  /**
   * Clears the participant latch set by {@link #latchParticipantStagedTarget} when its run ends, so
   * a later run cannot mirror or delete into a generation that belongs to a finished (promoted or
   * abandoned) run.
   */
  @Override
  public void clearParticipantStagedTarget() {
    participantStagedTarget = null;
    participantOntologyChunks = null;
    flaggedGenerations.clear();
    unflaggedGenerations.clear();
  }

  // The ontology chunk index is written in place by every ontology reindex. Only a staged
  // generation replaces one that cannot hold the model's vectors, so a recreate of both term types
  // then writes every term chunk into a bare generation built for the model, which goes live in
  // one atomic alias swap once both types are promoted. Until then the live index stays as it is
  // (ADR:2026-11-26-the-server-reconciles-live-vector-fields-with-the-embedding-model).
  private static final Set<String> ONTOLOGY_TERM_TYPES =
      OntologyTermSearch.TERM_TYPES.stream()
          .map(type -> type.toLowerCase(Locale.ROOT))
          .collect(Collectors.toUnmodifiableSet());
  private final Object stagedOntologyLock = new Object();
  private volatile String stagedOntologyChunks;
  private volatile String participantOntologyChunks;
  private final Set<String> ontologyFinalizedTypes = ConcurrentHashMap.newKeySet();
  private final Set<String> ontologyKeptLiveTypes = ConcurrentHashMap.newKeySet();

  @Override
  public String beginStagedOntologyChunkRecreate() {
    String generation = null;
    if (chunksOntologyTerms() && liveOntologyChunksCannotHoldVectors() && isEmbeddingAvailable()) {
      synchronized (stagedOntologyLock) {
        generation = stageOntologyChunkGeneration();
      }
    }
    return generation;
  }

  // Read now, so the run decides on the live index as it is rather than as it was last checked.
  private static boolean liveOntologyChunksCannotHoldVectors() {
    String index = OntologyChunkIndex.name();
    vectorFieldHealth().ifPresent(health -> health.check(index));
    return !canHoldVectors(index);
  }

  private String stageOntologyChunkGeneration() {
    String base = OntologyChunkIndex.name();
    ResolvedLiveTarget live = tryResolveLiveChunkTarget(base);
    String generation = null;
    if (live.known() && live.name() != null) {
      deleteOrphanChunkGenerations(base, live.name());
      generation = nextChunkGenerationName(base);
      createStagedGeneration(generation);
      stagedOntologyChunks = generation;
      ontologyFinalizedTypes.clear();
      ontologyKeptLiveTypes.clear();
      LOG.info(
          "Staged ontology chunk index {} for the embedding model; {} stays live until both "
              + "ontology term types are promoted",
          generation,
          live.name());
    }
    return generation;
  }

  @Override
  public Optional<String> stagedOntologyChunkTarget() {
    String staged = stagedOntologyChunks;
    return Optional.ofNullable(staged != null ? staged : participantOntologyChunks);
  }

  @Override
  public void latchParticipantStagedOntologyTarget(String staged) {
    participantOntologyChunks = staged;
  }

  private void clearStagedOntologyChunkState(String generation) {
    synchronized (stagedOntologyLock) {
      if (generation.equals(stagedOntologyChunks)) {
        stagedOntologyChunks = null;
        LOG.warn(
            "Cleared staged ontology chunk state for {}; its run died before finalization and the "
                + "next staged recreate sweeps it",
            generation);
      }
    }
  }

  private void markOntologyTypeReindexed(
      String entityType, boolean entityIndexPromoted, String runGeneration) {
    synchronized (stagedOntologyLock) {
      String generation = stagedOntologyChunks;
      if (generation != null && generation.equals(runGeneration)) {
        recordOntologyTypeOutcome(entityType.toLowerCase(Locale.ROOT), entityIndexPromoted);
      } else if (generation != null) {
        LOG.warn(
            "Ignoring the ontology chunk mark for {} of run generation {} while {} is staged",
            entityType,
            runGeneration,
            generation);
      }
    }
  }

  // The run ends here either way, so its state never outlives the last type.
  private void recordOntologyTypeOutcome(String entityType, boolean entityIndexPromoted) {
    if (!entityIndexPromoted) {
      ontologyKeptLiveTypes.add(entityType);
    }
    ontologyFinalizedTypes.add(entityType);
    if (ontologyFinalizedTypes.containsAll(ONTOLOGY_TERM_TYPES)) {
      String generation = stagedOntologyChunks;
      try {
        promoteStagedOntologyChunks(generation);
      } finally {
        stagedOntologyChunks = null;
      }
    }
  }

  private void promoteStagedOntologyChunks(String generation) {
    String base = OntologyChunkIndex.name();
    String liveTarget = requireResolvedLiveChunkTarget(base);
    Optional<String> keepLive = reasonToKeepLiveOntologyChunks(generation, liveTarget);
    if (keepLive.isPresent()) {
      LOG.warn(
          "Staged ontology chunk index {} is not promoted because {}; the live index stays and "
              + "the next staged recreate sweeps it",
          generation,
          keepLive.get());
    } else {
      swapInOntologyChunkGeneration(generation, base, liveTarget);
    }
  }

  private Optional<String> reasonToKeepLiveOntologyChunks(String generation, String liveTarget) {
    String reason = null;
    if (!ontologyKeptLiveTypes.isEmpty()) {
      reason =
          "the entity indexes of "
              + new TreeSet<>(ontologyKeptLiveTypes)
              + " kept their live index";
    } else if (!stagedCanReplaceLive(generation, liveTarget)) {
      reason = "it holds no chunks while the live index does, or a count could not be read";
    }
    return Optional.ofNullable(reason);
  }

  private void swapInOntologyChunkGeneration(String generation, String base, String oldTarget) {
    try {
      executeGenericRequest(
          "POST", "/_aliases", buildChunkPromoteActions(generation, List.of(base), oldTarget));
    } catch (RuntimeException e) {
      throw new RuntimeException("Failed to promote staged ontology chunk index " + generation, e);
    }
    ontologyChunkIndexEnsured = true;
    vectorFieldHealth().ifPresent(health -> health.refresh(base));
    LOG.info(
        "Promoted staged ontology chunk index {} (previous target: {})", generation, oldTarget);
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
    return buildChunkPromoteActions(generation, List.of(readAlias, searchAlias), oldTarget);
  }

  /** As above, attaching {@code aliases} only. */
  static String buildChunkPromoteActions(
      String generation, List<String> aliases, String oldTarget) {
    ArrayNode actions = MAPPER.createArrayNode();
    aliases.forEach(
        alias ->
            actions.add(
                MAPPER
                    .createObjectNode()
                    .set(
                        "add",
                        MAPPER.createObjectNode().put("index", generation).put("alias", alias))));
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
   * or null on a fresh install. Throws when the cluster cannot answer, so callers can distinguish
   * "nothing is live" from "could not tell".
   *
   * <p>Index-scoped by construction: {@code GET /{base}/_alias} names the index in the path, so a
   * deployment whose search role only grants its own {@code <clusterAlias>*} prefix — every
   * shared-tenancy cloud cluster — is authorized for it. The alias-scoped forms
   * ({@code HEAD|GET /_alias/{base}}) name no index, so the cluster resolves them against _all and
   * denies them with a 403, which can never degrade to "no alias".
   *
   * <p>One call covers both layouts because the response is keyed by physical index: the staged
   * generation when {@code base} is the read alias, {@code base} itself when it is still the
   * legacy physical index. A 404 means neither exists yet.
   */
  private String resolveLiveChunkTargetStrict(String base) throws IOException {
    RawResponse response = performRequest("GET", "/" + base + "/_alias", null);
    String target = null;
    if (response.status() == 404) {
      LOG.debug("No chunk index or alias named {} — fresh install", base);
    } else if (response.status() >= 400) {
      throw failedRequest(response);
    } else {
      Iterator<String> names = MAPPER.readTree(bodyOrEmptyObject(response)).fieldNames();
      target = names.hasNext() ? names.next() : null;
    }
    return target;
  }

  /**
   * Lenient resolution for the ensure/create path: a wrongly-null target there can only make an
   * index create attempt fail and be retried — it can never delete anything.
   */
  private String resolveLiveChunkTarget(String base) {
    String target = null;
    try {
      target = resolveLiveChunkTargetStrict(base);
    } catch (Exception e) {
      LOG.warn("Could not resolve live chunk target for {}: {}", base, e.getMessage());
    }
    return target;
  }

  /**
   * Strict resolution for destructive paths (orphan sweep, alias swap): an indeterminate probe
   * aborts the operation, because a null target would read as "nothing is live" and let the sweep
   * delete the live generation.
   */
  private String requireResolvedLiveChunkTarget(String base) {
    try {
      return resolveLiveChunkTargetStrict(base);
    } catch (Exception e) {
      throw new RuntimeException("Cannot determine the live chunk target for " + base, e);
    }
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
   * Run-unique generation name (epoch-millis stamp) so a pending promote from a superseded run
   * fails loudly on a missing index rather than silently aliasing another run's half-built one.
   */
  static String nextChunkGenerationName(String chunkBase) {
    return chunkBase + "_g" + System.currentTimeMillis();
  }

  /**
   * Write-path gate: throws when the chunk index could not be ensured. A raw write against a
   * missing index would auto-create it with dynamic mappings ({@code embedding} as float, not a
   * vector field), permanently wedging vector search until manual index surgery — worse than the
   * skipped write. Read paths stay lenient: reads cannot auto-create an index.
   */
  private void requireChunkIndexForWrite() {
    ensureChunkIndex();
    if (!chunkIndexEnsured) {
      throw new IllegalStateException(
          "Vector chunk index unavailable (create/upgrade failed); refusing chunk write that "
              + "would auto-create it with a non-knn mapping");
    }
    requireVectorsFit(getChunkIndexName());
  }

  private boolean isChunkIndexWritable() {
    ensureChunkIndex();
    return chunkIndexEnsured && canHoldVectors(getChunkIndexName());
  }

  private void ensureChunkIndex() {
    if (!chunkIndexEnsured) {
      synchronized (this) {
        if (!chunkIndexEnsured) {
          // Only latch on success so a transient failure (e.g. a cluster outage during startup)
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
        executeGenericRequest("PUT", "/" + target + "/_alias/" + getIndexAlias(), "{}");
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
    boolean upgraded;
    try {
      String mappingJson = executeGenericRequest("GET", "/" + indexName + "/_mapping", null);
      JsonNode mappings = MAPPER.readTree(mappingJson).path(indexName).path("mappings");
      int existingVersion = mappings.path(LiveEmbeddingField.META).path(CHUNK_DOC_VERSION).asInt(0);
      if (existingVersion < VectorDocBuilder.CHUNK_DOC_VERSION) {
        executeGenericRequest(
            "PUT",
            "/" + indexName + "/_mapping",
            buildChunkMappingUpgradeBody(mappings.path(LiveEmbeddingField.META)));
        LOG.info(
            "Upgraded chunk index {} mapping chunkDocVersion {} -> {} (denormalized fields "
                + "backfill on next Search Reindex)",
            indexName,
            existingVersion,
            VectorDocBuilder.CHUNK_DOC_VERSION);
      }
      upgraded = true;
    } catch (Exception e) {
      LOG.error(
          "Failed to upgrade chunk index {} mapping; leaving it un-ensured to retry on the next "
              + "write rather than stamping docs with the new docVersion into a stale mapping: {}",
          indexName,
          e.getMessage());
      upgraded = false;
    }
    return upgraded;
  }

  private String buildChunkIndexMapping(boolean withSearchAlias) {
    var mappings = MAPPER.createObjectNode().put("dynamic", false);
    mappings.set("properties", buildChunkProperties());
    mappings.set("_meta", chunkMeta());
    var root = chunkIndexSettings();
    root.set("mappings", mappings);
    // Staged generations are created bare: attaching the search alias before promotion would make
    // the half-built generation searchable alongside the live one.
    if (withSearchAlias) {
      root.set(
          "aliases", MAPPER.createObjectNode().set(getIndexAlias(), MAPPER.createObjectNode()));
    }
    return root.toString();
  }

  /**
   * Additive {@code PUT _mapping} body applied by {@link #applyChunkMappingUpgradeIfStale}. Sends the
   * property set <b>minus the {@code embedding} vector field</b> plus the bumped
   * {@code _meta.chunkDocVersion}. Re-declaring the existing vector field is rejected by some
   * OpenSearch versions/plugins even with identical parameters; because {@code PUT _mapping} is
   * atomic, that would fail the whole request and silently leave the genuinely new denormalized
   * fields unmapped (on a {@code dynamic:false} index) while docs are still stamped with the new
   * {@code docVersion} — defeating the rollout. Omitting the unchanged vector avoids that
   * all-or-nothing failure; the remaining fields are additive (new fields) or legal no-ops
   * (unchanged keyword/text/integer). {@code _meta} is the live one with the bumped version, since a
   * {@code PUT _mapping} replaces the whole {@code _meta}: the model it records is the one the
   * vectors there were built with, whatever model is configured now.
   *
   * <p>Absent-on-old-docs fields are inert for anything that merely scores or widens on them, so
   * those upgrades carry no regression before the backfill runs. That is <b>not</b> true of a field a
   * filter restricts on: {@code visibility}, {@code entityStatus} and {@code anchorId} are required
   * by the context memory clause in {@link VectorSearchQueryBuilder}, where absence means exclusion
   * rather than indifference. Memory chunks written before they were stamped therefore stay out of
   * every KNN result, for admins too, until a Search Reindex restamps them — deliberately, since an
   * unstamped document may be a Private, retired or anchored memory. {@code memoryScope},
   * {@code memoryType} and {@code pinned} (v8) restrict only a query that asks for them, so before
   * the backfill such a query loses those memories' vector hits and never gains a wrong one. Weigh
   * that before making any future field a filter depends on.
   */
  private String buildChunkMappingUpgradeBody(JsonNode liveMeta) {
    ObjectNode properties = buildChunkProperties();
    properties.remove("embedding");
    ObjectNode meta =
        liveMeta instanceof ObjectNode live ? live.deepCopy() : MAPPER.createObjectNode();
    var body = MAPPER.createObjectNode();
    body.set("properties", properties);
    body.set(
        LiveEmbeddingField.META, meta.put(CHUNK_DOC_VERSION, VectorDocBuilder.CHUNK_DOC_VERSION));
    return body.toString();
  }

  /** The {@code _meta} of a new chunk index: its document version and the embedding model. */
  private ObjectNode chunkMeta() {
    ObjectNode mappings = MAPPER.createObjectNode();
    mappings
        .putObject(LiveEmbeddingField.META)
        .put(CHUNK_DOC_VERSION, VectorDocBuilder.CHUNK_DOC_VERSION);
    return EmbeddingFieldUpdate.recordModel(mappings, EmbeddingModel.of(embeddingClient));
  }

  private ObjectNode buildChunkProperties() {
    var properties = MAPPER.createObjectNode();
    properties.set("embedding", embeddingFieldMapping(embeddingClient.getDimension()));
    // The three metric enums are mapped as real keywords, not source-only: they are cheap to index
    // and are the natural facets to filter a metric search on (granularity DAY vs MONTH).
    // Memory privacy and lifecycle fields must be filterable on every chunk.
    for (String keyword :
        List.of(
            "parentId",
            "fingerprint",
            "entityType",
            "fullyQualifiedName",
            "serviceType",
            "metricType",
            "granularity",
            "unitOfMeasurement",
            "customUnitOfMeasurement",
            "visibility",
            "sharedWithIds",
            ContextMemoryIndex.FIELD_ANCHOR_ID,
            ContextMemoryIndex.FIELD_STATUS,
            ContextMemoryIndex.FIELD_MEMORY_SCOPE,
            ContextMemoryIndex.FIELD_MEMORY_TYPE)) {
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
    properties.set(
        ContextMemoryIndex.FIELD_PINNED, MAPPER.createObjectNode().put("type", "boolean"));
    properties.set("tags", objectKeyword("tagFQN"));
    properties.set("domains", objectKeyword("name"));
    properties.set("tier", objectKeyword("tagFQN"));
    properties.set("certification", certificationMapping());
    // owners is a `nested` type: NLQ owner filters run a nested query over owners.name, and the
    // context memory visibility filter runs one over owners.id.
    properties.set("owners", nestedOwnersMapping());
    properties.set("service", nameDisplayNameObject());
    properties.set("database", nameDisplayNameObject());
    // Map name+displayName like service/database: buildDenormalizedFields copies both onto the
    // chunk doc, so mapping only `name` would leave the denormalized displayName in _source but
    // unindexed (dynamic:false), silently unfilterable and inconsistent with the entity index.
    properties.set("databaseSchema", nameDisplayNameObject());
    properties.set("columns", columnsMapping());
    properties.set(
        "relatedTerms", MAPPER.createObjectNode().put("type", "object").put("enabled", false));
    // Display-only: semantic_search returns a metric's expression, nothing filters or scores on it,
    // and the code is already searchable through textToEmbed. `enabled: false` keeps it in _source
    // without paying to index it on a dynamic:false index.
    properties.set(
        "metricExpression", MAPPER.createObjectNode().put("type", "object").put("enabled", false));
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

  private ObjectNode nestedOwnersMapping() {
    var properties = MAPPER.createObjectNode();
    properties.set("name", MAPPER.createObjectNode().put("type", "keyword"));
    properties.set("id", MAPPER.createObjectNode().put("type", "keyword"));
    return (ObjectNode)
        MAPPER.createObjectNode().put("type", "nested").set("properties", properties);
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
  public void updateEntityEmbeddingChunks(EntityInterface<?> entity, String chunkIndexName) {
    try {
      if (!writeChunksIfStale(entity, chunkIndexName)) {
        LOG.debug("Embedding provider unavailable; skipping chunks of {}", entity.getId());
      }
    } catch (EmbeddingUnavailableException unavailable) {
      LOG.debug("Skipping chunk embeddings for {}: {}", entity.getId(), unavailable.getMessage());
    } catch (Exception e) {
      LOG.error("Failed to update chunk embeddings for {}: {}", entity.getId(), e.getMessage(), e);
    }
  }

  /**
   * Writes the entity's chunks into {@code chunkIndexName} when they are stale. Returns false,
   * without calling the provider, when they need re-embedding while the provider is unavailable.
   */
  private boolean writeChunksIfStale(EntityInterface<?> entity, String chunkIndexName)
      throws IOException {
    String parentId = entity.getId().toString();
    ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
    String currentFingerprint = VectorDocBuilder.computeFingerprintForEntity(entity);
    ChunkRefresh refresh = chunkRefresh(entity, currentFingerprint, header);
    boolean written = refresh != ChunkRefresh.REEMBED || embeddingClient.isAvailable();
    if (refresh == ChunkRefresh.NONE) {
      LOG.debug("Skipping chunk embedding for {} - content and filters current", parentId);
    } else if (written) {
      List<Map<String, Object>> chunkDocs =
          refresh == ChunkRefresh.RESTAMP
              ? rebuildChunksReusingEmbeddings(entity, chunkIndexName, parentId, header)
              : VectorDocBuilder.fromEntity(entity, embeddingClient);
      replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
    }
    return written;
  }

  /**
   * Rebuild an entity's chunk docs for a docVersion migration by reusing the embeddings already
   * stored on those chunk docs (fingerprint unchanged ⇒ same body ⇒ same chunking ⇒ 1:1 reusable
   * vectors), so only the denormalized fields and {@code docVersion} change and no embedding call is
   * made. Falls back to a full re-embed if the cached vectors can't all be recovered (partial/corrupt
   * chunk set) or the re-chunk disagrees with the cached count.
   */
  private List<Map<String, Object>> rebuildChunksReusingEmbeddings(
      EntityInterface<?> entity, String chunkIndexName, String parentId, ChunkHeader header) {
    return rebuildChunksReusingEmbeddings(entity, chunkIndexName, parentId, header, null);
  }

  private List<Map<String, Object>> rebuildChunksReusingEmbeddings(
      EntityInterface<?> entity,
      String chunkIndexName,
      String parentId,
      ChunkHeader header,
      String ontologyBody) {
    Map<Integer, float[]> vectors =
        fetchExistingChunkVectors(chunkIndexName, parentId, header.chunkCount());
    List<Map<String, Object>> chunkDocs;
    if (vectors.size() == header.chunkCount()) {
      chunkDocs = reuseEmbeddingsOrReembed(entity, parentId, vectors, ontologyBody);
    } else {
      LOG.info(
          "Chunk docVersion rebuild for {} recovered {}/{} cached vectors; re-embedding",
          parentId,
          vectors.size(),
          header.chunkCount());
      chunkDocs = VectorDocBuilder.fromEntity(entity, embeddingClient, ontologyBody);
    }
    return chunkDocs;
  }

  private List<Map<String, Object>> reuseEmbeddingsOrReembed(
      EntityInterface<?> entity,
      String parentId,
      Map<Integer, float[]> vectors,
      String ontologyBody) {
    List<Map<String, Object>> chunkDocs;
    try {
      chunkDocs = VectorDocBuilder.fromEntityReusingEmbeddings(entity, vectors, ontologyBody);
    } catch (RuntimeException e) {
      LOG.info(
          "Chunk docVersion rebuild for {} fell back to re-embedding: {}",
          parentId,
          e.getMessage());
      chunkDocs = VectorDocBuilder.fromEntity(entity, embeddingClient, ontologyBody);
    }
    return chunkDocs;
  }

  /**
   * Batch-fetch the stored embedding vectors for an entity's chunk docs ({@code <parentId>_0..N-1}),
   * keyed by {@code chunkIndex}. Pulls only {@code embedding}+{@code chunkIndex} so the large vector
   * payload is the only thing on the wire.
   */
  private Map<Integer, float[]> fetchExistingChunkVectors(
      String chunkIndexName, String parentId, int chunkCount) {
    Map<Integer, float[]> vectors = new HashMap<>();
    if (chunkCount > 0) {
      try {
        List<String> ids = new ArrayList<>(chunkCount);
        for (int i = 0; i < chunkCount; i++) {
          ids.add(parentId + "_" + i);
        }
        List<String> sourceFields = List.of("embedding", "chunkIndex");
        for (JsonNode source : multiGetSources(chunkIndexName, ids, sourceFields).values()) {
          float[] vector = toFloatArray(source.path("embedding"));
          if (vector != null) {
            vectors.put(source.path("chunkIndex").asInt(0), vector);
          }
        }
      } catch (Exception e) {
        LOG.warn(
            "Failed to fetch existing chunk vectors for {}; will re-embed: {}",
            parentId,
            e.getMessage(),
            e);
      }
    }
    return vectors;
  }

  private static float[] toFloatArray(JsonNode node) {
    float[] out = null;
    if (node != null && node.isArray() && !node.isEmpty()) {
      out = new float[node.size()];
      for (int i = 0; i < node.size(); i++) {
        out[i] = (float) node.get(i).asDouble();
      }
    }
    return out;
  }

  /** Header of an entity's chunk set, read from chunk 0. */
  record ChunkHeader(
      String fingerprint,
      int chunkCount,
      int docVersion,
      String status,
      String anchorId,
      MemoryKind memoryKind) {}

  /** The memory kind a chunk was stamped with; filters read it, the fingerprint does not see it. */
  record MemoryKind(String scope, String type, boolean pinned) {
    static MemoryKind of(ContextMemory memory) {
      return new MemoryKind(
          ContextMemoryIndex.memoryScopeValue(memory),
          ContextMemoryIndex.memoryTypeValue(memory),
          Boolean.TRUE.equals(memory.getPinned()));
    }

    static MemoryKind read(JsonNode source) {
      return new MemoryKind(
          source.path(ContextMemoryIndex.FIELD_MEMORY_SCOPE).asText(null),
          source.path(ContextMemoryIndex.FIELD_MEMORY_TYPE).asText(null),
          source.path(ContextMemoryIndex.FIELD_PINNED).asBoolean(false));
    }
  }

  /** How an entity's stored chunks must be brought up to date. */
  enum ChunkRefresh {
    NONE,
    /** Same embedded text: rewrite the metadata around the stored vectors, at no embedding cost. */
    RESTAMP,
    REEMBED
  }

  static ChunkRefresh chunkRefresh(
      EntityInterface<?> entity, String fingerprint, ChunkHeader header) {
    ChunkRefresh refresh = ChunkRefresh.NONE;
    if (header == null || !fingerprint.equals(header.fingerprint())) {
      refresh = ChunkRefresh.REEMBED;
    } else if (docVersionStale(header) || memoryFilterChanged(entity, header)) {
      refresh = ChunkRefresh.RESTAMP;
    }
    return refresh;
  }

  // Status and anchor gate memory visibility, and the kind narrows a filtered recall; none of them
  // is embedded text, so the fingerprint cannot see them change.
  private static boolean memoryFilterChanged(EntityInterface<?> entity, ChunkHeader header) {
    return entity instanceof ContextMemory memory
        && (!Objects.equals(ContextMemoryIndex.statusValue(memory), header.status())
            || !ContextMemoryIndex.anchorId(memory).equals(header.anchorId())
            || !MemoryKind.of(memory).equals(header.memoryKind()));
  }

  /**
   * A recreate in flight would otherwise promote the chunks it copied before this update, the same
   * staleness {@link #deleteEntityChunks} guards against for deletes.
   */
  private void mirrorToStagedGeneration(String parentId, List<Map<String, Object>> chunkDocs) {
    String staged = resolveChunkSinkTarget();
    if (staged == null) {
      LOG.debug("No staged chunk generation to mirror the live update for {}", parentId);
    } else if (!canHoldVectors(staged)) {
      LOG.debug("Staged chunk index {} cannot hold the model's vectors; not mirroring", staged);
    } else {
      try {
        replaceChunks(staged, parentId, chunkDocs, previousCount(getChunkHeader(staged, parentId)));
      } catch (IOException | RuntimeException e) {
        logMissedMirror(staged, parentId, e);
      }
    }
  }

  /**
   * A missed mirror leaves the generation with the chunks the reindex wrote for the entity, which
   * the entity's next edit or the next reindex refreshes, so it never blocks promotion. The first
   * miss per generation on this node is a warning; the rest are debug.
   */
  private void logMissedMirror(String staged, String parentId, Exception failure) {
    if (warnedMirrorGenerations.add(staged)) {
      LOG.warn(
          "Could not mirror a live edit of {} into staged chunk index {}: {}. It keeps the chunks "
              + "the reindex wrote until the entity's next edit or the next reindex; later missed "
              + "mirrors into it are logged at debug",
          parentId,
          staged,
          failure.getMessage());
    } else {
      LOG.debug("Could not mirror {} into staged {}: {}", parentId, staged, failure.getMessage());
    }
  }

  private static boolean docVersionStale(ChunkHeader header) {
    return header != null && header.docVersion() < VectorDocBuilder.CHUNK_DOC_VERSION;
  }

  private static int previousCount(ChunkHeader header) {
    return header == null ? 0 : header.chunkCount();
  }

  /**
   * Real-time by-id GET of chunk 0's content and filter metadata. It sees unrefreshed writes and
   * avoids a search request on each entity update.
   */
  private ChunkHeader getChunkHeader(String indexName, String parentId) {
    ChunkHeader header = null;
    try {
      String endpoint =
          "/" + indexName + "/_doc/" + parentId + "_0?_source_includes=" + CHUNK_HEADER_FIELDS;
      RawResponse response = performRequest("GET", endpoint, null);
      JsonNode root =
          response.status() < 400
              ? MAPPER.readTree(bodyOrEmptyObject(response))
              : MAPPER.missingNode();
      if (root.path("found").asBoolean(false)) {
        JsonNode source = root.path("_source");
        header =
            new ChunkHeader(
                source.path("fingerprint").asText(null),
                source.path("chunkCount").asInt(0),
                source.path("docVersion").asInt(0),
                source.path(ContextMemoryIndex.FIELD_STATUS).asText(null),
                source.path(ContextMemoryIndex.FIELD_ANCHOR_ID).asText(null),
                MemoryKind.read(source));
      }
    } catch (Exception e) {
      LOG.debug("No chunk header for {} in {}: {}", parentId, indexName, e.getMessage());
    }
    return header;
  }

  /**
   * Overwrites chunk ids {@code 0..N-1} and deletes the trailing stale ids {@code
   * N..previousCount-1} left behind by a shrinking body. Deletes are by id, so they do not depend
   * on search visibility of prior writes. An empty set removes the parent's chunks.
   */
  private void replaceChunks(
      String indexName, String parentId, List<Map<String, Object>> chunkDocs, int previousCount)
      throws IOException {
    if (chunkDocs.isEmpty()) {
      removeChunkSet(indexName, parentId, previousCount);
    } else {
      if (previousCount == 0) {
        cleanOrphanChunks(indexName, parentId);
      }
      writeChunkBulk(indexName, parentId, chunkDocs, previousCount);
    }
  }

  /**
   * Chunk 0 carries the header the next update compares against, and a bulk request is not atomic.
   * So the other chunks and the trailing deletes go first, and chunk 0 follows only when they all
   * succeeded: a rejected chunk leaves the old header, and the next update writes the set again.
   *
   * <p>The header's {@code chunkCount} is also the bound every trim and delete trusts: no chunk id
   * at or past it may be stored. A write that adds ids past the bound first raises it, see {@link
   * #reserveChunkIds}.
   */
  private void writeChunkBulk(
      String indexName, String parentId, List<Map<String, Object>> chunkDocs, int previousCount)
      throws IOException {
    if (chunkDocs.size() > Math.max(previousCount, 1)) {
      reserveChunkIds(indexName, parentId, chunkDocs.getFirst());
    }
    StringBuilder bodyChunks = new StringBuilder();
    for (int i = 1; i < chunkDocs.size(); i++) {
      appendChunkIndex(bodyChunks, indexName, parentId, i, chunkDocs.get(i));
    }
    appendChunkDeletes(bodyChunks, indexName, parentId, chunkDocs.size(), previousCount);
    sendChunkBulk(indexName, parentId, bodyChunks);
    if (!chunkDocs.isEmpty()) {
      StringBuilder header = new StringBuilder();
      appendChunkIndex(header, indexName, parentId, 0, chunkDocs.getFirst());
      sendChunkBulk(indexName, parentId, header);
    }
  }

  /**
   * Writes chunk 0 with the new {@code chunkCount} and no fingerprint before the ids past the old
   * bound. A write that then stops part way leaves a header that covers every id it wrote, so a
   * later trim or delete reaches them, and that no update reads as current, so the next one writes
   * the set again.
   */
  private void reserveChunkIds(String indexName, String parentId, Map<String, Object> header)
      throws IOException {
    Map<String, Object> pending = new LinkedHashMap<>(header);
    pending.remove(FINGERPRINT_FIELD);
    StringBuilder bulk = new StringBuilder();
    appendChunkIndex(bulk, indexName, parentId, 0, pending);
    sendChunkBulk(indexName, parentId, bulk);
  }

  /**
   * Deletes every chunk of a parent. By id up to the header's bound first, which reaches writes the
   * index has not refreshed yet, then by query for anything a header that was missing or behind
   * did not cover. Chunk 0 goes last, so a delete that stops part way keeps the header and its
   * bound for the retry.
   */
  private void removeChunkSet(String indexName, String parentId, int previousCount) {
    StringBuilder trailing = new StringBuilder();
    appendChunkDeletes(trailing, indexName, parentId, 1, previousCount);
    sendChunkBulk(indexName, parentId, trailing);
    deleteTrailingChunksByQuery(indexName, parentId);
    StringBuilder header = new StringBuilder();
    appendChunkDeletes(header, indexName, parentId, 0, 1);
    sendChunkBulk(indexName, parentId, header);
  }

  /** Deletes the parent's chunks other than chunk 0 that a refreshed search can see. */
  private void deleteTrailingChunksByQuery(String indexName, String parentId) {
    ObjectNode bool = MAPPER.createObjectNode();
    bool.putArray("filter").addObject().putObject("term").put(PARENT_ID_FIELD, parentId);
    bool.putArray("must_not").addObject().putObject("ids").putArray("values").add(parentId + "_0");
    ObjectNode body = MAPPER.createObjectNode();
    body.putObject("query").set("bool", bool);
    String response =
        executeGenericRequest(
            "POST", "/" + indexName + "/_delete_by_query?conflicts=proceed", body.toString());
    failOnDeleteByQueryFailures(indexName, parentId, response);
  }

  private void failOnDeleteByQueryFailures(String indexName, String parentId, String response) {
    JsonNode failures;
    try {
      failures = MAPPER.readTree(response).path("failures");
    } catch (IOException e) {
      throw new IllegalStateException(
          "Chunk delete for " + parentId + " in " + indexName + " returned an unparseable response",
          e);
    }
    if (!failures.isEmpty()) {
      throw new IllegalStateException(
          "Chunk delete for " + parentId + " in " + indexName + " had failures: " + failures);
    }
  }

  private static void appendChunkIndex(
      StringBuilder bulk, String indexName, String parentId, int index, Map<String, Object> doc)
      throws IOException {
    bulk.append("{\"index\":{\"_index\":\"")
        .append(indexName)
        .append("\",\"_id\":\"")
        .append(parentId)
        .append('_')
        .append(index)
        .append("\"}}\n")
        .append(MAPPER.writeValueAsString(doc))
        .append('\n');
  }

  private void sendChunkBulk(String indexName, String parentId, StringBuilder bulk) {
    if (!bulk.isEmpty()) {
      String response = executeGenericRequest("POST", "/_bulk", bulk.toString());
      failOnBulkItemErrors(indexName, parentId, response);
    }
  }

  /**
   * The bulk API reports per-item failures (rejected executions under load, mapping conflicts) as
   * HTTP 200 with {@code errors:true} — exactly the failure class a heavy reindex produces.
   * Silently accepting them would leave holes with no log trail; throwing surfaces the failure to
   * the callers' catch-and-log so a partially-written entity is at least visible in the logs.
   */
  private void failOnBulkItemErrors(String indexName, String parentId, String response) {
    try {
      JsonNode root = MAPPER.readTree(response);
      if (root.path("errors").asBoolean(false)) {
        throw new IllegalStateException(
            "Bulk chunk write for "
                + parentId
                + " into "
                + indexName
                + " had item failures: "
                + firstBulkItemErrors(root));
      }
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

  private static StringBuilder firstBulkItemErrors(JsonNode root) {
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
    return reasons;
  }

  private static final List<String> BULK_ACTIONS = List.of("index", "delete", "create");

  /**
   * Belt-and-braces for a chunk set stored without its chunk-0 header, which only a write from
   * before {@link #reserveChunkIds} can leave. {@code previousCount == 0} is overwhelmingly the
   * brand-new-entity case on the write and reindex-backfill hot paths, so the guard is the cheapest
   * primitive available — a real-time by-id existence probe of chunk 1 that never touches the
   * search layer. Only when a trailing chunk survived without its header do we pay a
   * delete-by-query heal. (A set missing both chunk 0 and chunk 1 evades the probe; a delete of the
   * parent still removes it.)
   */
  private void cleanOrphanChunks(String indexName, String parentId) {
    try {
      if (chunkDocExists(indexName, parentId + "_1")) {
        LOG.warn("Healing orphan chunk docs for parent {} with missing chunk-0 header", parentId);
        deleteTrailingChunksByQuery(indexName, parentId);
      }
    } catch (Exception e) {
      LOG.debug("Orphan chunk cleanup skipped for {}: {}", parentId, e.getMessage());
    }
  }

  /**
   * A chunk index is created by the first write, so an entity deleted before that has nothing to
   * delete. Only a 404 counts as missing: a probe that fails sends the delete, which reports its own
   * failure.
   */
  private boolean indexMissing(String indexName) {
    boolean missing;
    try {
      missing = performRequest("HEAD", "/" + indexName, null).status() == 404;
    } catch (IOException e) {
      LOG.debug("Index existence probe failed for {}: {}", indexName, e.getMessage());
      missing = false;
    }
    return missing;
  }

  private boolean chunkDocExists(String indexName, String docId) {
    boolean exists = false;
    try {
      String endpoint = "/" + indexName + "/_doc/" + docId + "?_source=false";
      exists = performRequest("HEAD", endpoint, null).status() < 300;
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
  public VectorSearchResponse search(VectorSearchParameters parameters) {
    long start = System.currentTimeMillis();
    try {
      String target = vectorSearchTarget(parameters.filters());
      Optional<String> searchable = searchableIndexes(target);
      return searchable.isPresent()
          ? searchIn(target, searchable.get(), parameters, start)
          : new VectorSearchResponse(System.currentTimeMillis() - start, List.of(), 0L, false);
    } catch (VectorSearchUnavailableException e) {
      throw e;
    } catch (Exception e) {
      LOG.error("Vector search failed: {}", e.getMessage(), e);
      throw new RuntimeException("Vector search failed", e);
    }
  }

  /** The kNN over {@code aliasName}, the indexes behind {@code target} the search may read. */
  private VectorSearchResponse searchIn(
      String target, String aliasName, VectorSearchParameters parameters, long start)
      throws IOException {
    int size = parameters.size();
    int from = parameters.from();
    int k = parameters.k();
    double threshold = parameters.threshold();
    float[] queryVector = embeddingClient.embedQuery(parameters.query());
    LinkedHashMap<String, List<Map<String, Object>>> byParent = new LinkedHashMap<>();
    int rawOffset = 0;
    long totalHits = -1L;
    boolean exhausted = false;
    int requestedParents = from + size + 1; // Fetch one extra parent so hasMore is accurate.
    int overFetchSize = Math.max(requestedParents * OVER_FETCH_MULTIPLIER, OVER_FETCH_MULTIPLIER);
    if (knnReturnsAtMostK(threshold)) {
      overFetchSize = Math.min(overFetchSize, k);
    }

    Set<String> readableAnchorIds = readableAnchors.apply(parameters);
    while (!exhausted && byParent.size() < requestedParents) {
      String queryJson =
          buildKnnSearch(
              queryVector, parameters.withPagination(overFetchSize, rawOffset), readableAnchorIds);
      String endpoint =
          SearchUtils.appendPreferenceParam("/" + aliasName + "/_search", parameters.preference());
      if (target.contains(OntologyChunkIndex.name())) {
        // The ontology chunk index is created only by the first ontology embedding write.
        endpoint += (endpoint.contains("?") ? "&" : "?") + "ignore_unavailable=true";
      }
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
  }

  /**
   * What a vector search over {@code target} reads, decided before the query is embedded: {@code
   * target} itself while every vector index can hold the embedding model's vectors, and otherwise
   * the indexes behind it that can, since a kNN on one that cannot fails the whole search and an
   * index behind an alias cannot be left out with a {@code -name} exclusion on either engine. Empty
   * when no index exists behind it, as for ontology terms before their chunk index is created.
   *
   * @throws VectorSearchUnavailableException when indexes exist behind it but none can hold them
   */
  private Optional<String> searchableIndexes(String target) throws IOException {
    Set<String> unusable =
        vectorFieldHealth().map(VectorFieldHealth::unusableIndexes).orElse(Set.of());
    return unusable.isEmpty() ? Optional.of(target) : usableIndexesBehind(target);
  }

  private Optional<String> usableIndexesBehind(String target) throws IOException {
    List<String> behind = indexesBehind(target);
    List<String> usable =
        behind.stream().filter(AbstractVectorIndexService::canHoldVectors).sorted().toList();
    if (usable.isEmpty() && !behind.isEmpty()) {
      throw new VectorSearchUnavailableException(unavailableReason());
    }
    return usable.isEmpty() ? Optional.empty() : Optional.of(String.join(",", usable));
  }

  private List<String> indexesBehind(String target) throws IOException {
    String endpoint = "/" + target + "/_alias?ignore_unavailable=true";
    List<String> indexes = new ArrayList<>();
    MAPPER
        .readTree(executeGenericRequest("GET", endpoint, null))
        .fieldNames()
        .forEachRemaining(indexes::add);
    return indexes;
  }

  private String unavailableReason() {
    EmbeddingModel model = EmbeddingModel.of(embeddingClient);
    return vectorFieldHealth()
        .flatMap(health -> health.report(model))
        .orElse("No search index can hold the vectors of the embedding model " + model.id());
  }

  /**
   * The data-asset alias, or the ontology terms' vector target when the filter asks for ontology
   * terms. A filter that mixes both reads both.
   */
  String vectorSearchTarget(Map<String, List<String>> filters) {
    List<String> types = filters == null ? null : filters.get(ENTITY_TYPE_FILTER);
    String target = getIndexAlias();
    if (types != null && types.stream().anyMatch(OntologyTermSearch::isTerm)) {
      String ontologyTarget = ontologyVectorTarget();
      target =
          types.stream().allMatch(OntologyTermSearch::isTerm)
              ? ontologyTarget
              : getIndexAlias() + "," + ontologyTarget;
    }
    return target;
  }

  private String ontologyVectorTarget() {
    return chunksOntologyTerms()
        ? OntologyChunkIndex.name()
        : Entity.getSearchRepository().getIndexOrAliasName(OntologyTermSearch.ALIAS);
  }

  private static int collectSearchHits(
      JsonNode hitsNode,
      double threshold,
      LinkedHashMap<String, List<Map<String, Object>>> byParent) {
    int pageHitCount = 0;
    for (JsonNode hit : hitsNode) {
      pageHitCount++;
      double score = hit.path("_score").asDouble(0.0);
      // OpenSearch applies a positive threshold as min_score in the query. Elasticsearch's kNN
      // has no such option, and k-based retrieval on either engine returns low-scoring
      // neighbors to fill the k count, so the threshold is enforced here as well.
      if (score < threshold) {
        continue;
      }

      Map<String, Object> hitMap = MAPPER.convertValue(hit.path("_source"), Map.class);
      hitMap.put("_score", score);

      String parentId = (String) hitMap.getOrDefault("parentId", hit.path("_id").asText());
      // Persist the fallback into the result map so consumers (e.g. SemanticSearchTool collapsing
      // chunks by entity) see the same parentId this grouping used, matching the ES service.
      hitMap.put("parentId", parentId);
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
    long total = -1L;
    if (totalNode.isIntegralNumber()) {
      total = totalNode.asLong(-1L);
    } else if (totalNode.isObject()) {
      total = totalNode.path("value").asLong(-1L);
    }
    return total;
  }

  @Override
  public String getExistingFingerprint(String indexName, String entityId) {
    String fingerprint = null;
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
        fingerprint = hits.get(0).path("_source").path("fingerprint").asText(null);
      }
    } catch (Exception e) {
      LOG.debug(
          "Failed to get fingerprint for entityId={} in index={}: {}",
          entityId,
          indexName,
          e.getMessage());
    }
    return fingerprint;
  }

  @Override
  public Map<String, String> getExistingFingerprintsBatch(
      String indexName, List<String> entityIds) {
    Map<String, String> result = Collections.emptyMap();
    if (entityIds != null && !entityIds.isEmpty()) {
      try {
        result = searchFingerprints(indexName, entityIds);
      } catch (Exception e) {
        LOG.error("Failed to batch get fingerprints in index={}: {}", indexName, e.getMessage(), e);
      }
    }
    return result;
  }

  private Map<String, String> searchFingerprints(String indexName, List<String> entityIds)
      throws IOException {
    StringBuilder idsArray = new StringBuilder("[");
    for (int i = 0; i < entityIds.size(); i++) {
      if (i > 0) idsArray.append(',');
      idsArray.append("\"").append(VectorSearchQueryBuilder.escape(entityIds.get(i))).append("\"");
    }
    idsArray.append("]");

    String query =
        "{\"size\":"
            + entityIds.size()
            + ",\"_source\":[\"fingerprint\"]"
            + ",\"query\":{\"ids\":{\"values\":"
            + idsArray
            + "}}}";

    String response = executeGenericRequest("POST", "/" + indexName + "/_search", query);
    JsonNode root = MAPPER.readTree(response);
    JsonNode hits = root.path("hits").path("hits");

    Map<String, String> result = new HashMap<>();
    for (JsonNode hit : hits) {
      String id = hit.path("_id").asText();
      String fp = hit.path("_source").path("fingerprint").asText(null);
      if (id != null && fp != null) {
        result.put(id, fp);
      }
    }
    return result;
  }

  /**
   * Two-step batch fetch of the stored embeddings a reindex may reuse, keyed by entity id. Designed
   * to keep large vector payloads off the wire for entities that will be re-embedded anyway.
   *
   * <p>Step 1 — {@code mget} only the stored {@code fingerprint} for every requested ID and keep
   * the IDs whose fingerprint equals the current one (see {@link StoredEmbeddingReuse}).
   *
   * <p>Step 2 — issue a second {@code mget} that pulls the full embedding {@code _source} only for
   * matching IDs. Entries that don't match are dropped, and the caller can rely on every returned
   * value being safe to splice into a staged index document.
   *
   * @param currentFingerprintById each entity's current fingerprint, computed only when a stored
   *     one exists
   */
  @Override
  public Map<String, JsonNode> getExistingEmbeddingsBatch(
      String indexName, Map<String, Supplier<String>> currentFingerprintById) {
    Map<String, JsonNode> reusable = Collections.emptyMap();
    if (!nullOrEmpty(currentFingerprintById)) {
      try {
        List<String> matchingIds = idsWithCurrentFingerprint(indexName, currentFingerprintById);
        if (!matchingIds.isEmpty()) {
          reusable =
              multiGetSources(indexName, matchingIds, VectorDocBuilder.EMBEDDING_SOURCE_FIELDS);
          reusable.values().removeIf(cached -> !StoredEmbeddingReuse.isSpliceable(cached));
        }
      } catch (Exception e) {
        LOG.error("Failed to batch get embeddings in index={}", indexName, e);
        reusable = Collections.emptyMap();
      }
    }
    return reusable;
  }

  private List<String> idsWithCurrentFingerprint(
      String indexName, Map<String, Supplier<String>> currentFingerprintById) throws IOException {
    List<String> entityIds = new ArrayList<>(currentFingerprintById.keySet());
    List<String> matchingIds = new ArrayList<>();
    multiGetSources(indexName, entityIds, StoredEmbeddingReuse.HEADER_FIELDS)
        .forEach(
            (id, header) -> {
              Supplier<String> currentFingerprint = currentFingerprintById.get(id);
              if (currentFingerprint != null
                  && StoredEmbeddingReuse.fingerprintMatches(id, header, currentFingerprint)) {
                matchingIds.add(id);
              }
            });
    return matchingIds;
  }

  /**
   * Realtime {@code _mget} of {@code sourceFields} for {@code ids}, keyed by document id. Ids with
   * no stored document are absent. One attempt, like the by-id reads around it.
   *
   * <p>Naming the fields is what brings a stored vector back on Elasticsearch, which leaves a
   * {@code dense_vector} out of {@code _source} unless the request asks for it.
   */
  private Map<String, JsonNode> multiGetSources(
      String indexName, List<String> ids, List<String> sourceFields) throws IOException {
    String endpoint = "/" + indexName + "/_mget?_source_includes=" + String.join(",", sourceFields);
    ObjectNode body = MAPPER.createObjectNode();
    body.set("ids", MAPPER.valueToTree(ids));
    Map<String, JsonNode> sources = new HashMap<>();
    JsonNode docs = MAPPER.readTree(requestOnce("POST", endpoint, body.toString())).path("docs");
    for (JsonNode doc : docs) {
      JsonNode source = doc.path("_source");
      if (doc.path("found").asBoolean(false) && source.isObject()) {
        sources.put(doc.path("_id").asText(), source);
      }
    }
    return sources;
  }

  public void partialUpdateEntity(
      String indexName, String entityId, Map<String, Object> embeddingFields) {
    if (canHoldVectors(indexName)) {
      try {
        sendEmbeddingUpdate(indexName, entityId, embeddingFields);
      } catch (Exception e) {
        LOG.error(
            "Failed to partial update entity {} in {}: {}", entityId, indexName, e.getMessage(), e);
      }
    } else {
      LOG.debug("{} cannot hold the model's vectors; skipping entity {}", indexName, entityId);
    }
  }

  @Override
  public boolean writeEntityEmbedding(
      String entityIndexName, String entityId, Map<String, Object> embeddingFields) {
    boolean written;
    try {
      requireVectorsFit(entityIndexName);
      sendEmbeddingUpdate(entityIndexName, entityId, embeddingFields);
      written = true;
    } catch (JsonProcessingException | RuntimeException e) {
      LOG.debug(
          "Failed to write the embedding of {} into {}: {}",
          entityId,
          entityIndexName,
          e.getMessage());
      written = false;
    }
    return written;
  }

  private void sendEmbeddingUpdate(
      String indexName, String entityId, Map<String, Object> embeddingFields)
      throws JsonProcessingException {
    String updateBody = "{\"doc\":" + MAPPER.writeValueAsString(embeddingFields) + "}";
    executeGenericRequest(
        "POST", "/" + indexName + "/_update/" + entityId + "?retry_on_conflict=3", updateBody);
  }

  @Override
  public void clearEntityEmbedding(String entityIndexName, String entityId) {
    // A doc merge cannot delete keys, so removal has to go through a script.
    try {
      String fieldsJson = MAPPER.writeValueAsString(VectorDocBuilder.EMBEDDING_SOURCE_FIELDS);
      String updateBody =
          "{\"script\":{\"source\":\"for (field in params.fields) { ctx._source.remove(field) }\","
              + "\"params\":{\"fields\":"
              + fieldsJson
              + "}}}";
      executeGenericRequest(
          "POST",
          "/" + entityIndexName + "/_update/" + entityId + "?retry_on_conflict=3",
          updateBody);
    } catch (Exception e) {
      LOG.error(
          "Failed to clear embedding for entity {} in {}: {}",
          entityId,
          entityIndexName,
          e.getMessage(),
          e);
    }
  }

  @Override
  public String executeGenericRequest(String method, String endpoint, String body) {
    try {
      return GENERIC_REQUEST_RETRY.executeSupplier(
          () -> executeGenericRequestAttempt(method, endpoint, body));
    } catch (RuntimeException e) {
      Throwable cause = e instanceof UncheckedIOException ? e.getCause() : e;
      LOG.error("Generic request failed: {} {}", method, endpoint, cause);
      throw new RuntimeException(engineName() + " generic request failed", cause);
    }
  }

  private String executeGenericRequestAttempt(String method, String endpoint, String body) {
    try {
      return requestOnce(method, endpoint, body);
    } catch (IOException e) {
      throw new UncheckedIOException(e);
    }
  }

  private String requestOnce(String method, String endpoint, String body) throws IOException {
    RawResponse response = performRequest(method, endpoint, body);
    if (response.status() >= 400) {
      throw failedRequest(response);
    }
    return bodyOrEmptyObject(response);
  }

  private IOException failedRequest(RawResponse response) {
    String errorBody = Objects.requireNonNullElse(response.body(), "no body");
    String message =
        engineName() + " request failed with status " + response.status() + ": " + errorBody;
    return response.status() >= 500 && errorBody.contains(ALREADY_CLOSED_EXCEPTION)
        ? new ClosedSegmentException(message)
        : new IOException(message);
  }

  private static String bodyOrEmptyObject(RawResponse response) {
    return Objects.requireNonNullElse(response.body(), "{}");
  }

  private static final class ClosedSegmentException extends IOException {
    private ClosedSegmentException(String message) {
      super(message);
    }
  }
}
