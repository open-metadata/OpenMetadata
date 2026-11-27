package org.openmetadata.service.search.vector;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;
import java.util.stream.IntStream;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.ChunkHeader;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.DocVersion;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.MemoryKind;
import org.openmetadata.service.search.vector.AbstractVectorIndexService.StoredChunks;

/**
 * The deletes of many chunk sets, against an index that answers each bulk item as a cluster does:
 * a delete over a version refuses a newer one, and an item can fail on its own.
 */
class ChunkSetsDeleteTest {
  private static final ObjectMapper MAPPER = new ObjectMapper();
  private static final String INDEX = "data_asset_embeddings_chunks";

  private Index index;
  private ChunkSetsDelete delete;

  @BeforeEach
  void setUp() {
    index = new Index();
    delete = new ChunkSetsDelete(index);
  }

  @Test
  void manyParentsCostOneHeaderReadAndTwoBulks() {
    List<String> parents = List.of(parent(0), parent(1), parent(3), parent(1), parent(3));

    Map<String, Exception> failed = delete.delete(INDEX, parents);

    assertEquals(Map.of(), failed);
    assertEquals(Set.of(), index.chunkIds());
    assertEquals(1, index.headerReads, "one read of every header");
    assertEquals(2, index.bulks, "the chunks past the headers, then the headers");
  }

  @Test
  void parentsWithOnlyAHeaderSendNoBulkForTheChunksPastIt() {
    delete.delete(INDEX, List.of(parent(1), parent(1)));

    assertEquals(Set.of(), index.chunkIds());
    assertEquals(1, index.bulks);
  }

  @Test
  void parentsWithNoChunksCostOnlyTheRead() {
    delete.delete(INDEX, List.of(parent(0), parent(0)));

    assertEquals(1, index.headerReads);
    assertEquals(0, index.bulks);
  }

  /** The header bounds the chunks past it, so it stays until they are all gone. */
  @Test
  void aParentWhoseChunkPastTheHeaderWasNotDeletedKeepsItsHeader() {
    String kept = parent(3);
    String gone = parent(3);
    index.failDeletesOf(kept + "_2");

    Map<String, Exception> failed = delete.delete(INDEX, List.of(kept, gone));

    assertEquals(Set.of(kept), failed.keySet());
    assertEquals(new TreeSet<>(Set.of(kept + "_0", kept + "_2")), index.chunkIds());
    index.failDeletesOf(null);
    assertEquals(Map.of(), delete.delete(INDEX, List.of(kept)));
    assertEquals(Set.of(), index.chunkIds());
  }

  /** A writer that grew the set after its header was read raised the bound the retry reads. */
  @Test
  void aHeaderAWriterChangedIsReadAgainAndDeletedOverItsNewVersion() {
    String grown = parent(1);
    String other = parent(3);
    index.beforeNextHeaderBulk(() -> index.store(grown, 4));

    Map<String, Exception> failed = delete.delete(INDEX, List.of(grown, other));

    assertEquals(Map.of(), failed);
    assertEquals(Set.of(), index.chunkIds());
    assertEquals(2, index.headerReads, "the header that changed is read again");
  }

  @Test
  void aHeaderThatKeepsChangingFailsItsParentAfterThreeDeletes() {
    String rewritten = parent(1);
    String other = parent(1);
    index.rewriteBeforeEveryHeaderBulk(rewritten);

    Map<String, Exception> failed = delete.delete(INDEX, List.of(rewritten, other));

    assertEquals(Set.of(rewritten), failed.keySet());
    assertEquals(Set.of(rewritten + "_0"), index.chunkIds());
    assertEquals(3, index.headerReads);
  }

  /** A header that cannot be read is not a missing one, so nothing of the batch is deleted. */
  @Test
  void aHeaderReadThatFailsFailsTheBatchAndDeletesNothing() {
    List<String> parents = List.of(parent(3), parent(1));
    Set<String> stored = index.chunkIds();
    index.failHeaderReads(true);

    Map<String, Exception> failed = delete.delete(INDEX, parents);

    assertEquals(Set.copyOf(parents), failed.keySet());
    assertEquals(stored, index.chunkIds());
    assertEquals(0, index.bulks);
  }

  @Test
  void moreParentsThanABatchAreDeletedABatchAtATime() {
    List<String> parents =
        IntStream.range(0, ChunkSetsDelete.BATCH_SIZE + 1).mapToObj(i -> parent(1)).toList();

    delete.delete(INDEX, parents);

    assertEquals(Set.of(), index.chunkIds());
    assertEquals(2, index.headerReads);
    assertEquals(2, index.bulks);
  }

  private String parent(int chunkCount) {
    String parentId = UUID.randomUUID().toString();
    index.store(parentId, chunkCount);
    return parentId;
  }

  /** Chunk documents by id with their versions; chunk 0 carries the count. */
  private static final class Index implements ChunkSetsDelete.Requests {
    private final Map<String, Long> versions = new LinkedHashMap<>();
    private final Map<String, Integer> counts = new HashMap<>();
    private final Set<String> failingDeletes = new HashSet<>();
    private long lastVersion;
    private boolean headerReadsFail;
    private Runnable beforeNextHeaderBulk;
    private String rewrittenBeforeEveryHeaderBulk;
    private int headerReads;
    private int bulks;

    void store(String parentId, int chunkCount) {
      for (int i = 0; i < chunkCount; i++) {
        versions.put(parentId + "_" + i, ++lastVersion);
      }
      counts.put(parentId, chunkCount);
    }

    void failDeletesOf(String chunkId) {
      failingDeletes.clear();
      if (chunkId != null) {
        failingDeletes.add(chunkId);
      }
    }

    void failHeaderReads(boolean failing) {
      headerReadsFail = failing;
    }

    void beforeNextHeaderBulk(Runnable writer) {
      beforeNextHeaderBulk = writer;
    }

    void rewriteBeforeEveryHeaderBulk(String parentId) {
      rewrittenBeforeEveryHeaderBulk = parentId;
    }

    Set<String> chunkIds() {
      return new TreeSet<>(versions.keySet());
    }

    @Override
    public Map<String, StoredChunks> readHeaders(String indexName, List<String> parentIds) {
      headerReads++;
      if (headerReadsFail) {
        throw new IllegalStateException("503 after retries");
      }
      Map<String, StoredChunks> stored = new LinkedHashMap<>();
      for (String parentId : parentIds) {
        Long version = versions.get(parentId + "_0");
        stored.put(
            parentId,
            version == null
                ? StoredChunks.NONE
                : new StoredChunks(
                    new ChunkHeader(
                        "fp",
                        counts.get(parentId),
                        1,
                        null,
                        null,
                        new MemoryKind(null, null, false)),
                    new DocVersion(version, 1)));
      }
      return stored;
    }

    @Override
    public List<JsonNode> bulk(String indexName, String body) {
      bulks++;
      List<JsonNode> actions = new ArrayList<>();
      for (String line : body.split("\n")) {
        actions.add(readTree(line).path("delete"));
      }
      boolean headers = actions.stream().allMatch(a -> a.path("_id").asText().endsWith("_0"));
      if (headers) {
        runWriters();
      }
      return actions.stream().map(this::apply).toList();
    }

    private void runWriters() {
      Runnable writer = beforeNextHeaderBulk;
      beforeNextHeaderBulk = null;
      if (writer != null) {
        writer.run();
      }
      if (rewrittenBeforeEveryHeaderBulk != null) {
        store(rewrittenBeforeEveryHeaderBulk, 1);
      }
    }

    private JsonNode apply(JsonNode delete) {
      String id = delete.path("_id").asText();
      Long stored = versions.get(id);
      boolean conflict =
          delete.has("if_seq_no")
              && (stored == null || stored != delete.path("if_seq_no").asLong());
      ObjectNode item = MAPPER.createObjectNode().put("_index", INDEX).put("_id", id);
      if (failingDeletes.contains(id)) {
        item.put("status", 500).putObject("error").put("type", "engine_exception");
      } else if (conflict) {
        item.put("status", 409).putObject("error").put("type", "version_conflict");
      } else {
        item.put("status", versions.remove(id) == null ? 404 : 200);
      }
      return item;
    }

    private static JsonNode readTree(String line) {
      try {
        return MAPPER.readTree(line);
      } catch (Exception e) {
        throw new IllegalStateException(e);
      }
    }
  }
}
