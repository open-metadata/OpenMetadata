package org.openmetadata.service.migration.utils.v1136;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.flywaydb.core.api.configuration.ClassicConfiguration;
import org.flywaydb.core.api.configuration.Configuration;
import org.flywaydb.core.internal.database.postgresql.PostgreSQLParser;
import org.flywaydb.core.internal.parser.Parser;
import org.flywaydb.core.internal.parser.ParsingContext;
import org.flywaydb.core.internal.resource.filesystem.FileSystemResource;
import org.flywaydb.core.internal.sqlscript.SqlStatementIterator;
import org.flywaydb.database.mysql.MySQLParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.schema.dataInsight.custom.LineChart;
import org.openmetadata.schema.dataInsight.custom.SummaryCard;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.jdbi3.DataInsightSystemChartRepository;

/**
 * Guards the 1.13.6 data migration that re-scopes the Data Insights data-asset charts (#31478).
 *
 * <p>The scope now lives in SQL rather than in a Java migration, because a Java {@code
 * runDataMigration()} attached to a version a deployment has already recorded never runs, while SQL
 * statements are replayed on any version still offered for reprocessing. That leaves the SQL as the
 * only place the scope is written, so these tests pin it against {@link
 * DataInsightSystemChartRepository}, which is what the aggregators and the OpenSearch regression
 * test read.
 */
class DataAssetChartScopeSqlMigrationTest {

  private static final String EXPECTED_EXCLUDE_GROUPS =
      "[\"tag\",\"glossaryTerm\",\"dataProduct\"]";
  private static final Pattern NAME_IN_LIST = Pattern.compile("name IN \\(([^)]*)\\)");
  private static final Pattern QUOTED_NAME = Pattern.compile("'([a-z0-9_]+)'");

  /** Every chart the 1.5.0 migration created with the data-asset filter or breakdown. */
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

  @ParameterizedTest(name = "{0} writes the filter the aggregators read")
  @MethodSource("dialects")
  void migrationWritesTheCanonicalDataAssetFilter(final String dialect) throws IOException {
    final String sql = read(dialect);

    assertTrue(
        sql.contains(DataInsightSystemChartRepository.DATA_ASSET_FILTER),
        dialect
            + " must embed DataInsightSystemChartRepository.DATA_ASSET_FILTER verbatim, otherwise "
            + "the stored definitions drift from the scope the charts are tested against");
  }

  @ParameterizedTest(name = "{0} excludes exactly the non data asset entity types")
  @MethodSource("dialects")
  void migrationExcludesTheNonDataAssetEntityTypes(final String dialect) throws IOException {
    assertEquals(
        JsonUtils.pojoToJson(DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES),
        EXPECTED_EXCLUDE_GROUPS,
        "NON_DATA_ASSET_ENTITY_TYPES changed; update the 1.13.6 excludeGroups literal to match");
    assertTrue(read(dialect).contains(EXPECTED_EXCLUDE_GROUPS), dialect + " excludeGroups literal");
  }

  @ParameterizedTest(name = "{0} covers every data asset chart")
  @MethodSource("dialects")
  void migrationCoversEveryDataAssetChart(final String dialect) throws IOException {
    assertEquals(Set.copyOf(DATA_ASSET_CHARTS), chartNamesIn(read(dialect)));
  }

  @Test
  void bothDialectsScopeTheSameCharts() throws IOException {
    assertEquals(chartNamesIn(read("mysql")), chartNamesIn(read("postgres")));
  }

  @ParameterizedTest(name = "{0} is a no-op once the definitions are already scoped")
  @MethodSource("dialects")
  void migrationIsGuardedOnTheStoredValue(final String dialect) throws IOException {
    final String sql = read(dialect);
    final long updates = sql.lines().filter(line -> line.startsWith("UPDATE ")).count();
    final long guards = sql.lines().filter(line -> line.contains("<>")).count();

    assertEquals(2, updates, dialect + " should rewrite the filter and the breakdown groups");
    assertEquals(
        updates,
        guards,
        dialect
            + ": every UPDATE must compare against the stored value, so replaying the migration on "
            + "an already corrected deployment writes nothing");
  }

  @Test
  void migratedLineChartDeserializesWithTheScopeApplied() throws IOException {
    // Fixture captured verbatim from a real MySQL 9.2 row after running the migration; the
    // PostgreSQL 14 row parses to the same object. Pins the SQL against the POJOs the aggregators
    // read: `filter` has to land as a JSON *string*, not an object, or convertValue fails.
    final LineChart chart =
        JsonUtils.readValue(resource("migrated_line_chart_details"), LineChart.class);

    assertEquals(
        DataInsightSystemChartRepository.NON_DATA_ASSET_ENTITY_TYPES, chart.getExcludeGroups());
    assertEquals(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER,
        chart.getMetrics().getFirst().getFilter());
    assertEquals("entityType.keyword", chart.getGroupBy());
  }

  @Test
  void migratedSummaryCardDeserializesWithTheScopeApplied() throws IOException {
    final SummaryCard card =
        JsonUtils.readValue(resource("migrated_summary_card_details"), SummaryCard.class);

    assertEquals(
        DataInsightSystemChartRepository.DATA_ASSET_FILTER,
        card.getMetrics().getFirst().getFilter());
  }

  @ParameterizedTest(name = "{0} parses into the two statements the workflow will run")
  @MethodSource("dialects")
  void migrationParsesWithTheDialectParser(final String dialect) {
    // The workflow feeds these files to Flyway's dialect parser, which strips comments and expands
    // ${...} placeholders. Parse them the same way to prove the statements survive intact.
    final List<String> statements = parseWithDialectParser(dialect);

    assertEquals(2, statements.size(), dialect + " should parse into two UPDATE statements");
    assertTrue(
        statements.getFirst().contains(DataInsightSystemChartRepository.DATA_ASSET_FILTER),
        dialect + ": the parser must not mangle the filter literal");
    assertTrue(
        statements.getLast().contains(EXPECTED_EXCLUDE_GROUPS),
        dialect + ": the parser must not mangle the excludeGroups literal");
  }

  /**
   * Mirrors the parser {@code MigrationFile.parseSQLFiles} builds, minus its checksum filter, which
   * needs a live MigrationDAO. Kept local because on this branch the parsing has no static entry
   * point.
   */
  private static List<String> parseWithDialectParser(final String dialect) {
    final ParsingContext parsingContext = new ParsingContext();
    final Configuration configuration = new ClassicConfiguration();
    final Parser parser =
        "mysql".equals(dialect)
            ? new MySQLParser(configuration, parsingContext)
            : new PostgreSQLParser(configuration, parsingContext);
    final List<String> statements = new ArrayList<>();
    try (SqlStatementIterator iterator =
        parser.parse(
            new FileSystemResource(
                null, path(dialect).toAbsolutePath().toString(), StandardCharsets.UTF_8, true))) {
      while (iterator.hasNext()) {
        statements.add(iterator.next().getSql());
      }
    }
    return statements;
  }

  /** Only the names listed in a {@code WHERE name IN (...)} block, not every quoted SQL literal. */
  private static Set<String> chartNamesIn(final String sql) {
    final Matcher inLists = NAME_IN_LIST.matcher(sql);
    return inLists
        .results()
        .flatMap(inList -> QUOTED_NAME.matcher(inList.group(1)).results())
        .map(name -> name.group(1))
        .collect(Collectors.toUnmodifiableSet());
  }

  private static String read(final String dialect) throws IOException {
    return Files.readString(path(dialect));
  }

  private static Path path(final String dialect) {
    return repositoryRoot()
        .resolve("bootstrap/sql/migrations/native/1.13.6")
        .resolve(dialect)
        .resolve("postDataMigrationSQLScript.sql");
  }

  private static String resource(final String name) throws IOException {
    return Files.readString(
        repositoryRoot()
            .resolve("openmetadata-service/src/test/resources/migration/v1136")
            .resolve(name + ".json"));
  }

  private static Stream<String> dialects() {
    return Stream.of("mysql", "postgres");
  }

  private static Path repositoryRoot() {
    Path current = Path.of("").toAbsolutePath();
    while (current != null && !Files.exists(current.resolve("bootstrap/sql/schema/mysql.sql"))) {
      current = current.getParent();
    }
    if (current == null) {
      throw new IllegalStateException("Unable to locate the OpenMetadata repository root");
    }
    return current;
  }
}
