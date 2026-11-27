package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.google.common.collect.Lists;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.StoredChunks;

/**
 * Deletes every chunk of many parents in a few requests per batch: one realtime multi-get of their
 * headers, one bulk for the chunks past chunk 0, and one for the chunk 0s, each over the version
 * read. These are the deletes of one parent, in the same order, so a delete that stops part way
 * keeps the header and its bound for the retry, and a chunk 0 that changed since it was read is
 * read again and deleted over its new version, up to three times.
 */
final class ChunkSetsDelete {
  static final int BATCH_SIZE = 250;
  private static final int HEADER_DELETE_ATTEMPTS = 3;
  private static final int CONFLICT_STATUS = 409;

  /** The requests a delete sends. Each throws when the cluster does not answer it. */
  interface Requests {
    /** The stored chunk header of each parent, read in real time. */
    Map<String, StoredChunks> readHeaders(String index, List<String> parentIds);

    /** The items of one bulk of deletes. */
    List<JsonNode> bulk(String index, String body);
  }

  private final Requests requests;

  ChunkSetsDelete(Requests requests) {
    this.requests = requests;
  }

  /** Returns, for each parent whose chunks {@code index} may still hold, why. */
  Map<String, Exception> delete(String index, List<String> parentIds) {
    Map<String, Exception> failed = new HashMap<>();
    List<String> distinct = List.copyOf(new LinkedHashSet<>(parentIds));
    for (List<String> batch : Lists.partition(distinct, BATCH_SIZE)) {
      deleteBatch(index, batch, failed);
    }
    return failed;
  }

  private void deleteBatch(String index, List<String> batch, Map<String, Exception> failed) {
    List<String> changed = batch;
    for (int attempt = 1; attempt <= HEADER_DELETE_ATTEMPTS && !changed.isEmpty(); attempt++) {
      changed = deleteOnce(index, changed, failed);
    }
    for (String parentId : changed) {
      failed.put(
          parentId,
          new IllegalStateException(
              "Chunk 0 of " + parentId + " in " + index + " changed under each delete"));
    }
  }

  /** Returns the parents whose chunk 0 changed after it was read. */
  private List<String> deleteOnce(
      String index, List<String> parentIds, Map<String, Exception> failed) {
    List<String> changed = List.of();
    try {
      Map<String, StoredChunks> stored = requests.readHeaders(index, parentIds);
      Set<String> unfinished = deleteChunksPastTheHeaders(index, stored, failed);
      changed = deleteHeaders(index, stored, unfinished, failed);
    } catch (RuntimeException e) {
      parentIds.forEach(parentId -> failed.put(parentId, e));
    }
    return changed;
  }

  /** Returns the parents with a chunk past chunk 0 still stored, whose header must stay. */
  private Set<String> deleteChunksPastTheHeaders(
      String index, Map<String, StoredChunks> stored, Map<String, Exception> failed) {
    StringBuilder bulk = new StringBuilder();
    stored.forEach(
        (parentId, chunks) ->
            AbstractVectorIndexService.appendChunkDeletes(
                bulk, index, parentId, 1, chunks.count()));
    Set<String> unfinished = new HashSet<>();
    for (JsonNode item : send(index, bulk)) {
      if (item.has("error")) {
        String parentId = parentOf(item);
        unfinished.add(parentId);
        failed.put(parentId, itemFailure(index, item));
      }
    }
    return unfinished;
  }

  private List<String> deleteHeaders(
      String index,
      Map<String, StoredChunks> stored,
      Set<String> unfinished,
      Map<String, Exception> failed) {
    StringBuilder bulk = new StringBuilder();
    stored.forEach(
        (parentId, chunks) -> {
          if (chunks.header() != null && !unfinished.contains(parentId)) {
            AbstractVectorIndexService.appendChunkDelete(
                bulk, index, parentId + "_0", chunks.headerVersion());
          }
        });
    List<String> changed = new ArrayList<>();
    for (JsonNode item : send(index, bulk)) {
      boolean conflict = item.path("status").asInt() == CONFLICT_STATUS;
      if (conflict) {
        changed.add(parentOf(item));
      }
      if (!conflict && item.has("error")) {
        failed.put(parentOf(item), itemFailure(index, item));
      }
    }
    return changed;
  }

  private List<JsonNode> send(String index, StringBuilder bulk) {
    return bulk.isEmpty() ? List.of() : requests.bulk(index, bulk.toString());
  }

  // Chunk ids are <parentId>_<chunkIndex>, and a parent id is a UUID.
  private static String parentOf(JsonNode item) {
    String chunkId = item.path("_id").asText();
    return chunkId.substring(0, chunkId.lastIndexOf('_'));
  }

  private static Exception itemFailure(String index, JsonNode item) {
    JsonNode error = item.path("error");
    return new IllegalStateException(
        "Could not delete chunk "
            + item.path("_id").asText()
            + " in "
            + index
            + ": "
            + item.path("status").asInt()
            + " "
            + error.path("type").asText("?")
            + ": "
            + error.path("reason").asText("?"));
  }
}
