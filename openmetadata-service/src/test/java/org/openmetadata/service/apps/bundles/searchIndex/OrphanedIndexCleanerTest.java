package org.openmetadata.service.apps.bundles.searchIndex;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.SearchClient;

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
}
