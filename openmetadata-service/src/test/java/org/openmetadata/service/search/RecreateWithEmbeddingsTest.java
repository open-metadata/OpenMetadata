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
import org.openmetadata.service.search.vector.utils.EmbeddedEntityTypes;

class RecreateWithEmbeddingsTest {

  @Test
  void coversAllVectorTypes_matchesCanonicalCamelCaseNames() {
    // Regression: the reindex job carries canonical camelCase entity names ("glossaryTerm"),
    // while the chunk types used to be compared lowercased. A case-sensitive containsAll never
    // matched, so the chunk-index recreate silently never fired on a full run.
    Set<String> canonicalNames = new HashSet<>(EmbeddedEntityTypes.ALL);
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(canonicalNames));
  }

  @Test
  void coversAllVectorTypes_matchesLowercasedNames() {
    Set<String> lowercased =
        EmbeddedEntityTypes.ALL.stream()
            .map(s -> s.toLowerCase(Locale.ROOT))
            .collect(Collectors.toSet());
    assertTrue(RecreateWithEmbeddings.coversAllVectorTypes(lowercased));
  }

  @Test
  void stagesAssetChunksForExistingSavedEntityLists() {
    Set<String> saved = new HashSet<>(EmbeddedEntityTypes.ALL);
    saved.remove("ontologyConcept");
    saved.remove("ontologyProperty");
    assertTrue(RecreateWithEmbeddings.shouldStageChunkRecreate(new EventPublisherJob(), saved));
  }

  @Test
  void coversAllVectorTypes_falseWhenAnyTypeMissing() {
    Set<String> missingOne = new HashSet<>(EmbeddedEntityTypes.ALL);
    missingOne.remove("glossaryTerm");
    assertFalse(
        RecreateWithEmbeddings.coversAllVectorTypes(missingOne),
        "a partial recreate must never drop the chunk index");
  }

  @Test
  void coversAllVectorTypes_countsATypeInTwoCasingsOnce() {
    Set<String> missingOne = new HashSet<>(EmbeddedEntityTypes.DATA_ASSETS);
    missingOne.remove("table");
    missingOne.add("glossaryterm");
    assertFalse(
        RecreateWithEmbeddings.coversAllVectorTypes(missingOne),
        "a type named in two casings must not stand in for a missing type");
  }

  @Test
  void coversAllVectorTypes_trueForSupersets() {
    Set<String> superset = new HashSet<>(EmbeddedEntityTypes.ALL);
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
            jobData, new HashSet<>(EmbeddedEntityTypes.ALL)));
  }

  @Test
  void shouldStageChunkRecreate_falseWithoutJobData() {
    // The jobless ops-CLI createIndexes path must never stage a chunk sweep.
    assertFalse(
        RecreateWithEmbeddings.shouldStageChunkRecreate(
            null, new HashSet<>(EmbeddedEntityTypes.ALL)));
  }

  @Test
  void shouldStageChunkRecreate_falseForPartialCoverage() {
    Set<String> missingOne = new HashSet<>(EmbeddedEntityTypes.ALL);
    missingOne.remove("table");
    assertFalse(
        RecreateWithEmbeddings.shouldStageChunkRecreate(new EventPublisherJob(), missingOne));
  }
}
