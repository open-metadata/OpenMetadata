package org.openmetadata.service.apps.bundles.insights;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.dataInsight.custom.DataAssetType;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Data Insights covers an entity type in exactly one of two ways: the app ingests it into a
 * datastream of its own, in which case {@code dataInsights/config.json} carries its attribute list,
 * or a live index is aliased into the {@code di-data-assets-*} wildcard by a {@code
 * dataInsightAliases} entry in indexMapping.json.
 *
 * <p>The invariant spans three files because the contract does. Nothing else in the codebase notices
 * when a type is declared but nothing populates it, which is how {@code metric} spent five months
 * ingested but absent from the chart field catalog.
 */
class DataAssetTypeCoverageTest {

  private static final String CONFIG_PATH = "/dataInsights/config.json";
  private static final String INDEX_MAPPING_PATH = "/elasticsearch/indexMapping.json";
  private static final String COMMON_KEY = "common";

  private static SearchRepository previousSearchRepository;

  @BeforeAll
  static void giveTheRepositoryASearchClient() {
    // DataInsightSystemChartRepository resolves a SearchClient in its static initializer, so the
    // class cannot load without one and the order assertion below would error rather than fail.
    previousSearchRepository = Entity.getSearchRepository();
    if (previousSearchRepository == null) {
      SearchRepository searchRepository = mock(SearchRepository.class);
      when(searchRepository.getSearchClient()).thenReturn(mock(SearchClient.class));
      Entity.setSearchRepository(searchRepository);
    }
  }

  @AfterAll
  static void restoreTheSearchRepository() {
    // Entity holds it in a static field and surefire reuses one JVM across every test class, so
    // leaving the mock behind would let a later test silently observe it.
    Entity.setSearchRepository(previousSearchRepository);
  }

  @Test
  void everyDataAssetTypeIsEitherIngestedOrAliasedIn() {
    Set<String> ingested = ingestedTypes();
    Set<String> aliased = aliasedTypes();

    for (DataAssetType type : DataAssetType.values()) {
      assertTrue(
          ingested.contains(type.value()) || aliased.contains(type.value()),
          type.value()
              + " is a Data Insights asset type but is neither given an attribute list in "
              + CONFIG_PATH
              + " nor aliased in via dataInsightAliases, so nothing would ever populate it");
    }
  }

  @Test
  void theCatalogTypeOrderIsTheEnumOrderNotASaltedOne() {
    // The catalog appends records per type as it walks this set. Collectors.toUnmodifiableSet()
    // backs onto ImmutableCollections$SetN, whose iteration order is salted per JVM start, so a
    // consumer resolving a duplicated field name by first-record-wins would resolve it differently
    // after a restart.
    assertEquals(
        Arrays.stream(DataAssetType.values()).map(DataAssetType::value).toList(),
        List.copyOf(DataInsightSystemChartRepository.dataAssetTypes),
        "the chart field catalog must enumerate types in a stable order");
  }

  @Test
  void everyDataAssetTypeHasAnIndexMapping() {
    // DataInsightsApp reads a type's IndexMapping to decide whether a live index aliases it in, and
    // again to build the datastream's mapping. getIndexMapping is a plain map lookup, so a type
    // with
    // no entry here is read as "not aliased", joins the ingested set, and then NPEs inside
    // buildMapping on a null IndexMapping. That escapes the surrounding catch, which only handles
    // IOException, so the app install dies without naming the type. Failing here says which one.
    Set<String> mapped = indexMappingKeys();

    for (DataAssetType type : DataAssetType.values()) {
      assertTrue(
          mapped.contains(type.value()),
          type.value()
              + " is a Data Insights asset type with no entry in "
              + INDEX_MAPPING_PATH
              + ", so DataInsightsApp would try to ingest it and dereference a null IndexMapping");
    }
  }

  @Test
  void theTwoCoverageMechanismsDoNotOverlap() {
    Set<String> overlap = new HashSet<>(ingestedTypes());
    overlap.retainAll(aliasedTypes());

    // An aliased type points at a live index. Ingesting it as well would have the app create and
    // delete a datastream whose name that alias already occupies, i.e. aimed at live data.
    assertTrue(overlap.isEmpty(), "types both ingested and aliased in: " + overlap);
  }

  /** Every entity type the search layer knows how to index. */
  private static Set<String> indexMappingKeys() {
    JsonNode indexMapping = JsonUtils.readTree(readResource(INDEX_MAPPING_PATH));
    Set<String> keys = new HashSet<>();
    Iterator<String> names = indexMapping.fieldNames();
    while (names.hasNext()) {
      keys.add(names.next());
    }
    return keys;
  }

  /** The types the app ingests: the keys of config.json's mappingFields other than common. */
  private static Set<String> ingestedTypes() {
    JsonNode mappingFields = JsonUtils.readTree(readResource(CONFIG_PATH)).get("mappingFields");
    Set<String> types = new HashSet<>();
    Iterator<String> keys = mappingFields.fieldNames();
    while (keys.hasNext()) {
      String key = keys.next();
      if (!COMMON_KEY.equals(key)) {
        types.add(key);
      }
    }
    return types;
  }

  /** The types reaching Data Insights through an alias onto their live entity index. */
  private static Set<String> aliasedTypes() {
    JsonNode indexMapping = JsonUtils.readTree(readResource(INDEX_MAPPING_PATH));
    Set<String> types = new HashSet<>();
    Iterator<Map.Entry<String, JsonNode>> entries = indexMapping.fields();
    while (entries.hasNext()) {
      Map.Entry<String, JsonNode> entry = entries.next();
      JsonNode aliases = entry.getValue().get("dataInsightAliases");
      if (aliases != null && !aliases.isEmpty()) {
        types.add(entry.getKey());
      }
    }
    return types;
  }

  private static String readResource(String path) {
    try (InputStream in = DataAssetTypeCoverageTest.class.getResourceAsStream(path)) {
      return new String(in.readAllBytes(), StandardCharsets.UTF_8);
    } catch (Exception e) {
      throw new IllegalStateException("could not read " + path, e);
    }
  }
}
