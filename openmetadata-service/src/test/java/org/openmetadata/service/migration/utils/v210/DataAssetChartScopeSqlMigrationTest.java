package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;
import org.openmetadata.service.jdbi3.locator.ConnectionType;
import org.openmetadata.service.migration.utils.MigrationFile;

/**
 * Guards the 2.1.0 data migration that keeps test case definitions out of the Data Insights
 * data-asset charts.
 *
 * <p>{@code testCase} is aliased into {@code di-data-assets-*} so charts can count test cases, which
 * would leak them into {@code total_data_assets} unless the stored chart definitions exclude them
 * the way they exclude tags (#31478). The stored definitions are written by SQL only, so these tests
 * pin that SQL against {@link DataInsightSystemChartRepository}, which the aggregators read.
 */
class DataAssetChartScopeSqlMigrationTest {

  private static final String SECTION_MARKER =
      "-- Data Insights: keep test case definitions out of the data-asset charts.";
  private static final Pattern NAME_IN_LIST = Pattern.compile("name IN \\(([^)]*)\\)");
  private static final Pattern QUOTED_NAME = Pattern.compile("'([a-z0-9_]+)'");

  private static final List<String> DATA_ASSET_CHARTS =
      List.of(
          "total_data_assets",
          "total_data_assets_by_tier",
          "total_data_assets_summary_card",
          "total_data_assets_with_tier_summary_card",
          "percentage_of_data_asset_with_description",
          "percentage_of_data_asset_with_owner",
          "percentage_of_service_with_description",
          "percentage_of_service_with_owner",
          "data_assets_with_description_summary_card",
          "data_assets_with_owner_summary_card",
          "percentage_of_data_asset_with_description_kpi",
          "percentage_of_data_asset_with_owner_kpi",
          "number_of_data_asset_with_description_kpi",
          "number_of_data_asset_with_owner_kpi");

  @Test
  void theScopeNowExcludesTestCases() {
    assertTrue(
        DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES.contains("testCase"),
        "testCase documents are not data assets");
    assertTrue(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER.contains(
            "{\"term\":{\"entityType.keyword\":\"testCase\"}}"));
  }

  @ParameterizedTest(name = "{0} writes the filter the aggregators read")
  @MethodSource("dialects")
  void migrationWritesTheCanonicalDataAssetFilter(final String dialect) throws IOException {
    assertTrue(
        section(dialect).contains(DataInsightSystemChartRepository.DATA_ASSET_FILTER),
        dialect + " must embed DataInsightSystemChartRepository.DATA_ASSET_FILTER verbatim");
  }

  @ParameterizedTest(name = "{0} excludes every bucket key of the non data asset entity types")
  @MethodSource("dialects")
  void migrationExcludesTheNonDataAssetBucketKeys(final String dialect) throws IOException {
    final String excludeGroups =
        JsonUtils.pojoToJson(DataInsightSystemChartRepository.NON_DATA_ASSET_BUCKET_KEYS);

    assertTrue(
        section(dialect).contains(excludeGroups),
        dialect
            + ": the excludeGroups literal must be the JSON of NON_DATA_ASSET_BUCKET_KEYS, "
            + "lowercase keys included, because a lowercase-normalized entityType.keyword buckets "
            + "test cases under \"testcase\"");
    assertTrue(
        DataInsightSystemChartRepository.NON_DATA_ASSET_BUCKET_KEYS.containsAll(
            List.of("testCase", "testcase")));
  }

  @ParameterizedTest(name = "{0} covers every data asset chart")
  @MethodSource("dialects")
  void migrationCoversEveryDataAssetChart(final String dialect) throws IOException {
    assertEquals(Set.copyOf(DATA_ASSET_CHARTS), chartNamesIn(section(dialect)));
  }

  @Test
  void bothDialectsScopeTheSameCharts() throws IOException {
    assertEquals(chartNamesIn(section("mysql")), chartNamesIn(section("postgres")));
  }

  @ParameterizedTest(name = "{0} is a no-op once the definitions are already scoped")
  @MethodSource("dialects")
  void migrationIsGuardedOnTheStoredValue(final String dialect) throws IOException {
    final String section = section(dialect);
    final long updates = section.lines().filter(line -> line.startsWith("UPDATE ")).count();
    final long guards = section.lines().filter(line -> line.contains("<>")).count();

    assertEquals(2, updates, dialect + " should rewrite the filter and the breakdown groups");
    assertEquals(
        updates,
        guards,
        dialect
            + ": every UPDATE must compare against the stored value so a replay writes nothing");
  }

  @ParameterizedTest(name = "{0} parses into the two statements the workflow will run")
  @MethodSource("dialects")
  void migrationParsesWithTheDialectParser(final String dialect) {
    final List<String> statements =
        MigrationFile.parseSQLFile(
                path(dialect).toFile(),
                "mysql".equals(dialect) ? ConnectionType.MYSQL : ConnectionType.POSTGRES)
            .stream()
            .filter(statement -> statement.contains("UPDATE di_chart_entity"))
            .toList();

    assertEquals(2, statements.size(), dialect + " should parse into two chart UPDATE statements");
    assertTrue(
        statements.getFirst().contains(DataInsightSystemChartRepository.DATA_ASSET_FILTER),
        dialect + ": the parser must not mangle the filter literal");
    assertTrue(
        statements
            .getLast()
            .contains(
                JsonUtils.pojoToJson(DataInsightSystemChartRepository.NON_DATA_ASSET_BUCKET_KEYS)),
        dialect + ": the parser must not mangle the excludeGroups literal");
  }

  private static Set<String> chartNamesIn(final String sql) {
    final Matcher inLists = NAME_IN_LIST.matcher(sql);
    return inLists
        .results()
        .flatMap(inList -> QUOTED_NAME.matcher(inList.group(1)).results())
        .map(name -> name.group(1))
        .collect(Collectors.toUnmodifiableSet());
  }

  /** The statements this migration appends, without the rest of the 2.1.0 script. */
  private static String section(final String dialect) throws IOException {
    final String sql = Files.readString(path(dialect));
    final int start = sql.indexOf(SECTION_MARKER);
    assertTrue(start >= 0, dialect + " must carry the test case scope section");
    return sql.substring(start);
  }

  private static Path path(final String dialect) {
    return repositoryRoot()
        .resolve("bootstrap/sql/migrations/native/2.1.0")
        .resolve(dialect)
        .resolve("postDataMigrationSQLScript.sql");
  }

  private static Stream<String> dialects() {
    return Stream.of("mysql", "postgres");
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.isDirectory(current.resolve("bootstrap/sql/migrations"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
