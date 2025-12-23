package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.*;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.type.EntityUsage;
import org.openmetadata.sdk.fluent.Usage;
import org.openmetadata.sdk.fluent.builders.ColumnBuilder;

/**
 * Integration tests for Usage API operations.
 *
 * <p>Tests usage reporting and retrieval using the fluent SDK API from {@link Usage}.
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class UsageResourceIT {

  private static final DateTimeFormatter DATE_FORMATTER = DateTimeFormatter.ISO_LOCAL_DATE;

  @BeforeAll
  static void setup() {
    Usage.setDefaultClient(SdkClients.adminClient());
  }

  @Test
  void testReportUsageForTable(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_1");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(5).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 5),
        "Usage should contain the reported count for today");

    cleanupTable(table);
  }

  @Test
  void testReportMultipleUsageEntries(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_2");
    String today = LocalDate.now().format(DATE_FORMATTER);
    String yesterday = LocalDate.now().minusDays(1).format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(10).report();
    Usage.reportFor("table", table.getId()).onDate(yesterday).withCount(15).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(usage.getUsage().size() >= 2, "Usage should contain at least 2 entries");
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 10),
        "Usage should contain today's count");
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(yesterday) && dc.getDailyStats().getCount() == 15),
        "Usage should contain yesterday's count");

    cleanupTable(table);
  }

  @Test
  void testUpdateUsageForSameDate(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_3");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(5).report();

    Usage.reportFor("table", table.getId()).onDate(today).withCount(8).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 8),
        "Usage should be updated to the new count");

    cleanupTable(table);
  }

  @Test
  void testGetUsageWithDateAndDays(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_4");
    String today = LocalDate.now().format(DATE_FORMATTER);
    String oneDayAgo = LocalDate.now().minusDays(1).format(DATE_FORMATTER);
    String twoDaysAgo = LocalDate.now().minusDays(2).format(DATE_FORMATTER);
    String threeDaysAgo = LocalDate.now().minusDays(3).format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(10).report();
    Usage.reportFor("table", table.getId()).onDate(oneDayAgo).withCount(20).report();
    Usage.reportFor("table", table.getId()).onDate(twoDaysAgo).withCount(30).report();
    Usage.reportFor("table", table.getId()).onDate(threeDaysAgo).withCount(40).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString(), today, 3);
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertEquals(3, usage.getUsage().size(), "Should return exactly 3 days of usage");

    cleanupTable(table);
  }

  @Test
  void testReportUsageWithDefaultCount(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_5");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 1),
        "Default count should be 1");

    cleanupTable(table);
  }

  @Test
  void testReportUsageWithLargeCount(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_6");
    String today = LocalDate.now().format(DATE_FORMATTER);
    int largeCount = 1000000;

    Usage.reportFor("table", table.getId()).onDate(today).withCount(largeCount).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(
                dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == largeCount),
        "Should handle large usage counts");

    cleanupTable(table);
  }

  @Test
  void testGetUsageForNonExistentTable(TestNamespace ns) {
    String nonExistentTableId = "00000000-0000-0000-0000-000000000000";

    assertThrows(
        Exception.class,
        () -> Usage.getForTable(nonExistentTableId),
        "Getting usage for non-existent table should throw exception");
  }

  @Test
  void testReportUsageMultipleTimesIncrementally(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_7");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(5).report();
    Usage.reportFor("table", table.getId()).onDate(today).withCount(10).report();
    Usage.reportFor("table", table.getId()).onDate(today).withCount(15).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 15),
        "Last reported count should be persisted");

    cleanupTable(table);
  }

  @Test
  void testReportUsageAcrossWeek(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_8");

    for (int i = 0; i < 7; i++) {
      String date = LocalDate.now().minusDays(i).format(DATE_FORMATTER);
      Usage.reportFor("table", table.getId()).onDate(date).withCount((i + 1) * 10).report();
    }

    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(usage.getUsage().size() >= 7, "Should have at least 7 days of usage data");

    cleanupTable(table);
  }

  @Test
  void testReportUsageForMultipleTables(TestNamespace ns) {
    Table table1 = createTable(ns, "usage_table_9a");
    Table table2 = createTable(ns, "usage_table_9b");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table1.getId()).onDate(today).withCount(100).report();
    Usage.reportFor("table", table2.getId()).onDate(today).withCount(200).report();

    EntityUsage usage1 = Usage.getForTable(table1.getId().toString());
    EntityUsage usage2 = Usage.getForTable(table2.getId().toString());

    assertNotNull(usage1);
    assertNotNull(usage2);
    assertTrue(
        usage1.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 100),
        "Table 1 should have count 100");
    assertTrue(
        usage2.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 200),
        "Table 2 should have count 200");

    cleanupTable(table1);
    cleanupTable(table2);
  }

  private Table createTable(TestNamespace ns, String tableName) {
    DatabaseService service = DatabaseServiceTestFactory.createPostgres(ns);
    DatabaseSchema schema = DatabaseSchemaTestFactory.createSimple(ns, service);

    CreateTable createTable = new CreateTable();
    createTable.setName(ns.prefix(tableName));
    createTable.setDatabaseSchema(schema.getFullyQualifiedName());
    createTable.setColumns(
        List.of(
            ColumnBuilder.of("id", "BIGINT").primaryKey().notNull().build(),
            ColumnBuilder.of("name", "VARCHAR").dataLength(255).build()));

    return SdkClients.adminClient().tables().create(createTable);
  }

  private void cleanupTable(Table table) {
    try {
      SdkClients.adminClient().tables().delete(table.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
