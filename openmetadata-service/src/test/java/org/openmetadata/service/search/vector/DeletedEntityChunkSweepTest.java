package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.VectorIndexService.DeletedEntityChunksRemoved;
import org.openmetadata.service.search.vector.VectorIndexService.LiveEntities;

class DeletedEntityChunkSweepTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String INDEX = "data_asset_embeddings_chunks";

  @Test
  void onlyTheChunksOfEntitiesNotFoundLiveAreDeleted() {
    Pages pages = new Pages(List.of(page("orders:table", "refunds:table", "sales:dashboard")));
    List<String> asked = new ArrayList<>();
    LiveEntities live =
        (type, ids) -> {
          asked.add(type + " " + ids);
          return "table".equals(type) ? Set.of("orders") : Set.of();
        };

    DeletedEntityChunksRemoved removed = new DeletedEntityChunkSweep(pages).sweep(INDEX, live);

    assertEquals(List.of(List.of("refunds", "sales")), pages.deleted);
    assertEquals(2, removed.parents());
    assertEquals(List.of("table [orders, refunds]", "dashboard [sales]"), asked);
  }

  /** A chunk with no entity type cannot be checked, so it stays. */
  @Test
  void aParentWithNoEntityTypeKeepsItsChunks() {
    Pages pages = new Pages(List.of(page("orders:", "refunds:table")));

    new DeletedEntityChunkSweep(pages).sweep(INDEX, (type, ids) -> Set.of());

    assertEquals(List.of(List.of("refunds")), pages.deleted);
  }

  @Test
  void everyPageIsReadUntilAnEmptyOne() {
    Pages pages = new Pages(List.of(page("a:table"), page("b:table"), page()));

    DeletedEntityChunksRemoved removed =
        new DeletedEntityChunkSweep(pages).sweep(INDEX, (type, ids) -> Set.of());

    assertEquals(List.of(List.of("a"), List.of("b")), pages.deleted);
    assertEquals(2, removed.parents());
    assertEquals("b", pages.afterKeys.getLast(), "each page starts after the last one");
  }

  @Test
  void aPageOfLiveEntitiesSendsNoDelete() {
    Pages pages = new Pages(List.of(page("orders:table")));

    new DeletedEntityChunkSweep(pages).sweep(INDEX, (type, ids) -> Set.copyOf(ids));

    assertEquals(List.of(), pages.deleted);
  }

  /** A pass that leaves a deleted entity's chunks behind must not be recorded as done. */
  @Test
  void aChunkSetStillStoredFailsThePass() {
    Pages pages = new Pages(List.of(page("refunds:table")));
    pages.failing = Map.of("refunds", new IllegalStateException("429 after retries"));

    assertThrows(
        IllegalStateException.class,
        () -> new DeletedEntityChunkSweep(pages).sweep(INDEX, (type, ids) -> Set.of()));
  }

  /** Each page is the buckets of one composite aggregation; the last one is empty. */
  private static ObjectNode page(String... parents) {
    ArrayNode buckets = MAPPER.createArrayNode();
    for (String parent : parents) {
      String[] idAndType = parent.split(":", -1);
      ObjectNode key = buckets.addObject().put("doc_count", 1).putObject("key");
      key.put("parentId", idAndType[0]);
      if (idAndType[1].isEmpty()) {
        key.putNull("entityType");
      } else {
        key.put("entityType", idAndType[1]);
      }
    }
    ObjectNode aggregation = MAPPER.createObjectNode();
    aggregation.set("buckets", buckets);
    if (!buckets.isEmpty()) {
      aggregation
          .putObject("after_key")
          .set("parentId", buckets.get(buckets.size() - 1).path("key").path("parentId"));
    }
    ObjectNode response = MAPPER.createObjectNode();
    response.putObject("aggregations").set("parents", aggregation);
    return response;
  }

  private static final class Pages implements DeletedEntityChunkSweep.Requests {
    private final List<ObjectNode> pages;
    private final List<List<String>> deleted = new ArrayList<>();
    private final List<String> afterKeys = new ArrayList<>();
    private Map<String, Exception> failing = Map.of();
    private int next;

    private Pages(List<ObjectNode> pages) {
      this.pages = pages;
    }

    @Override
    public JsonNode search(String index, String body) {
      JsonNode after = readTree(body).path("aggs").path("parents").path("composite").path("after");
      if (!after.isMissingNode()) {
        afterKeys.add(after.path("parentId").asText());
      }
      return next < pages.size() ? pages.get(next++) : page();
    }

    @Override
    public Map<String, Exception> deleteChunkSets(String index, List<String> parentIds) {
      deleted.add(List.copyOf(parentIds));
      return failing;
    }

    private static JsonNode readTree(String body) {
      try {
        return MAPPER.readTree(body);
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }
  }
}
