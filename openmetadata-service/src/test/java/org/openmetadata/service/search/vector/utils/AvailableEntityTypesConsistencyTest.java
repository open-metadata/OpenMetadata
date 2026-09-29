package org.openmetadata.service.search.vector.utils;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.io.IOException;
import java.io.InputStream;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.search.IndexMapping;
import org.openmetadata.search.IndexMappingLoader;
import org.openmetadata.service.search.vector.VectorIndexService;

/**
 * Vector search is gated in three independent places that must agree:
 *
 * <ol>
 *   <li>{@link AvailableEntityTypes#LIST} — the write path. The bulk sink and
 *       {@code VectorEmbeddingHandler} only embed types listed here.
 *   <li>The {@code dataAssetEmbeddings} parent alias in {@code indexMapping.json} — the read path.
 *       Vector and hybrid search query the alias, so a non-member index is unreachable.
 *   <li>The {@code fingerprint} field in each type's index mapping file — {@code
 *       OsUtils.addKnnVectorSettings} detects embedding support by its presence and skips adding
 *       the {@code embedding} knn_vector without it.
 * </ol>
 *
 * <p>Drift between them fails silently and in opposite directions: a type in (1) but not (2) is
 * embedded at write cost and never returned, and a type in (2) but not (1) makes the alias claim
 * coverage it does not have. This test pins all three.
 */
class AvailableEntityTypesConsistencyTest {

  private static final String[] LANGUAGES = {"en", "jp", "ru", "zh"};

  /** Fields {@code VectorDocBuilder} writes on entity and chunk docs. */
  private static final List<String> EMBEDDING_FIELDS =
      List.of(
          "fingerprint", "textToEmbed", "textToLLMContext", "chunkIndex", "chunkCount", "parentId");

  private static final ObjectMapper MAPPER = new ObjectMapper();

  @BeforeAll
  static void loadIndexMappings() throws IOException {
    IndexMappingLoader.init();
  }

  @Test
  void vectorIndexableTypesMatchTheEmbeddingsAliasExactly() {
    Set<String> declared = new TreeSet<>(AvailableEntityTypes.SET);
    Set<String> aliasMembers = new TreeSet<>();
    for (Map.Entry<String, IndexMapping> entry : indexMappings().entrySet()) {
      List<String> parents = entry.getValue().getParentAliases(null);
      if (parents != null && parents.contains(VectorIndexService.VECTOR_EMBEDDING_ALIAS)) {
        aliasMembers.add(entry.getKey().toLowerCase(Locale.ROOT));
      }
    }

    assertFalse(aliasMembers.isEmpty(), "no index declares the dataAssetEmbeddings parent alias");
    assertEquals(
        declared,
        aliasMembers,
        "AvailableEntityTypes.LIST and the dataAssetEmbeddings members in indexMapping.json have"
            + " drifted. Types embedded but not searchable: "
            + difference(declared, aliasMembers)
            + "; types in the alias but never embedded: "
            + difference(aliasMembers, declared));
  }

  @Test
  void everyVectorIndexableTypeDeclaresTheEmbeddingFields() throws IOException {
    Map<String, IndexMapping> mappings = indexMappings();
    List<String> problems = new ArrayList<>();

    for (String entityType : AvailableEntityTypes.LIST) {
      IndexMapping mapping = resolve(mappings, entityType);
      if (mapping == null) {
        problems.add(entityType + ": no entry in indexMapping.json");
        continue;
      }
      for (String language : LANGUAGES) {
        String path = "/" + mapping.getIndexMappingFile(language);
        try (InputStream stream = getClass().getResourceAsStream(path)) {
          if (stream == null) {
            continue; // language variants are optional; covered by IndexMappingVersionTrackerTest
          }
          JsonNode properties = MAPPER.readTree(stream).path("mappings").path("properties");
          List<String> missing =
              EMBEDDING_FIELDS.stream().filter(field -> !properties.has(field)).toList();
          if (!missing.isEmpty()) {
            problems.add(entityType + " (" + language + "): missing " + missing);
          }
        }
      }
    }

    assertTrue(
        problems.isEmpty(),
        "Vector-indexable types whose index mapping omits the embedding fields. Without"
            + " 'fingerprint' OsUtils.addKnnVectorSettings skips the knn_vector entirely, so the"
            + " type is embedded and then unsearchable: "
            + problems);
  }

  private static Map<String, IndexMapping> indexMappings() {
    return IndexMappingLoader.getInstance().getIndexMapping();
  }

  /** indexMapping.json keys are camelCase; AvailableEntityTypes is compared case-insensitively. */
  private static IndexMapping resolve(Map<String, IndexMapping> mappings, String entityType) {
    IndexMapping direct = mappings.get(entityType);
    if (direct != null) {
      return direct;
    }
    return mappings.entrySet().stream()
        .filter(e -> e.getKey().equalsIgnoreCase(entityType))
        .map(Map.Entry::getValue)
        .findFirst()
        .orElse(null);
  }

  private static Set<String> difference(Set<String> left, Set<String> right) {
    Set<String> diff = new LinkedHashSet<>(left);
    diff.removeAll(right);
    return diff;
  }
}
