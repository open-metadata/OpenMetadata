package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicLong;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.vector.client.EmbeddingModel;

class VectorFieldHealthTest {
  private static final EmbeddingModel MODEL = new EmbeddingModel("model-b", 768);

  private final AtomicLong now = new AtomicLong(1_000_000_000L);
  private final List<String> rechecked = new ArrayList<>();
  private final VectorFieldHealth health = new VectorFieldHealth(rechecked::add, now::get);

  private static LiveEmbeddingField heldAs(String name, String index, int dimensions) {
    return new LiveEmbeddingField(
        name,
        Set.of(index),
        Map.of(index, new LiveEmbeddingField.Declared("dense_vector", dimensions)),
        Map.of(),
        Set.of(),
        null);
  }

  private void recordMismatch(String name, String index) {
    health.record(heldAs(name, index, 384), MODEL, EmbeddingFieldUpdate.LEAVE_OUT);
  }

  @Test
  void anIndexThatCannotHoldTheModelIsLeftOutByNameAndByTheIndexBehindIt() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    assertFalse(health.canHold("table_search_index"));
    assertFalse(health.canHold("table_search_index_rebuild_1"));
    assertTrue(health.canHold("glossary_term_search_index"));
    assertEquals(
        Set.of("table_search_index", "table_search_index_rebuild_1"), health.unusableIndexes());
  }

  @Test
  void aFieldThatHoldsTheModelClearsTheIndex() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    health.record(
        heldAs("table_search_index", "table_search_index_rebuild_2", 768),
        MODEL,
        EmbeddingFieldUpdate.KEEP);

    assertTrue(health.canHold("table_search_index"));
    assertTrue(health.mismatches().isEmpty());
  }

  @Test
  void aBlockedIndexIsReadAgainAtMostOnceAMinute() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    health.canHold("table_search_index");
    now.addAndGet(VectorFieldHealth.RECHECK_AFTER.toNanos() - 1);
    health.canHold("table_search_index_rebuild_1");
    assertTrue(rechecked.isEmpty(), "not due yet");

    now.addAndGet(1);
    health.canHold("table_search_index_rebuild_1");
    health.canHold("table_search_index");
    assertEquals(List.of("table_search_index"), rechecked, "one read for both lookups");
  }

  @Test
  void theStatusPageReadsEveryBlockedOrUnreadableIndexAgainAtOnce() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");
    health.record(
        LiveEmbeddingField.unreadable("topic_search_index", "503"),
        MODEL,
        EmbeddingFieldUpdate.LEAVE_OUT);

    health.recheckAll();

    assertEquals(List.of("table_search_index", "topic_search_index"), rechecked);
  }

  @Test
  void aBlockedIndexStaysBlockedWhileItCannotBeReadAgain() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    health.record(
        LiveEmbeddingField.unreadable("table_search_index", "timeout"),
        MODEL,
        EmbeddingFieldUpdate.LEAVE_OUT);

    assertFalse(health.canHold("table_search_index"));
    assertEquals(1, health.mismatches().size());
  }

  @Test
  void everyMismatchIsReportedInOneMessageWithWhatItHoldsAndTheWayOut() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");
    recordMismatch("glossary_term_search_index", "glossary_term_search_index");
    health.recordCannotHold(
        "data_asset_embeddings_chunks",
        Set.of("data_asset_embeddings_chunks_g1"),
        "data_asset_embeddings_chunks_g1 holds vectors of model model-a");

    String report = health.report(MODEL).orElseThrow();

    assertTrue(
        report.startsWith(
            "Semantic search needs a rebuild of 3 search indexes, which cannot hold the vectors "
                + "of the configured embedding model model-b (768 dimensions): "
                + "data_asset_embeddings_chunks (data_asset_embeddings_chunks_g1 holds vectors of "
                + "model model-a), glossary_term_search_index (glossary_term_search_index has "
                + "dense_vector of 384 dimensions), table_search_index "
                + "(table_search_index_rebuild_1 has dense_vector of 384 dimensions)."),
        report);
    assertTrue(report.contains("Vector writes and vector search leave them out until then."));
    assertTrue(report.contains("Search Indexing for all entities with Recreate Indexes on"));
    assertTrue(report.contains("./bootstrap/openmetadata-ops.sh reindex --force"));
    assertTrue(report.contains("configure the previous embedding model again"));
  }

  @Test
  void anUnreadableFieldIsReportedButDoesNotKeepVectorsAway() {
    health.record(
        LiveEmbeddingField.unreadable("table_search_index", "not JSON"),
        MODEL,
        EmbeddingFieldUpdate.LEAVE_OUT);

    assertTrue(health.canHold("table_search_index"));
    assertEquals(
        "The embedding field of 1 search index could not be read, so it was left as it is: "
            + "table_search_index (not JSON).",
        health.report(MODEL).orElseThrow());
  }

  @Test
  void nothingIsReportedWhenEveryIndexHoldsTheModel() {
    health.record(
        heldAs("table_search_index", "table_search_index", 768), MODEL, EmbeddingFieldUpdate.KEEP);

    assertTrue(health.report(MODEL).isEmpty());
  }

  @Test
  void aRebuildReadsOnlyAnIndexThatWasRecordedAgain() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    health.refresh("glossary_term_search_index");
    health.refresh("table_search_index");

    assertEquals(List.of("table_search_index"), rechecked);
  }

  @Test
  void aForgottenIndexIsNoLongerLeftOut() {
    recordMismatch("table_search_index", "table_search_index_rebuild_1");

    health.forget("table_search_index");

    assertTrue(health.canHold("table_search_index_rebuild_1"));
  }
}
