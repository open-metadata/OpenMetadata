package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.vector.VectorIndexService;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

class RecreateWithEmbeddingsTest {
  private static final String STAGED_CHUNKS = "data_asset_embeddings_chunks_g1700000000000";

  private final VectorIndexService vectorService = mock(VectorIndexService.class);
  private final SearchRepository searchRepository = mock(SearchRepository.class);

  @Test
  void aFullJobDrivenRecreateStagesAChunkGenerationOnTheRepositorysVectorService() {
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    when(vectorService.beginStagedChunkRecreate()).thenReturn(STAGED_CHUNKS);
    DefaultRecreateHandler handler =
        new RecreateWithEmbeddings().withJobData(new EventPublisherJob());

    ReindexContext context;
    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      context = handler.reCreateIndexes(Set.copyOf(AvailableEntityTypes.LIST));
    }

    assertEquals(Optional.of(STAGED_CHUNKS), context.getStagedChunkIndex());
  }

  @Test
  void finalizingATypeWithNoStagedEntityIndexReportsItAsNotPromoted() {
    when(searchRepository.getVectorIndexService()).thenReturn(vectorService);
    // Without a staged entity index nothing replaces the live one, so the chunks stay live too.
    EntityReindexContext context =
        EntityReindexContext.builder().entityType("table").stagedChunkIndex(STAGED_CHUNKS).build();

    try (MockedStatic<Entity> entity = mockStatic(Entity.class)) {
      entity.when(Entity::getSearchRepository).thenReturn(searchRepository);
      new RecreateWithEmbeddings().finalizeReindex(context, true);
    }

    verify(vectorService).markEntityTypeReindexed("table", false, STAGED_CHUNKS);
  }

  @Test
  void coversAllVectorTypes_matchesCanonicalCamelCaseNames() {
    // Regression: the reindex job carries canonical camelCase entity names ("glossaryTerm"),
    // while AvailableEntityTypes.SET is lowercased — a case-sensitive containsAll never matched,
    // so the chunk-index recreate silently never fired on a full run.
    Set<String> canonicalNames = new HashSet<>(AvailableEntityTypes.LIST);
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(canonicalNames));
  }

  @Test
  void coversAllVectorTypes_matchesLowercasedNames() {
    Set<String> lowercased =
        AvailableEntityTypes.LIST.stream()
            .map(s -> s.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(lowercased));
  }

  @Test
  void stagesAssetChunksForExistingSavedEntityLists() {
    Set<String> saved = new HashSet<>(AvailableEntityTypes.LIST);
    saved.remove("ontologyConcept");
    saved.remove("ontologyProperty");
    assertTrue(RecreateWithEmbeddings.shouldStageChunkRecreate(new EventPublisherJob(), saved));
  }

  @Test
  void coversAllVectorTypes_falseWhenAnyTypeMissing() {
    Set<String> missingOne = new HashSet<>(AvailableEntityTypes.LIST);
    missingOne.remove("glossaryTerm");
    assertFalse(
        RecreateWithEmbeddings.coversAllVectorTypes(missingOne),
        "a partial recreate must never drop the chunk index");
  }

  @Test
  void coversAllVectorTypes_trueForSupersets() {
    Set<String> superset = new HashSet<>(AvailableEntityTypes.LIST);
    superset.add("user");
    superset.add("team");
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(superset));
  }

  @Test
  void shouldStageChunkRecreate_ignoresRemovedRecreateIndexFlag() {
    // SearchIndexAppConfigSanitizer strips the removed recreateIndex option from every persisted
    // config before jobData is built, so app-driven runs always carry recreateIndex = null —
    // staging must not consult it.
    Map<String, Object> sanitizedConfig = Map.of("entities", List.of("all"), "batchSize", 100);
    EventPublisherJob jobData = JsonUtils.convertValue(sanitizedConfig, EventPublisherJob.class);
    assertNull(jobData.getRecreateIndex(), "sanitizer-shaped config carries no recreateIndex");
    assertTrue(
        RecreateWithEmbeddings.shouldStageChunkRecreate(
            jobData, new HashSet<>(AvailableEntityTypes.LIST)));
  }

  @Test
  void shouldStageChunkRecreate_falseWithoutJobData() {
    // The jobless ops-CLI createIndexes path must never stage a chunk sweep.
    assertFalse(
        RecreateWithEmbeddings.shouldStageChunkRecreate(
            null, new HashSet<>(AvailableEntityTypes.LIST)));
  }

  @Test
  void shouldStageChunkRecreate_falseForPartialCoverage() {
    Set<String> missingOne = new HashSet<>(AvailableEntityTypes.LIST);
    missingOne.remove("table");
    assertFalse(
        RecreateWithEmbeddings.shouldStageChunkRecreate(new EventPublisherJob(), missingOne));
  }
}
