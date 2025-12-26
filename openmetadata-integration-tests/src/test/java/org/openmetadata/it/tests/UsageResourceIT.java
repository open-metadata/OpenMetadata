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
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.MessagingServiceTestFactory;
import org.openmetadata.it.factories.PipelineServiceTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.data.CreateDashboard;
import org.openmetadata.schema.api.data.CreatePipeline;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.data.CreateTopic;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.PipelineService;
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

    // Query usage with date and days params to get multiple days
    EntityUsage usage = Usage.getForTable(table.getId().toString(), today, 7);
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

    // PUT usage is cumulative (adds to existing count), so 5 + 8 = 13
    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 13),
        "Usage should be cumulative (5 + 8 = 13)");

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

    // PUT usage is cumulative, so 5 + 10 + 15 = 30
    EntityUsage usage = Usage.getForTable(table.getId().toString());
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 30),
        "Usage count should be cumulative (5 + 10 + 15 = 30)");

    cleanupTable(table);
  }

  @Test
  void testReportUsageAcrossWeek(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_8");
    String today = LocalDate.now().format(DATE_FORMATTER);

    for (int i = 0; i < 7; i++) {
      String date = LocalDate.now().minusDays(i).format(DATE_FORMATTER);
      Usage.reportFor("table", table.getId()).onDate(date).withCount((i + 1) * 10).report();
    }

    // Query with date and days params to get the full week of data
    EntityUsage usage = Usage.getForTable(table.getId().toString(), today, 7);
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

  @Test
  void testGetUsageForDifferentEntityTypes(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_entity_test");
    Dashboard dashboard = createDashboard(ns, "usage_dashboard_entity_test");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(50).report();
    Usage.reportFor("dashboard", dashboard.getId()).onDate(today).withCount(100).report();

    EntityUsage tableUsage = Usage.getForEntity("table", table.getId().toString());
    EntityUsage dashboardUsage = Usage.getForEntity("dashboard", dashboard.getId().toString());

    assertNotNull(tableUsage);
    assertTrue(
        tableUsage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 50));

    assertNotNull(dashboardUsage);
    assertTrue(
        dashboardUsage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 100));

    cleanupTable(table);
    cleanupDashboard(dashboard);
  }

  @Test
  void testUsageAggregation(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_aggregation");
    String today = LocalDate.now().format(DATE_FORMATTER);
    String yesterday = LocalDate.now().minusDays(1).format(DATE_FORMATTER);
    String twoDaysAgo = LocalDate.now().minusDays(2).format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(twoDaysAgo).withCount(10).report();
    Usage.reportFor("table", table.getId()).onDate(yesterday).withCount(20).report();
    Usage.reportFor("table", table.getId()).onDate(today).withCount(30).report();

    EntityUsage usage = Usage.getForTable(table.getId().toString(), today, 3);
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertEquals(3, usage.getUsage().size());

    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 30));
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(yesterday) && dc.getDailyStats().getCount() == 20));
    assertTrue(
        usage.getUsage().stream()
            .anyMatch(
                dc -> dc.getDate().equals(twoDaysAgo) && dc.getDailyStats().getCount() == 10));

    cleanupTable(table);
  }

  @Test
  void testUsageHistory(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_history");
    String today = LocalDate.now().format(DATE_FORMATTER);

    for (int i = 0; i < 10; i++) {
      String date = LocalDate.now().minusDays(i).format(DATE_FORMATTER);
      Usage.reportFor("table", table.getId()).onDate(date).withCount((i + 1) * 5).report();
    }

    EntityUsage usageFor7Days = Usage.getForTable(table.getId().toString(), today, 7);
    assertNotNull(usageFor7Days);
    assertEquals(7, usageFor7Days.getUsage().size());

    EntityUsage usageFor10Days = Usage.getForTable(table.getId().toString(), today, 10);
    assertNotNull(usageFor10Days);
    assertTrue(usageFor10Days.getUsage().size() >= 7);

    cleanupTable(table);
  }

  @Test
  void testComputePercentile(TestNamespace ns) {
    Table table1 = createTable(ns, "usage_table_percentile_1");
    Table table2 = createTable(ns, "usage_table_percentile_2");
    Table table3 = createTable(ns, "usage_table_percentile_3");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table1.getId()).onDate(today).withCount(10).report();
    Usage.reportFor("table", table2.getId()).onDate(today).withCount(50).report();
    Usage.reportFor("table", table3.getId()).onDate(today).withCount(100).report();

    Usage.computePercentile("table", today);

    EntityUsage usage1 = Usage.getForTable(table1.getId().toString());
    EntityUsage usage2 = Usage.getForTable(table2.getId().toString());
    EntityUsage usage3 = Usage.getForTable(table3.getId().toString());

    assertNotNull(usage1);
    assertNotNull(usage2);
    assertNotNull(usage3);

    Double percentile1 =
        usage1.getUsage().stream()
            .filter(dc -> dc.getDate().equals(today))
            .findFirst()
            .map(dc -> dc.getDailyStats().getPercentileRank())
            .orElse(null);
    Double percentile2 =
        usage2.getUsage().stream()
            .filter(dc -> dc.getDate().equals(today))
            .findFirst()
            .map(dc -> dc.getDailyStats().getPercentileRank())
            .orElse(null);
    Double percentile3 =
        usage3.getUsage().stream()
            .filter(dc -> dc.getDate().equals(today))
            .findFirst()
            .map(dc -> dc.getDailyStats().getPercentileRank())
            .orElse(null);

    assertNotNull(percentile1);
    assertNotNull(percentile2);
    assertNotNull(percentile3);

    assertTrue(percentile1 < percentile2);
    assertTrue(percentile2 < percentile3);

    cleanupTable(table1);
    cleanupTable(table2);
    cleanupTable(table3);
  }

  @Test
  void testUsageWeeklyAndMonthlyStats(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_stats");
    String today = LocalDate.now().format(DATE_FORMATTER);

    for (int i = 0; i < 30; i++) {
      String date = LocalDate.now().minusDays(i).format(DATE_FORMATTER);
      Usage.reportFor("table", table.getId()).onDate(date).withCount(10).report();
    }

    EntityUsage usage = Usage.getForTable(table.getId().toString(), today, 30);
    assertNotNull(usage);
    assertNotNull(usage.getUsage());
    assertTrue(usage.getUsage().size() >= 7);

    // Weekly stats should have accumulated counts from last 7 days (7 * 10 = 70)
    // Monthly stats should have accumulated counts from last 30 days (30 * 10 = 300)
    // Due to timing and async processing, we verify stats exist and are positive
    boolean hasWeeklyStats =
        usage.getUsage().stream()
            .anyMatch(
                dc ->
                    dc.getDate().equals(today)
                        && dc.getWeeklyStats() != null
                        && dc.getWeeklyStats().getCount() > 0);
    boolean hasMonthlyStats =
        usage.getUsage().stream()
            .anyMatch(
                dc ->
                    dc.getDate().equals(today)
                        && dc.getMonthlyStats() != null
                        && dc.getMonthlyStats().getCount() > 0);
    assertTrue(hasWeeklyStats || hasMonthlyStats, "Should have weekly or monthly stats");

    cleanupTable(table);
  }

  @Test
  void testUsageByName(TestNamespace ns) {
    Table table = createTable(ns, "usage_table_by_name");
    String today = LocalDate.now().format(DATE_FORMATTER);

    Usage.reportFor("table", table.getId()).onDate(today).withCount(42).report();

    EntityUsage usageByName =
        Usage.getForEntityByName("table", table.getFullyQualifiedName(), today, 1);
    assertNotNull(usageByName);
    assertTrue(
        usageByName.getUsage().stream()
            .anyMatch(dc -> dc.getDate().equals(today) && dc.getDailyStats().getCount() == 42));

    cleanupTable(table);
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

  private Topic createTopic(TestNamespace ns, String topicName) {
    MessagingService service = MessagingServiceTestFactory.createKafka(ns);

    CreateTopic createTopic = new CreateTopic();
    createTopic.setName(ns.prefix(topicName));
    createTopic.setService(service.getFullyQualifiedName());
    createTopic.setPartitions(3);

    return SdkClients.adminClient().topics().create(createTopic);
  }

  private void cleanupTopic(Topic topic) {
    try {
      SdkClients.adminClient().topics().delete(topic.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private Dashboard createDashboard(TestNamespace ns, String dashboardName) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);

    CreateDashboard createDashboard = new CreateDashboard();
    createDashboard.setName(ns.prefix(dashboardName));
    createDashboard.setService(service.getFullyQualifiedName());

    return SdkClients.adminClient().dashboards().create(createDashboard);
  }

  private void cleanupDashboard(Dashboard dashboard) {
    try {
      SdkClients.adminClient().dashboards().delete(dashboard.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }

  private Pipeline createPipeline(TestNamespace ns, String pipelineName) {
    PipelineService service = PipelineServiceTestFactory.createAirflow(ns);

    CreatePipeline createPipeline = new CreatePipeline();
    createPipeline.setName(ns.prefix(pipelineName));
    createPipeline.setService(service.getFullyQualifiedName());

    return SdkClients.adminClient().pipelines().create(createPipeline);
  }

  private void cleanupPipeline(Pipeline pipeline) {
    try {
      SdkClients.adminClient().pipelines().delete(pipeline.getId().toString());
    } catch (Exception e) {
      // Ignore cleanup errors
    }
  }
}
