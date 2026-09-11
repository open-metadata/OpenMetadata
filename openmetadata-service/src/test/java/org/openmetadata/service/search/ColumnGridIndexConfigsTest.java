package org.openmetadata.service.search;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.search.elasticsearch.ElasticSearchColumnAggregator;
import org.openmetadata.service.search.opensearch.OpenSearchColumnAggregator;

/**
 * Pins the grid aggregators' coverage and per-type field paths. Both engines now read the same
 * registry-derived configs; before consolidation the OpenSearch side carried a flat list of types
 * and no field-path map at all, so it queried topic, searchIndex and container against
 * {@code columns.*} and matched nothing.
 */
class ColumnGridIndexConfigsTest {

  /** entityType to (indexName, columnFieldPath, columnNameKeyword), exactly as shipped today. */
  static final Map<String, List<String>> LEGACY_ES_CONFIGS =
      Map.of(
          "table",
          List.of("table", "columns", "columns.name.keyword"),
          "dashboardDataModel",
          List.of("dashboardDataModel", "columns", "columns.name.keyword"),
          "topic",
          List.of("topic", "messageSchema.schemaFields", "messageSchema.schemaFields.name.keyword"),
          "searchIndex",
          List.of("searchIndex", "fields", "fields.name.keyword"),
          "container",
          List.of("container", "dataModel.columns", "dataModel.columns.name.keyword"));

  static final List<String> LEGACY_OS_INDEXES =
      List.of("table", "dashboardDataModel", "topic", "searchIndex", "container");

  @Test
  void load_admitsExactlyTheseTypes_threeOfThemNewToTheGrid() {
    // Replaces the reflection pin that asserted the ES aggregator's five hardcoded types. Deriving
    // the configs from the registry admits three types the grid never served before: pipeline,
    // mlmodel and worksheet. That is the intended coverage extension, but it must be stated rather
    // than inherited, so a future registry addition cannot silently appear on a public endpoint.
    assertEquals(
        Set.of(
            "table",
            "dashboardDataModel",
            "topic",
            "searchIndex",
            "container",
            "pipeline",
            "mlmodel",
            "worksheet"),
        ColumnGridIndexConfigs.load().keySet());
  }

  @Test
  void load_preservesLegacyEsConfigsExactly() {
    Map<String, ColumnGridIndexConfigs.IndexConfig> configs = ColumnGridIndexConfigs.load();
    for (Map.Entry<String, List<String>> legacy : LEGACY_ES_CONFIGS.entrySet()) {
      ColumnGridIndexConfigs.IndexConfig config = configs.get(legacy.getKey());
      assertNotNull(config, legacy.getKey());
      // All three components. indexName is the one easiest to get wrong and the one with no other
      // pin: in the legacy map it holds the ENTITY TYPE / alias name, not a physical index name,
      // and the aggregator resolves it to a real index at query time. The registry-derived build
      // must keep that contract, so indexName equals the map key.
      assertEquals(legacy.getKey(), config.indexName(), legacy.getKey());
      assertEquals(legacy.getValue().get(1), config.columnFieldPath(), legacy.getKey());
      assertEquals(legacy.getValue().get(2), config.columnNameKeyword(), legacy.getKey());
    }
  }

  @Test
  void load_excludedTypesAreAbsentAndDocumented() {
    Map<String, ColumnGridIndexConfigs.IndexConfig> configs = ColumnGridIndexConfigs.load();
    for (String excluded : ColumnGridIndexConfigs.GRID_EXCLUDED_TYPES) {
      assertFalse(configs.containsKey(excluded), excluded);
    }
  }

  @Test
  void resolveEntityTypes_defaultsToTableWhenEmpty() {
    assertEquals(List.of("table"), ColumnGridIndexConfigs.resolveEntityTypes(null));
    assertEquals(List.of("table"), ColumnGridIndexConfigs.resolveEntityTypes(List.of()));
  }

  @Test
  void resolveEntityTypes_unknownTypeThrowsInsteadOfSilentDrop() {
    // The old getEntityTypesForRequest dropped unknown types and quietly fell back to table, so a
    // typo returned table rows and looked like a working query. Now it is an error.
    IllegalArgumentException error =
        assertThrows(
            IllegalArgumentException.class,
            () -> ColumnGridIndexConfigs.resolveEntityTypes(List.of("table", "glossary")));
    assertTrue(error.getMessage().contains("glossary"));
  }

  @Test
  void os_and_es_resolveTheSameFieldPathPerType() {
    Map<String, ColumnGridIndexConfigs.IndexConfig> configs = ColumnGridIndexConfigs.load();
    for (Map.Entry<String, ColumnGridIndexConfigs.IndexConfig> entry : configs.entrySet()) {
      assertEquals(
          entry.getValue().columnFieldPath(),
          OpenSearchColumnAggregator.resolveColumnFieldPath(entry.getKey()),
          "OS field path for " + entry.getKey() + " must come from ColumnGridIndexConfigs");
      assertEquals(
          entry.getValue().columnFieldPath(),
          ElasticSearchColumnAggregator.resolveColumnFieldPath(entry.getKey()),
          "ES field path for " + entry.getKey() + " must come from ColumnGridIndexConfigs");
      assertEquals(
          entry.getValue().columnNameKeyword(),
          OpenSearchColumnAggregator.resolveColumnNameKeyword(entry.getKey()),
          "OS keyword for " + entry.getKey() + " must come from ColumnGridIndexConfigs");
      assertEquals(
          entry.getValue().columnNameKeyword(),
          ElasticSearchColumnAggregator.resolveColumnNameKeyword(entry.getKey()),
          "ES keyword for " + entry.getKey() + " must come from ColumnGridIndexConfigs");
    }
    // The three types whose path is not "columns" at all. Before this task the OpenSearch
    // aggregator queried them against "columns.*", which matches nothing in their mappings.
    assertEquals("messageSchema.schemaFields", configs.get("topic").columnFieldPath());
    assertEquals("dataModel.columns", configs.get("container").columnFieldPath());
    assertEquals("fields", configs.get("searchIndex").columnFieldPath());
  }

  @Test
  void suffixConstantsDeriveTheSiblingFieldsFromAKeyword() {
    // Both aggregators carry only the keyword through their query builders and strip/swap this
    // suffix to reach the container path and the tag field. If the constant and the built keyword
    // ever disagree the strip silently no-ops and the exists() filter targets a non-existent field.
    for (ColumnGridIndexConfigs.IndexConfig config : ColumnGridIndexConfigs.load().values()) {
      assertEquals(
          config.columnFieldPath(),
          config.columnNameKeyword().replace(ColumnGridIndexConfigs.NAME_KEYWORD_SUFFIX, ""));
      assertEquals(
          config.columnFieldPath() + ColumnGridIndexConfigs.TAG_FQN_SUFFIX,
          config
              .columnNameKeyword()
              .replace(
                  ColumnGridIndexConfigs.NAME_KEYWORD_SUFFIX,
                  ColumnGridIndexConfigs.TAG_FQN_SUFFIX));
    }
  }

  @Test
  void neitherAggregatorHardcodesAChildFieldPath() throws Exception {
    assertNoChildFieldLiteral(
        "src/main/java/org/openmetadata/service/search/opensearch/OpenSearchColumnAggregator.java");
    assertNoChildFieldLiteral(
        "src/main/java/org/openmetadata/service/search/elasticsearch/ElasticSearchColumnAggregator.java");
  }

  @Test
  void os_legacyTypesSurviveTheMigrationOffItsPrivateList() {
    // The flat private list is gone; every type it used to serve must still be admitted, or the
    // migration silently removed OpenSearch grid coverage for it.
    assertThrows(
        NoSuchFieldException.class,
        () -> OpenSearchColumnAggregator.class.getDeclaredField("DATA_ASSET_INDEXES"));
    for (String legacyType : LEGACY_OS_INDEXES) {
      assertTrue(
          ColumnGridIndexConfigs.load().containsKey(legacyType),
          legacyType + " was served by the OpenSearch grid before consolidation");
    }
  }

  /**
   * Fails on any remaining string literal that starts a child-field path. Before this task the
   * OpenSearch aggregator carried 14 of them; the field path must come from ColumnGridIndexConfigs
   * so topic/container/searchIndex are not queried against "columns.*".
   *
   * <p>Comment lines are skipped. Both files carry prose about columns, and future work will add
   * more; a scan that fails on a javadoc sentence teaches executors to reword comments instead of
   * fixing queries.
   *
   * <p>The path is resolved against the module directory, which is surefire's working directory for
   * {@code mvn test -pl openmetadata-service}. The existence check below is deliberate: if the file
   * is not found the test must fail loudly rather than pass on an empty offender list, which is how
   * a working-directory change would otherwise turn this pin into a silent no-op.
   */
  static void assertNoChildFieldLiteral(String relativePath) throws Exception {
    Path source = Path.of(relativePath);
    assertTrue(
        Files.exists(source),
        "Cannot scan "
            + relativePath
            + " from working directory "
            + Path.of("").toAbsolutePath()
            + "; run this test with the module directory as the working directory");
    List<String> offenders = new ArrayList<>();
    List<String> lines = Files.readAllLines(source);
    boolean inBlockComment = false;
    for (int i = 0; i < lines.size(); i++) {
      String trimmed = lines.get(i).trim();
      boolean commentLine =
          inBlockComment
              || trimmed.startsWith("//")
              || trimmed.startsWith("/*")
              || trimmed.startsWith("*");
      if (trimmed.startsWith("/*") && !trimmed.contains("*/")) {
        inBlockComment = true;
      } else if (inBlockComment && trimmed.contains("*/")) {
        inBlockComment = false;
      }
      boolean hardcoded = trimmed.contains("\"columns\"") || trimmed.contains("\"columns.");
      if (hardcoded && !commentLine) {
        offenders.add((i + 1) + ": " + trimmed);
      }
    }
    assertEquals(List.of(), offenders, relativePath + " still hardcodes a child-field path");
  }
}
