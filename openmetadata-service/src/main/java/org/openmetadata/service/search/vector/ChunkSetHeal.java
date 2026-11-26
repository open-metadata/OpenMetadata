package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.LinkedHashMap;
import java.util.Map;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.DocVersion;

/**
 * Removes the chunk documents no header counts: ids at or past their parent's chunk 0 {@code
 * chunkCount}, and every chunk of a parent that has no chunk 0. A delete reaches only the ids below
 * that count, so without this they would outlive their entity. Writes made since chunk 0 became a
 * conditional write leave none. Older ones could, through a bulk that stopped part way, a header
 * read taken for a missing one, or two writers racing on one entity.
 *
 * <p>Parents are paged through a composite aggregation that compares each parent's highest chunk
 * and chunk count with its header. A parent holding chunks its header does not count is healed on
 * its own. Its chunks are listed first and its header read after, in real time. Only the chunks
 * past that header are deleted, each at the version listed, so a chunk a writer rewrote in the
 * meantime stays.
 */
@Slf4j
final class ChunkSetHeal {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int PARENTS_PER_PAGE = 500;
  private static final int MAX_CHUNKS_PER_PARENT = 10_000;
  private static final String PARENTS = "parents";
  private static final String PARENT_ID = "parentId";
  private static final String CHUNK_INDEX = "chunkIndex";
  private static final String VALUE = "value";
  private static final String DOC_COUNT = "doc_count";

  /** The requests the heal sends, each retried as every by-id chunk request is. */
  interface Requests {
    JsonNode search(String index, String body);

    int headerCount(String index, String parentId);

    void deleteUnlessRewritten(String index, String parentId, Map<String, DocVersion> chunks);
  }

  private final Requests requests;

  ChunkSetHeal(Requests requests) {
    this.requests = requests;
  }

  /** Heals every parent of {@code index} that holds chunks its header does not count. */
  int healParentsOf(String index) {
    int healed = 0;
    JsonNode afterKey = null;
    boolean morePages = true;
    while (morePages) {
      JsonNode parents =
          requests.search(index, parentsPage(afterKey)).path("aggregations").path(PARENTS);
      for (JsonNode bucket : parents.path("buckets")) {
        healed += holdsUncountedChunks(bucket) ? heal(index, parentIdOf(bucket)) : 0;
      }
      afterKey = parents.path("after_key");
      morePages = !parents.path("buckets").isEmpty() && afterKey.isObject();
    }
    return healed;
  }

  private static boolean holdsUncountedChunks(JsonNode bucket) {
    JsonNode header = bucket.path("header");
    long count = header.path("count").path(VALUE).asLong(0);
    return header.path(DOC_COUNT).asLong() == 0
        || bucket.path("maxIndex").path(VALUE).asLong(0) >= count
        || bucket.path(DOC_COUNT).asLong() > count;
  }

  private static String parentIdOf(JsonNode bucket) {
    return bucket.path("key").path(PARENT_ID).asText();
  }

  /** Returns 1 when the parent had chunks past its header, which are now deleted, and 0 if not. */
  private int heal(String index, String parentId) {
    Map<String, DocVersion> listed = listChunksPastChunkZero(index, parentId);
    int count = requests.headerCount(index, parentId);
    Map<String, DocVersion> uncounted = new LinkedHashMap<>();
    listed.forEach(
        (id, version) -> {
          if (chunkNumber(id, parentId) >= count) {
            uncounted.put(id, version);
          }
        });
    if (!uncounted.isEmpty()) {
      requests.deleteUnlessRewritten(index, parentId, uncounted);
      LOG.info(
          "Removed {} chunk documents of {} in {} that its header does not count",
          uncounted.size(),
          parentId,
          index);
    }
    return uncounted.isEmpty() ? 0 : 1;
  }

  private Map<String, DocVersion> listChunksPastChunkZero(String index, String parentId) {
    Map<String, DocVersion> chunks = new LinkedHashMap<>();
    JsonNode hits = requests.search(index, chunksOf(parentId)).path("hits").path("hits");
    for (JsonNode hit : hits) {
      chunks.put(hit.path("_id").asText(), DocVersion.of(hit));
    }
    return chunks;
  }

  /** The chunk number in {@code <parentId>_<n>}, or -1 for an id of another shape. */
  private static int chunkNumber(String id, String parentId) {
    String prefix = parentId + "_";
    int number = -1;
    if (id.startsWith(prefix)) {
      try {
        number = Integer.parseInt(id.substring(prefix.length()));
      } catch (NumberFormatException e) {
        LOG.debug("Chunk id {} has no chunk number", id);
      }
    }
    return number;
  }

  private static String parentsPage(JsonNode afterKey) {
    ObjectNode composite = MAPPER.createObjectNode().put("size", PARENTS_PER_PAGE);
    composite
        .putArray("sources")
        .addObject()
        .putObject(PARENT_ID)
        .putObject("terms")
        .put("field", PARENT_ID);
    if (afterKey != null) {
      composite.set("after", afterKey);
    }
    ObjectNode parents = MAPPER.createObjectNode();
    parents.set("composite", composite);
    ObjectNode perParent = parents.putObject("aggs");
    perParent.putObject("maxIndex").putObject("max").put("field", CHUNK_INDEX);
    ObjectNode header = perParent.putObject("header");
    header.putObject("filter").putObject("term").put(CHUNK_INDEX, 0);
    header.putObject("aggs").putObject("count").putObject("max").put("field", "chunkCount");
    ObjectNode body = MAPPER.createObjectNode().put("size", 0);
    body.putObject("aggs").set(PARENTS, parents);
    return body.toString();
  }

  private static String chunksOf(String parentId) {
    ObjectNode bool = MAPPER.createObjectNode();
    bool.putArray("filter").addObject().putObject("term").put(PARENT_ID, parentId);
    bool.putArray("must_not").addObject().putObject("ids").putArray("values").add(parentId + "_0");
    ObjectNode body =
        MAPPER
            .createObjectNode()
            .put("size", MAX_CHUNKS_PER_PARENT)
            .put("seq_no_primary_term", true)
            .put("_source", false);
    body.putObject("query").set("bool", bool);
    return body.toString();
  }
}
