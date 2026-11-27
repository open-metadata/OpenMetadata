package org.openmetadata.service.search.vector;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.service.search.vector.VectorIndexService.DeletedEntityChunksRemoved;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;

/**
 * Removes the chunk sets of entities that no longer exist or are soft deleted. Until the vector
 * handler cleaned up the descendants of a recursive delete, such a delete left their chunks behind,
 * still matched by every kNN. Parents are paged through a composite aggregation on their id and
 * entity type. The entities of a page are looked up a type at a time, and the chunk sets of those
 * not found live are deleted by their header bound, a batch at a time.
 */
@Slf4j
final class DeletedEntityChunkSweep {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final int PARENTS_PER_PAGE = 500;
  private static final String PARENTS = "parents";
  private static final String PARENT_ID = "parentId";
  private static final String ENTITY_TYPE = "entityType";

  /** The requests the sweep sends. */
  interface Requests {
    /** A search every shard answered in full; a partial or timed out answer throws. */
    JsonNode search(String index, String body);

    /** Deletes the chunk sets of {@code parentIds}; returns those still stored, with why. */
    Map<String, Exception> deleteChunkSets(String index, List<String> parentIds);
  }

  private final Requests requests;

  DeletedEntityChunkSweep(Requests requests) {
    this.requests = requests;
  }

  /** Deletes the chunks of every parent of {@code index} that {@code live} does not report. */
  DeletedEntityChunksRemoved sweep(String index, LiveEntities live) {
    int removed = 0;
    JsonNode afterKey = null;
    boolean morePages = true;
    while (morePages) {
      JsonNode parents =
          requests.search(index, parentsPage(afterKey)).path("aggregations").path(PARENTS);
      removed += removeDeleted(index, parentsByType(parents.path("buckets")), live);
      afterKey = parents.path("after_key");
      morePages = !parents.path("buckets").isEmpty() && afterKey.isObject();
    }
    return new DeletedEntityChunksRemoved(index, removed);
  }

  private static Map<String, List<String>> parentsByType(JsonNode buckets) {
    Map<String, List<String>> byType = new LinkedHashMap<>();
    for (JsonNode bucket : buckets) {
      JsonNode key = bucket.path("key");
      byType
          .computeIfAbsent(key.path(ENTITY_TYPE).asText(""), type -> new ArrayList<>())
          .add(key.path(PARENT_ID).asText());
    }
    return byType;
  }

  /** Throws when a chunk set of a deleted entity is still stored, so the pass is not recorded. */
  private int removeDeleted(String index, Map<String, List<String>> byType, LiveEntities live) {
    List<String> deleted = new ArrayList<>();
    byType.forEach(
        (entityType, parentIds) -> {
          if (entityType.isEmpty()) {
            LOG.debug("Keeping the chunks of {} parents with no entity type", parentIds.size());
          } else {
            Set<String> found = live.of(entityType, parentIds);
            parentIds.stream().filter(id -> !found.contains(id)).forEach(deleted::add);
          }
        });
    if (!deleted.isEmpty()) {
      Map<String, Exception> kept = requests.deleteChunkSets(index, deleted);
      if (!kept.isEmpty()) {
        Exception first = kept.values().iterator().next();
        throw new IllegalStateException(
            "Could not delete the chunks of "
                + kept.size()
                + " deleted entities from "
                + index
                + ": "
                + first.getMessage(),
            first);
      }
    }
    return deleted.size();
  }

  private static String parentsPage(JsonNode afterKey) {
    ObjectNode composite = MAPPER.createObjectNode().put("size", PARENTS_PER_PAGE);
    ArrayNode sources = composite.putArray("sources");
    sources.addObject().putObject(PARENT_ID).putObject("terms").put("field", PARENT_ID);
    sources
        .addObject()
        .putObject(ENTITY_TYPE)
        .putObject("terms")
        .put("field", ENTITY_TYPE)
        .put("missing_bucket", true);
    if (afterKey != null) {
      composite.set("after", afterKey);
    }
    ObjectNode parents = MAPPER.createObjectNode();
    parents.set("composite", composite);
    ObjectNode body = MAPPER.createObjectNode().put("size", 0);
    body.putObject("aggs").set(PARENTS, parents);
    return body.toString();
  }
}
