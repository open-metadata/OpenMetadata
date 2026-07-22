package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.system.EventPublisherJob;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.search.vector.utils.AvailableEntityTypes;

class RecreateWithEmbeddingsTest {

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
    // Regression: SearchIndexAppConfigSanitizer strips the removed recreateIndex option from
    // every persisted app config before jobData is built, so getRecreateIndex() is always null
    // in app-driven runs. Gating chunk staging on Boolean.TRUE.equals(recreateIndex) therefore
    // never passed — no staged generation, no alias promotion, no orphan sweep — while every
    // per-entity index kept recreating. Staging must not consult that flag.
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
