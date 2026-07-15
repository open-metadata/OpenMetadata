package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.Entity;
import org.openmetadata.service.events.lifecycle.EntityLifecycleEventDispatcher;
import org.openmetadata.service.search.SearchUtils;
import org.openmetadata.service.search.vector.client.EmbeddingClient;
import org.openmetadata.service.search.vector.client.EmbeddingUnavailableException;
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
    // No-op by design. The opensearch-java client stored here was constructed
    // elsewhere and its transport is shared with OpenSearchClient and every
    // other manager. Closing the transport from here permanently shuts down
    // the HC5 IOReactor for the whole application, which was a root cause of
    // production "I/O reactor has been shut down" errors.
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
    ensureChunkIndex();
    updateEntityEmbeddingChunks(entity, getChunkIndexName());
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
      ensureChunkIndex();
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
    try {
      ensureChunkIndex();
      String chunkIndexName = getChunkIndexName();
      ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
      replaceChunks(chunkIndexName, parentId, chunkDocs, previousCount(header));
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
    try {
      String chunkIndexName = getChunkIndexName();
      ChunkHeader header = getChunkHeader(chunkIndexName, parentId);
      replaceChunks(chunkIndexName, parentId, List.of(), previousCount(header));
    } catch (Exception e) {
      LOG.debug("Failed to delete chunks for {}: {}", parentId, e.getMessage());
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

  /**
   * Idempotently creates the dedicated chunk index (dynamic:false mapping with the KNN vector and
   * the filter fields the vector query uses) and attaches the {@code dataAssetEmbeddings} alias so
   * reads cover both legacy entity-doc embeddings and the new chunk docs.
   */
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
    String writeAlias = getChunkIndexName();
    boolean ready = false;
    try {
      String current = resolvePhysicalIndex(writeAlias);
      String desired = chunkPhysicalIndexName();
      if (current == null) {
        ready = provisionFreshChunkIndex(desired, writeAlias);
      } else if (current.equals(desired) && chunkSchemaCurrent(desired)) {
        ready = ensureChunkAliases(desired, writeAlias);
      } else {
        ready = recreateChunkIndex(current, desired, writeAlias);
      }
    } catch (Exception e) {
      LOG.error("Failed to ensure chunk index (alias {}): {}", writeAlias, e.getMessage());
    }
    return ready;
  }

  /**
   * The versioned physical index the chunk write-alias fronts, e.g. {@code
   * data_asset_embeddings_chunks_000002}. A new {@link VectorDocBuilder#CHUNK_DOC_VERSION} yields a
   * new physical name so a rollover is idempotent and never collides with the outgoing index.
   */
  private String chunkPhysicalIndexName() {
    return getChunkIndexName()
        + String.format(Locale.ROOT, "_%06d", VectorDocBuilder.CHUNK_DOC_VERSION);
  }

  /**
   * What currently backs the chunk write-alias name: the physical index an alias points to, a legacy
   * concrete index literally named like the alias (pre-rollover clusters), or {@code null} when
   * nothing exists yet.
   */
  private String resolvePhysicalIndex(String writeAlias) {
    String physical = null;
    String aliasJson = executeGenericRequestQuietly("GET", "/_alias/" + writeAlias);
    if (aliasJson != null) {
      JsonNode root = readTreeQuietly(aliasJson);
      if (root != null) {
        physical = writeIndexFor(root, writeAlias);
      }
    }
    if (physical == null && indexExists(writeAlias)) {
      physical = writeAlias;
    }
    return physical;
  }

  /**
   * The physical index that is the write target of {@code writeAlias}. If the alias fans out over
   * several indices (e.g. a partial rollover left the outgoing index attached), prefer the member
   * whose {@code is_write_index} is true instead of an arbitrary first entry; fall back to the sole
   * member otherwise.
   */
  private String writeIndexFor(JsonNode aliasRoot, String writeAlias) {
    String first = null;
    String writeTarget = null;
    var names = aliasRoot.fieldNames();
    while (names.hasNext()) {
      String index = names.next();
      first = first == null ? index : first;
      boolean isWrite =
          aliasRoot
              .path(index)
              .path("aliases")
              .path(writeAlias)
              .path("is_write_index")
              .asBoolean(false);
      if (isWrite) {
        writeTarget = index;
      }
    }
    return writeTarget != null ? writeTarget : first;
  }

  private boolean chunkSchemaCurrent(String physicalIndex) {
    boolean current = false;
    try {
      String mappingJson = executeGenericRequest("GET", "/" + physicalIndex + "/_mapping", null);
      JsonNode mappings = MAPPER.readTree(mappingJson).path(physicalIndex).path("mappings");
      current =
          mappings.path("_meta").path("chunkDocVersion").asInt(0)
              >= VectorDocBuilder.CHUNK_DOC_VERSION;
    } catch (Exception e) {
      LOG.debug("Chunk schema probe failed for {}: {}", physicalIndex, e.getMessage());
    }
    return current;
  }

  private boolean provisionFreshChunkIndex(String physicalIndex, String writeAlias) {
    // Skip the PUT when a prior provision created the index but failed before the alias swap, so
    // the
    // retry completes the swap instead of erroring with resource_already_exists on every write.
    if (!indexExists(physicalIndex)) {
      executeGenericRequest("PUT", "/" + physicalIndex, buildChunkIndexMapping());
    }
    swapChunkAliases(physicalIndex, writeAlias);
    LOG.info(
        "Provisioned chunk index {} behind aliases {} / {}",
        physicalIndex,
        writeAlias,
        getSearchAlias());
    return true;
  }

  /**
   * Rebuild the chunk index under a fresh physical name and swap the aliases at zero embedding cost:
   * {@code _reindex} copies each doc's stored {@code embedding} vector and denormalized fields
   * verbatim; the new index's analyzers apply at index time. Analyzers and field types cannot be
   * changed on a live index, so this recreate is the only path to entity-index parity. Runs under the
   * {@link #ensureChunkIndex()} monitor within one JVM.
   *
   * <p>Rollover-safety across concurrent instances (e.g. a rolling deploy): the target is created
   * only when absent — never delete-then-create — so a partial or in-flight {@code desired} is healed
   * by the deterministic-id reindex rather than dropped from under another instance; the old index is
   * deleted only after the reindex verified a complete copy (see {@link #reindexChunks}); and the
   * legacy path attaches the shared read alias to the new index before dropping the old one so reads
   * never see zero chunk indices.
   */
  private boolean recreateChunkIndex(String oldIndex, String desired, String writeAlias) {
    if (oldIndex.equals(desired)) {
      // Same physical index at the current-version name: cannot reindex from itself. Re-stamp _meta
      // so a partial create that set the fields but not the version marker becomes current (the
      // schema probe then passes), then (re)attach the aliases.
      executeGenericRequest("PUT", "/" + desired + "/_mapping", chunkMetaMappingBody());
      return ensureChunkAliases(desired, writeAlias);
    }
    if (!indexExists(desired)) {
      executeGenericRequest("PUT", "/" + desired, buildChunkIndexMapping());
    }
    reindexChunks(oldIndex, desired);
    boolean legacyConcrete = oldIndex.equals(writeAlias);
    if (legacyConcrete) {
      // The legacy concrete index occupies the write-alias name. Delete it and attach both aliases
      // to the new index in ONE atomic _aliases request, so the write-alias name is never an
      // unresolved gap between the delete and the alias add. Deleting the index also detaches the
      // shared read alias, which the same request re-adds to the new index (no orphan).
      var actions = MAPPER.createArrayNode();
      actions.add(removeIndexAction(oldIndex));
      actions.add(aliasAction("add", desired, getSearchAlias(), false));
      actions.add(aliasAction("add", desired, writeAlias, true));
      runAliasActions(actions);
    } else {
      swapChunkAliases(desired, writeAlias);
      deleteIndexQuietly(oldIndex);
    }
    LOG.info("Recreated chunk index {} -> {} (aliases swapped)", oldIndex, desired);
    return true;
  }

  private void reindexChunks(String source, String dest) {
    var body = MAPPER.createObjectNode();
    body.set("source", MAPPER.createObjectNode().put("index", source));
    body.set("dest", MAPPER.createObjectNode().put("index", dest));
    // wait_for_completion=true suits modest catalogs; for very large indices switch to
    // wait_for_completion=false and poll the returned task via GET /_tasks/{taskId}.
    String response =
        executeGenericRequest(
            "POST",
            "/_reindex?wait_for_completion=true&refresh=true&slices=auto&requests_per_second=-1",
            body.toString());
    // _reindex returns HTTP 200 even when individual docs fail (reported in the body, not the
    // status). recreateChunkIndex deletes the source right after this, and the chunk embeddings are
    // the only stored copy of the vectors, so a partial copy is unrecoverable without a re-embed.
    // Fail hard here so the delete never runs and the source stays intact.
    JsonNode result = readTreeQuietly(response);
    if (result == null
        || result.path("failures").size() > 0
        || result.path("timed_out").asBoolean(false)) {
      throw new IllegalStateException(
          "Chunk reindex " + source + " -> " + dest + " had failures: " + response);
    }
  }

  private boolean ensureChunkAliases(String physicalIndex, String writeAlias) {
    swapChunkAliases(physicalIndex, writeAlias);
    return true;
  }

  /**
   * Make {@code newIndex} the sole backing of both the chunk read ({@code dataAssetEmbeddings}) and
   * write (base-name) aliases: detach them from every other index currently carrying the write alias,
   * then attach both to {@code newIndex} in one atomic request. The write alias is chunk-only, so
   * every index it backs is a chunk index — detaching the shared read alias from those never touches
   * the entity indices. This also cleans up a partial rollover that left extra indices attached.
   */
  private void swapChunkAliases(String newIndex, String writeAlias) {
    var actions = MAPPER.createArrayNode();
    for (String member : currentWriteAliasMembers(writeAlias)) {
      if (!member.equals(newIndex)) {
        actions.add(aliasAction("remove", member, getSearchAlias(), false));
        actions.add(aliasAction("remove", member, writeAlias, false));
      }
    }
    actions.add(aliasAction("add", newIndex, getSearchAlias(), false));
    actions.add(aliasAction("add", newIndex, writeAlias, true));
    runAliasActions(actions);
  }

  private List<String> currentWriteAliasMembers(String writeAlias) {
    List<String> members = new ArrayList<>();
    String aliasJson = executeGenericRequestQuietly("GET", "/_alias/" + writeAlias);
    if (aliasJson != null) {
      JsonNode root = readTreeQuietly(aliasJson);
      if (root != null) {
        root.fieldNames().forEachRemaining(members::add);
      }
    }
    return members;
  }

  private void runAliasActions(JsonNode actions) {
    var body = MAPPER.createObjectNode();
    body.set("actions", actions);
    executeGenericRequest("POST", "/_aliases", body.toString());
  }

  private void deleteIndexQuietly(String index) {
    // Tolerate a concurrent rollover having already dropped the index.
    executeGenericRequestQuietly("DELETE", "/" + index);
  }

  private ObjectNode aliasAction(String op, String index, String alias, boolean writeIndex) {
    var spec = MAPPER.createObjectNode().put("index", index).put("alias", alias);
    if (writeIndex) {
      spec.put("is_write_index", true);
    }
    if ("remove".equals(op)) {
      // Tolerate the alias/index already being gone (concurrent rollover, partial state).
      spec.put("must_exist", false);
    }
    return (ObjectNode) MAPPER.createObjectNode().set(op, spec);
  }

  /**
   * A {@code remove_index} action that deletes a concrete index inside an {@code _aliases} request.
   * Takes no {@code alias} and no {@code must_exist} — OpenSearch's parser rejects {@code must_exist}
   * on {@code remove_index}.
   */
  private ObjectNode removeIndexAction(String index) {
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .set("remove_index", MAPPER.createObjectNode().put("index", index));
  }

  private boolean indexExists(String name) {
    boolean exists = false;
    try {
      exists = client.indices().exists(e -> e.index(name)).value();
    } catch (Exception e) {
      LOG.debug("Index exists probe failed for {}: {}", name, e.getMessage());
    }
    return exists;
  }

  /**
   * A {@code GET}/{@code DELETE} probe that never logs at ERROR: an expected non-2xx (e.g. a 404
   * when probing a missing alias on a fresh cluster) returns {@code null} at DEBUG rather than the
   * ERROR that {@link #executeGenericRequest} emits. Used by the alias/index resolution probes so
   * normal startup and rollover stay quiet.
   */
  private String executeGenericRequestQuietly(String method, String endpoint) {
    String result = null;
    try {
      OpenSearchGenericClient genericClient = client.generic();
      var request = Requests.builder().endpoint(endpoint).method(method).build();
      try (var response = genericClient.execute(request)) {
        if (response.getStatus() < 400) {
          result = response.getBody().map(this::bodyAsString).orElse(null);
        } else {
          LOG.debug("Quiet {} {} -> status {}", method, endpoint, response.getStatus());
        }
      }
    } catch (Exception e) {
      LOG.debug("Quiet request {} {} failed: {}", method, endpoint, e.getMessage());
    }
    return result;
  }

  private String bodyAsString(Body body) {
    String text = null;
    try {
      text = new String(body.bodyAsBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      LOG.debug("Failed to read response body: {}", e.getMessage());
    }
    return text;
  }

  private JsonNode readTreeQuietly(String json) {
    JsonNode node = null;
    try {
      node = MAPPER.readTree(json);
    } catch (Exception e) {
      LOG.debug("Failed to parse JSON: {}", e.getMessage());
    }
    return node;
  }

  private String buildChunkIndexMapping() {
    var mappings = MAPPER.createObjectNode().put("dynamic", false);
    mappings.set("properties", buildChunkProperties());
    mappings.set("_meta", chunkMeta());
    var settings = MAPPER.createObjectNode();
    // max_ngram_diff must equal the om_ngram tokenizer span (max_gram 20 - min_gram 3 = 17); the
    // default is 1, so index creation is REJECTED without it. Validation fires at creation time, so
    // it has to live in settings.index here — it cannot be applied after the fact.
    settings.set("index", MAPPER.createObjectNode().put("knn", true).put("max_ngram_diff", 17));
    settings.set("analysis", buildChunkAnalysis());
    var root = MAPPER.createObjectNode();
    root.set("settings", settings);
    root.set("mappings", mappings);
    return root.toString();
  }

  /**
   * The {@code settings.analysis} block — om_analyzer / om_ngram / om_compound_analyzer plus their
   * filters, tokenizer and normalizer. Mirrors the block shipped in the default (English) entity
   * {@code *_index_mapping.json}; keep it in lockstep, since a drift silently re-opens the
   * keyword-parity gap on chunk docs.
   *
   * <p>Localized deployments (jp/ru/zh) use different per-language analyzers/stemmers in their entity
   * mappings. This restores full parity for the default analyzers and is a strict improvement for
   * localized clusters too (chunk docs were on the built-in standard analyzer before), but per-language
   * chunk parity — deriving this block from the configured search language — is a follow-up.
   */
  private ObjectNode buildChunkAnalysis() {
    var analysis = MAPPER.createObjectNode();
    analysis.set("tokenizer", chunkTokenizers());
    analysis.set("normalizer", chunkNormalizers());
    analysis.set("analyzer", chunkAnalyzers());
    analysis.set("filter", chunkFilters());
    return analysis;
  }

  private ObjectNode chunkTokenizers() {
    var ngram =
        MAPPER.createObjectNode().put("type", "ngram").put("min_gram", 3).put("max_gram", 20);
    ngram.set("token_chars", MAPPER.createArrayNode().add("letter").add("digit"));
    return (ObjectNode) MAPPER.createObjectNode().set("n_gram_tokenizer", ngram);
  }

  private ObjectNode chunkNormalizers() {
    var normalizer = MAPPER.createObjectNode().put("type", "custom");
    normalizer.set("char_filter", MAPPER.createArrayNode());
    normalizer.set("filter", MAPPER.createArrayNode().add("lowercase"));
    return (ObjectNode) MAPPER.createObjectNode().set("lowercase_normalizer", normalizer);
  }

  private ObjectNode chunkAnalyzers() {
    var analyzers = MAPPER.createObjectNode();
    analyzers.set(
        "om_analyzer", analyzer("standard", "lowercase", "word_delimiter_filter", "om_stemmer"));
    analyzers.set("om_ngram", customAnalyzer("n_gram_tokenizer", "lowercase"));
    analyzers.set(
        "om_compound_analyzer",
        analyzer("standard", "lowercase", "compound_word_delimiter_graph", "flatten_graph"));
    return analyzers;
  }

  private ObjectNode analyzer(String tokenizer, String... filters) {
    var node = MAPPER.createObjectNode().put("tokenizer", tokenizer);
    var arr = MAPPER.createArrayNode();
    for (String filter : filters) {
      arr.add(filter);
    }
    node.set("filter", arr);
    return node;
  }

  private ObjectNode customAnalyzer(String tokenizer, String... filters) {
    return analyzer(tokenizer, filters).put("type", "custom");
  }

  private ObjectNode chunkFilters() {
    var filters = MAPPER.createObjectNode();
    filters.set(
        "om_stemmer", MAPPER.createObjectNode().put("type", "stemmer").put("name", "kstem"));
    filters.set(
        "word_delimiter_filter",
        MAPPER.createObjectNode().put("type", "word_delimiter").put("preserve_original", true));
    filters.set("compound_word_delimiter_graph", compoundDelimiterFilter());
    return filters;
  }

  private ObjectNode compoundDelimiterFilter() {
    return MAPPER
        .createObjectNode()
        .put("type", "word_delimiter_graph")
        .put("generate_word_parts", true)
        .put("generate_number_parts", true)
        .put("split_on_case_change", true)
        .put("split_on_numerics", true)
        .put("catenate_words", false)
        .put("catenate_numbers", false)
        .put("catenate_all", false)
        .put("preserve_original", true)
        .put("stem_english_possessive", true);
  }

  private ObjectNode chunkMeta() {
    return MAPPER.createObjectNode().put("chunkDocVersion", VectorDocBuilder.CHUNK_DOC_VERSION);
  }

  /** {@code PUT _mapping} body that re-stamps only {@code _meta.chunkDocVersion} (metadata only). */
  private String chunkMetaMappingBody() {
    var body = MAPPER.createObjectNode();
    body.set("_meta", chunkMeta());
    return body.toString();
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
    for (String keyword : List.of("parentId", "fingerprint", "entityType")) {
      properties.set(keyword, MAPPER.createObjectNode().put("type", "keyword"));
    }
    // fullyQualifiedName/serviceType carry lowercase_normalizer in the entity indices, so term
    // filters stay case-insensitive and consistent with entity behavior.
    properties.set("fullyQualifiedName", normalizedKeyword());
    properties.set("serviceType", normalizedKeyword());
    // name/displayName get the full entity-index treatment: an om_analyzer text root plus .keyword
    // (lowercase_normalizer), .ngram (om_ngram) and .compound (om_compound_analyzer) subfields, so
    // the shard-fair exact/phrase/compound clauses all resolve on chunk docs (Phase-4 parity).
    properties.set("name", analyzedIdentityField(false));
    properties.set("displayName", analyzedIdentityField(true));
    for (String integer : List.of("chunkIndex", "chunkCount", "docVersion")) {
      properties.set(integer, MAPPER.createObjectNode().put("type", "integer"));
    }
    // textToEmbed/textToLLMContext are the embedding source + LLM context, never lexically scored,
    // so they stay plain standard-analyzer text.
    for (String text : List.of("textToEmbed", "textToLLMContext")) {
      properties.set(text, MAPPER.createObjectNode().put("type", "text"));
    }
    // description gets om_analyzer parity with the entity indices. fqnParts holds FQN identifier
    // tokens, so it stays keyword (matching the entity mapping) to preserve exact/aggregation
    // behavior; only synonyms is analyzed text with a .keyword subfield.
    properties.set("description", descriptionMapping());
    properties.set("fqnParts", MAPPER.createObjectNode().put("type", "keyword"));
    properties.set("synonyms", textWithKeywordSub());
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

  /**
   * An {@code om_analyzer} text root with {@code .keyword} (lowercase_normalizer), {@code .ngram}
   * (om_ngram) and {@code .compound} (om_compound_analyzer) subfields — the entity-index shape for
   * {@code name}. {@code displayName} additionally carries {@code .actualCase}.
   */
  private ObjectNode analyzedIdentityField(boolean withActualCase) {
    var fields = MAPPER.createObjectNode();
    fields.set("keyword", keywordSub("lowercase_normalizer"));
    if (withActualCase) {
      fields.set("actualCase", keywordSub(null));
    }
    fields.set("ngram", textAnalyzed("om_ngram"));
    fields.set("compound", textAnalyzed("om_compound_analyzer"));
    return (ObjectNode) textAnalyzed("om_analyzer").set("fields", fields);
  }

  private ObjectNode descriptionMapping() {
    return textAnalyzed("om_analyzer")
        .put("similarity", "boolean")
        .put("term_vector", "with_positions_offsets");
  }

  private ObjectNode textWithKeywordSub() {
    return (ObjectNode)
        MAPPER
            .createObjectNode()
            .put("type", "text")
            .set("fields", MAPPER.createObjectNode().set("keyword", keywordSub(null)));
  }

  private ObjectNode textAnalyzed(String analyzer) {
    return MAPPER.createObjectNode().put("type", "text").put("analyzer", analyzer);
  }

  private ObjectNode keywordSub(String normalizer) {
    var keyword = MAPPER.createObjectNode().put("type", "keyword").put("ignore_above", 256);
    if (normalizer != null) {
      keyword.put("normalizer", normalizer);
    }
    return keyword;
  }

  /** A top-level {@code keyword} with {@code lowercase_normalizer} (no {@code ignore_above}). */
  private ObjectNode normalizedKeyword() {
    return MAPPER
        .createObjectNode()
        .put("type", "keyword")
        .put("normalizer", "lowercase_normalizer");
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
    var fields = MAPPER.createObjectNode();
    fields.set("keyword", keywordSub("lowercase_normalizer"));
    fields.set("ngram", textAnalyzed("om_ngram"));
    var name = (ObjectNode) textAnalyzed("om_analyzer").set("fields", fields);
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
    executeGenericRequest("POST", "/_bulk", bulk.toString());
  }

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
