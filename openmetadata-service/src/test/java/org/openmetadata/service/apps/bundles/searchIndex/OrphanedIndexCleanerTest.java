package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.service.search.IndexManagementClient.IndexStats;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

class OrphanedIndexCleanerTest {

  private final OrphanedIndexCleaner cleaner = new OrphanedIndexCleaner();
  private final SearchClient searchClient = mock(SearchClient.class);

  @Test
  void orphanedIndexRecordReflectsAliasPresence() {
    assertTrue(new OrphanedIndexCleaner.OrphanedIndex("table_rebuild_1", null).isOrphaned());
    assertTrue(new OrphanedIndexCleaner.OrphanedIndex("table_rebuild_1", Set.of()).isOrphaned());
  }

  @Test
  void findOrphanedRebuildIndicesFiltersRecentAliasedAndBrokenIndices() {
    long oldTimestamp = System.currentTimeMillis() - (31L * 60 * 1000);
    long recentTimestamp = System.currentTimeMillis() - (5L * 60 * 1000);
    String oldOrphan = "table_rebuild_" + oldTimestamp;
    String oldAliased = "user_rebuild_" + oldTimestamp;
    String recentOrphan = "dashboard_rebuild_" + recentTimestamp;
    String invalidTimestamp = "topic_rebuild_invalid";
    String brokenIndex = "pipeline_rebuild_" + oldTimestamp;

    when(searchClient.listIndicesByPrefix(""))
        .thenReturn(
            Set.of(oldOrphan, oldAliased, recentOrphan, invalidTimestamp, brokenIndex, "table"));
    when(searchClient.getAliases(oldOrphan)).thenReturn(Set.of());
    when(searchClient.getAliases(oldAliased)).thenReturn(Set.of("user"));
    when(searchClient.getAliases(invalidTimestamp)).thenReturn(null);
    when(searchClient.getAliases(recentOrphan)).thenReturn(Set.of());
    when(searchClient.getAliases(brokenIndex))
        .thenThrow(new RuntimeException("alias lookup failed"));

    List<OrphanedIndexCleaner.OrphanedIndex> orphaned =
        cleaner.findOrphanedRebuildIndices(searchClient);

    assertEquals(2, orphaned.size());
    assertTrue(orphaned.stream().anyMatch(index -> index.indexName().equals(oldOrphan)));
    assertTrue(orphaned.stream().anyMatch(index -> index.indexName().equals(invalidTimestamp)));
  }

  @Test
  void cleanupOrphanedIndicesDeletesAllFoundOrphansAndCountsFailures() {
    long oldTimestamp = System.currentTimeMillis() - (31L * 60 * 1000);
    String deletedIndex = "table_rebuild_" + oldTimestamp;
    String failingIndex = "user_rebuild_" + oldTimestamp;

    when(searchClient.listIndicesByPrefix("")).thenReturn(Set.of(deletedIndex, failingIndex));
    when(searchClient.getAliases(deletedIndex)).thenReturn(Set.of());
    when(searchClient.getAliases(failingIndex)).thenReturn(Set.of());
    doThrow(new RuntimeException("delete failed")).when(searchClient).deleteIndex(failingIndex);

    OrphanedIndexCleaner.CleanupResult result = cleaner.cleanupOrphanedIndices(searchClient);

    assertEquals(2, result.found());
    assertEquals(1, result.deleted());
    assertEquals(1, result.failed());
    assertEquals(List.of(deletedIndex), result.deletedIndices());
    verify(searchClient).deleteIndex(deletedIndex);
    verify(searchClient).deleteIndex(failingIndex);
  }

  @Test
  void countMethodsReturnZeroWhenListingIndicesFails() {
    when(searchClient.listIndicesByPrefix(""))
        .thenThrow(new RuntimeException("search unavailable"));

    assertEquals(0, cleaner.countRebuildIndices(searchClient));
    assertEquals(0, cleaner.countOrphanedIndices(searchClient));
  }

  @Test
  void countMethodsUseBulkInventory() {
    long oldTimestamp = System.currentTimeMillis() - (31L * 60 * 1000);
    long recentTimestamp = System.currentTimeMillis() - (5L * 60 * 1000);
    List<IndexStats> indexStats =
        List.of(
            indexStats("table_rebuild_" + oldTimestamp, Set.of()),
            indexStats("user_rebuild_" + oldTimestamp, Set.of("user")),
            indexStats("dashboard_rebuild_" + recentTimestamp, Set.of()),
            indexStats("topic", Set.of()));

    assertEquals(3, cleaner.countRebuildIndices(indexStats));
    assertEquals(1, cleaner.countOrphanedIndices(indexStats));
  }

  @Test
  @DisplayName("private orphan checks require rebuild naming and tolerate alias lookup errors")
  void privateOrphanChecksHandleNamingAndAliasFailures() throws Exception {
    when(searchClient.getAliases("table_rebuild_1")).thenReturn(Set.of());
    when(searchClient.getAliases("user_rebuild_1")).thenThrow(new RuntimeException("boom"));

    assertFalse(invokeBoolean("isOrphaned", "table"));
    assertTrue(invokeBoolean("isOrphaned", "table_rebuild_1"));
    assertFalse(invokeBoolean("isOrphaned", "user_rebuild_1"));
  }

  @Test
  void privateAgeCheckTreatsNamesWithoutParsableTimestampAsEligible() throws Exception {
    long now = System.currentTimeMillis();

    assertTrue(invokeIsOldEnough("table", now));
    assertTrue(invokeIsOldEnough("table_rebuild_invalid", now));
  }

  /**
   * The registry as {@code main} ships it: 1.12's {@code aiAgent} was renamed to
   * {@code aiApplication}, so nothing maps to {@code ai_agent_search_index} any more.
   */
  private static final IndexMapping AI_APPLICATION_MAPPING =
      IndexMapping.builder()
          .indexName("ai_application_search_index")
          .alias("aiApplication")
          .parentAliases(List.of("all", "dataAssetEmbeddings"))
          .indexMappingFile("/elasticsearch/%s/ai_application_index_mapping.json")
          .build();

  private SearchRepository aiApplicationOnlyRepository() {
    SearchRepository repository = mock(SearchRepository.class);
    when(repository.getSearchClient()).thenReturn(searchClient);
    when(repository.getEntityIndexMap())
        .thenReturn(Map.of("aiApplication", AI_APPLICATION_MAPPING));
    when(repository.getClusterAlias()).thenReturn(null);
    return repository;
  }

  /**
   * A stateful stand-in for the cluster's alias table, so these tests assert the alias membership
   * the sweep leaves behind rather than the calls it made. A client that takes {@code removeAliases}
   * and fails to mutate anything reads as a failure here, which pure call-verification would miss.
   */
  private Map<String, Set<String>> stubAliasTable(Map<String, Set<String>> initial) {
    Map<String, Set<String>> aliases = new HashMap<>();
    initial.forEach((alias, indexes) -> aliases.put(alias, new LinkedHashSet<>(indexes)));
    when(searchClient.getIndicesByAlias(anyString()))
        .thenAnswer(call -> Set.copyOf(aliases.getOrDefault(call.getArgument(0), Set.of())));
    doAnswer(
            call -> {
              String index = call.getArgument(0);
              Set<String> removed = call.getArgument(1);
              removed.forEach(
                  alias -> aliases.getOrDefault(alias, new LinkedHashSet<>()).remove(index));
              return null;
            })
        .when(searchClient)
        .removeAliases(anyString(), any());
    return aliases;
  }

  @Test
  void detachesAnOrphanedIndexFromAManagedAlias() {
    // An upgrade from 1.12 leaves ai_agent_search_index behind, still on `all`. Its mapping has
    // `owners` as a plain object, so a nested owners clause fails that shard and every zero-hit
    // search through `all` becomes a 500.
    SearchRepository repository = aiApplicationOnlyRepository();
    Map<String, Set<String>> aliases =
        stubAliasTable(
            Map.of(
                "all", Set.of("ai_application_search_index", "ai_agent_search_index"),
                "aiApplication", Set.of("ai_application_search_index"),
                "dataAssetEmbeddings", Set.of("ai_application_search_index")));

    assertEquals(1, cleaner.detachOrphanedIndexesFromAliases(repository));

    assertEquals(Set.of("ai_application_search_index"), aliases.get("all"));
    assertEquals(Set.of("ai_application_search_index"), aliases.get("aiApplication"));
  }

  @Test
  void keepsTheVectorChunkIndexOnTheEmbeddingsAlias() {
    // data_asset_embeddings_chunks and its generations carry `dataAssetEmbeddings` so the vector
    // read path sees chunk docs, and neither is an entityIndexMap index. Detaching them would
    // silently empty semantic search on every reindex.
    SearchRepository repository = aiApplicationOnlyRepository();
    Set<String> embeddings =
        Set.of(
            "ai_application_search_index",
            "data_asset_embeddings_chunks",
            "data_asset_embeddings_chunks_gen_3");
    Map<String, Set<String>> aliases =
        stubAliasTable(
            Map.of(
                "all", Set.of("ai_application_search_index"), "dataAssetEmbeddings", embeddings));

    assertEquals(0, cleaner.detachOrphanedIndexesFromAliases(repository));

    assertEquals(embeddings, aliases.get("dataAssetEmbeddings"));
  }

  @Test
  void leavesAFullyRegisteredClusterUntouched() {
    SearchRepository repository = aiApplicationOnlyRepository();
    Map<String, Set<String>> aliases =
        stubAliasTable(Map.of("all", Set.of("ai_application_search_index")));

    assertEquals(0, cleaner.detachOrphanedIndexesFromAliases(repository));

    assertEquals(Set.of("ai_application_search_index"), aliases.get("all"));
  }

  @Test
  void keepsAStagedRebuildAttachedWhileAReindexIsInFlight() {
    // A server killed mid-reindex leaves <canonical>_rebuild_<millis> holding the aliases it was
    // about to be promoted into. Tearing those off would break search rather than repair it.
    SearchRepository repository = aiApplicationOnlyRepository();
    String staged = "ai_application_search_index_rebuild_1789766065567";
    Map<String, Set<String>> aliases = stubAliasTable(Map.of("all", Set.of(staged)));

    assertEquals(0, cleaner.detachOrphanedIndexesFromAliases(repository));

    assertEquals(Set.of(staged), aliases.get("all"));
  }

  @Test
  void doesNotCountADetachThatTheClusterSilentlyRejected() {
    // Both index managers log and swallow an unavailable client, a rejected request and an
    // unacknowledged response, so a normal return proves nothing about the alias.
    SearchRepository repository = aiApplicationOnlyRepository();
    stubAliasTable(Map.of("all", Set.of("ai_application_search_index", "ai_agent_search_index")));
    doAnswer(call -> null).when(searchClient).removeAliases(anyString(), any());

    assertEquals(0, cleaner.detachOrphanedIndexesFromAliases(repository));
  }

  private boolean invokeBoolean(String methodName, String indexName) throws Exception {
    java.lang.reflect.Method method =
        OrphanedIndexCleaner.class.getDeclaredMethod(methodName, SearchClient.class, String.class);
    method.setAccessible(true);
    return (Boolean) method.invoke(cleaner, searchClient, indexName);
  }

  private boolean invokeIsOldEnough(String indexName, long now) throws Exception {
    java.lang.reflect.Method method =
        OrphanedIndexCleaner.class.getDeclaredMethod("isOldEnough", String.class, long.class);
    method.setAccessible(true);
    return (Boolean) method.invoke(cleaner, indexName, now);
  }

  private static IndexStats indexStats(String name, Set<String> aliases) {
    return new IndexStats(name, 0, 0, 1, 0, 0, "GREEN", aliases);
  }
}
