/*
 *  Copyright 2026 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.resources.services.ingestionpipelines.run;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.regex.Pattern;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceAutoClassificationPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.Incremental;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.RunOptions;

/**
 * Each scope is applied the way a runner applies it - laid over a deployed config through
 * RunOptions - and read back through the generated config class, so a misspelt key, which a runner
 * would silently ignore, leaves the field at its default and fails here.
 */
class SourceConfigScopersTest {

  private static final String DATABASE_FQN = "mysql_prod.shop";
  private static final String SCHEMA_FQN = "mysql_prod.shop.sales";
  private static final String TABLE_FQN = "mysql_prod.shop.sales.orders";
  private static final TableFilterScoper TABLE_FILTER_SCOPER = new TableFilterScoper();

  @Test
  void aTestSuiteRunIsScopedToTheTestCaseName() {
    TestCase testCase =
        new TestCase().withName("row_count").withFullyQualifiedName(TABLE_FQN + ".row_count");

    assertEquals(
        Map.of("testCases", List.of("row_count")),
        new TestCaseScoper().sourceConfigOverride(testCase));
  }

  @Test
  void aProfilerRunIsScopedToTheTableAlone() {
    DatabaseServiceProfilerPipeline config =
        scoped(
            TABLE_FILTER_SCOPER,
            new DatabaseServiceProfilerPipeline(),
            DatabaseServiceProfilerPipeline.class);

    assertTrue(config.getUseFqnForFiltering());
    assertOnlyMatches(config.getDatabaseFilterPattern(), DATABASE_FQN, "mysql_prod.shopfloor");
    assertOnlyMatches(config.getSchemaFilterPattern(), SCHEMA_FQN, "mysql_prod.shop.sales_eu");
    assertOnlyMatches(config.getTableFilterPattern(), TABLE_FQN, "mysql_prod.shop.sales.orders_v2");
    assertTrue(config.getIncludeViews(), "a view must be profiled too when it is the target");
  }

  @Test
  void anAutoClassificationRunIsScopedToTheTableAlone() {
    DatabaseServiceAutoClassificationPipeline config =
        scoped(
            TABLE_FILTER_SCOPER,
            new DatabaseServiceAutoClassificationPipeline(),
            DatabaseServiceAutoClassificationPipeline.class);

    assertTrue(config.getUseFqnForFiltering());
    assertOnlyMatches(config.getTableFilterPattern(), TABLE_FQN, "mysql_prod.shop.sales.orders_v2");
  }

  /** The trap the scoper exists for: a run that sees one table must not delete the rest. */
  @Test
  void aMetadataRunIsScopedToTheTableAndMarksNothingDeleted() {
    DatabaseServiceMetadataPipeline deployed =
        new DatabaseServiceMetadataPipeline()
            .withMarkDeletedTables(true)
            .withMarkDeletedSchemas(true)
            .withMarkDeletedDatabases(true)
            .withMarkDeletedStoredProcedures(true)
            .withIncludeStoredProcedures(true)
            .withIncludeTables(false)
            .withIncludeTags(false);

    DatabaseServiceMetadataPipeline config =
        scoped(metadataScoper(), deployed, DatabaseServiceMetadataPipeline.class);

    assertFalse(config.getMarkDeletedTables());
    assertFalse(config.getMarkDeletedSchemas());
    assertFalse(config.getMarkDeletedDatabases());
    assertFalse(config.getMarkDeletedStoredProcedures());
    assertFalse(config.getIncludeStoredProcedures());
    assertTrue(config.getIncludeTables());
    assertOnlyMatches(config.getTableFilterPattern(), TABLE_FQN, "mysql_prod.shop.sales.orders_v2");
    assertFalse(config.getIncludeTags(), "settings outside the scope keep their deployed value");
  }

  /** Quoted names may hold dots and other characters a pattern would otherwise read as regex. */
  @Test
  void aTableWhoseNamesHoldRegexCharactersMatchesOnlyItself() {
    String quotedFqn = "svc.\"db.v1\".sales.\"orders (2024)+[eu]$\"";
    FilterPattern filter =
        JsonUtils.convertValue(TableFilterScoper.onlyMatching(quotedFqn), FilterPattern.class);

    assertOnlyMatches(filter, quotedFqn, "svc.\"dbXv1\".sales.\"orders (2024)+[eu]$\"");
  }

  @Test
  void aScopedMetadataRunIsRejectedOnAnIncrementalPipeline() {
    IngestionPipeline incremental =
        metadataPipeline(
            new DatabaseServiceMetadataPipeline()
                .withIncremental(new Incremental().withEnabled(true)));

    BadRequestException error =
        assertThrows(BadRequestException.class, () -> metadataScoper().checkScopable(incremental));
    assertTrue(
        error.getMessage().contains(incremental.getFullyQualifiedName()), error.getMessage());
  }

  @Test
  void aScopedMetadataRunIsAllowedWhenIncrementalExtractionIsOff() {
    IngestionPipeline notIncremental =
        metadataPipeline(
            new DatabaseServiceMetadataPipeline()
                .withIncremental(new Incremental().withEnabled(false)));

    assertDoesNotThrow(() -> metadataScoper().checkScopable(notIncremental));
    assertDoesNotThrow(() -> metadataScoper().checkScopable(metadataPipeline(null)));
  }

  private static MetadataScoper metadataScoper() {
    return new MetadataScoper(TABLE_FILTER_SCOPER);
  }

  private static <T> T scoped(
      SourceConfigScoper scoper, Object deployedConfig, Class<T> configClass) {
    IngestionPipeline pipeline =
        new IngestionPipeline().withSourceConfig(new SourceConfig().withConfig(deployedConfig));
    RunOptions options = RunOptions.withSourceConfigOverride(scoper.sourceConfigOverride(table()));
    return JsonUtils.convertValue(
        options.applyTo(pipeline).getSourceConfig().getConfig(), configClass);
  }

  private static void assertOnlyMatches(FilterPattern filter, String fqn, String sibling) {
    assertEquals(1, filter.getIncludes().size());
    Pattern pattern = Pattern.compile(filter.getIncludes().getFirst());
    assertTrue(pattern.matcher(fqn).matches(), filter.getIncludes().getFirst());
    assertFalse(pattern.matcher(sibling).find(), filter.getIncludes().getFirst());
  }

  private static Table table() {
    return new Table()
        .withId(UUID.randomUUID())
        .withName("orders")
        .withFullyQualifiedName(TABLE_FQN)
        .withDatabase(new EntityReference().withFullyQualifiedName(DATABASE_FQN))
        .withDatabaseSchema(new EntityReference().withFullyQualifiedName(SCHEMA_FQN));
  }

  private static IngestionPipeline metadataPipeline(Object config) {
    return new IngestionPipeline()
        .withName("mysql_prod_metadata")
        .withFullyQualifiedName("mysql_prod.mysql_prod_metadata")
        .withPipelineType(PipelineType.METADATA)
        .withSourceConfig(new SourceConfig().withConfig(config));
  }
}
