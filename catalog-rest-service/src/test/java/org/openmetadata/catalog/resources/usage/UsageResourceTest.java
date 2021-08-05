package org.openmetadata.catalog.resources.usage;

import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.catalog.CatalogApplicationTest;
import org.openmetadata.catalog.Entity;
import org.openmetadata.catalog.api.data.CreateTable;
import org.openmetadata.catalog.entity.data.Database;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.exception.CatalogExceptionMessage;
import org.openmetadata.catalog.resources.databases.DatabaseResourceTest;
import org.openmetadata.catalog.resources.databases.TableResourceTest;
import org.openmetadata.catalog.type.DailyCount;
import org.openmetadata.catalog.type.EntityUsage;
import org.openmetadata.catalog.type.UsageDetails;
import org.openmetadata.catalog.util.RestUtil;
import org.openmetadata.catalog.util.TestUtils;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.Random;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.openmetadata.catalog.Entity.TABLE;
import static org.openmetadata.catalog.util.TestUtils.*;
import static org.openmetadata.common.utils.CommonUtil.getDateStringByOffset;

@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class UsageResourceTest extends CatalogApplicationTest {
  private static final Logger LOG = LoggerFactory.getLogger(UsageResourceTest.class);
  public static final List<Table> TABLES = new ArrayList<>();
  public static final int TABLE_COUNT = 10;
  public static final int DAYS_OF_USAGE = 32;

  @BeforeAll
  public static void setup(TestInfo test) throws HttpResponseException {
    TableResourceTest.setup(test); // Initialize TableResourceTest for using helper methods
    // Create TABLE_COUNT number of tables
    for (int i = 0; i < TABLE_COUNT; i++) {
      CreateTable createTable = TableResourceTest.create(test, i);
      TABLES.add(TableResourceTest.createTable(createTable, adminAuthHeaders()));
    }
  }

  @Test
  public void post_usageWithNonExistentEntityId_4xx() {
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                    reportUsage(TABLE, NON_EXISTENT_ENTITY, usageReport(), adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(TABLE, NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_usageInvalidEntityName_4xx() {
    String invalidEntityType = "invalid";
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            reportUsage(invalidEntityType, UUID.randomUUID(), usageReport(), adminAuthHeaders()));
    assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityTypeNotFound(invalidEntityType));
  }

  @Test
  public void post_usageWithNegativeCountName_4xx() {
    DailyCount dailyCount = usageReport().withCount(-1); // Negative usage count
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
            reportUsage(TABLE, UUID.randomUUID(), dailyCount, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[count must be greater than or equal to 0]");
  }

  @Test
  public void post_usageWithoutDate_4xx() {
    DailyCount usageReport = usageReport().withDate(null); // Negative usage count
    HttpResponseException exception = assertThrows(HttpResponseException.class, () ->
                    reportUsage(TABLE, UUID.randomUUID(), usageReport, adminAuthHeaders()));
    assertResponse(exception, BAD_REQUEST, "[date must not be null]");
  }

  @Test
  public void post_validUsageByName_200_OK(TestInfo test) throws HttpResponseException {
    Table table = TableResourceTest.createTable(TableResourceTest.create(test), adminAuthHeaders());
    DailyCount usageReport = usageReport().withCount(100).withDate(RestUtil.DATE_FORMAT.format(new Date()));
    reportUsageByNameAndCheck(TABLE, table.getFullyQualifiedName(), usageReport, 100, 100,
            adminAuthHeaders());
  }

  @Order(1) // Run this method first before other usage records are created
  @Test
  public void post_validUsageForDatabaseAndTables_200_OK() throws HttpResponseException, ParseException {
    // This test creates TABLE_COUNT of tables.
    // For these tables, publish usage data for DAYS_OF_USAGE number of days starting from today.
    // For 100 tables send usage report for last 30 days
    // This test checks if the daily, rolling weekly and monthly usage count is correct.
    // This test also checks if the daily, rolling weekly and monthly usage percentile rank is correct.

    // Publish usage for DAYS_OF_USAGE number of days starting from today
    String today = RestUtil.DATE_FORMAT.format(new Date()); // today

    // Add table usages of each table - 0, 1 to TABLE_COUNT - 1 to get database usage
    final int dailyDatabaseUsageCount = TABLE_COUNT * (TABLE_COUNT - 1)/2;
    UUID databaseId = TABLES.get(0).getDatabase().getId();
    for (int day = 0; day < DAYS_OF_USAGE; day++) {
      String date = getDateStringByOffset(RestUtil.DATE_FORMAT, today, day);
      LOG.info("Posting usage information for date {}", date);

      // For each day report usage for all the tables in TABLES list
      int databaseDailyCount = 0;
      int databaseWeeklyCount;
      int databaseMonthlyCount;
      for (int tableIndex = 0; tableIndex < TABLES.size(); tableIndex++) {
        // Usage count is set same as tableIndex.
        // First table as usage count = 0, Second table has count = 1 and so on
        int usageCount = tableIndex;
        UUID id = TABLES.get(tableIndex).getId();
        DailyCount usageReport = usageReport().withCount(usageCount).withDate(date);

        // Report usage
        int weeklyCount = Math.min(day + 1, 7) * usageCount; // Expected cumulative weekly count
        int monthlyCount = Math.min(day + 1, 30 ) * usageCount; // Expected cumulative monthly count
        reportUsageAndCheck(TABLE, id, usageReport, weeklyCount, monthlyCount, adminAuthHeaders());

        // Database has cumulative count of all the table usage
        databaseDailyCount += usageCount;
        // Cumulative weekly count for database
        databaseWeeklyCount = Math.min(day, 6) * dailyDatabaseUsageCount + databaseDailyCount;
        // Cumulative monthly count for database
        databaseMonthlyCount = Math.min(day, 29) * dailyDatabaseUsageCount + databaseDailyCount;
        LOG.info("dailyDatabaseUsageCount {}, databaseDailyCount {} weekly {} monthly {}",
                dailyDatabaseUsageCount, databaseDailyCount, databaseWeeklyCount, databaseMonthlyCount);
        checkUsage(date, Entity.DATABASE, databaseId, databaseDailyCount, databaseWeeklyCount, databaseMonthlyCount,
                adminAuthHeaders());
      }

      // Compute daily percentiles now that all table usage have been published for a given date
      computePercentile(TABLE, date, adminAuthHeaders());
      computePercentile(Entity.DATABASE, date, adminAuthHeaders());
      // TODO check database percentile

      // For each day check percentile
      for (int tableIndex = 0; tableIndex < TABLES.size(); tableIndex++) {
        int expectedPercentile = 100*(tableIndex)/TABLES.size();
        EntityUsage usage = getUsage(TABLE, TABLES.get(tableIndex).getId(), date, 1, adminAuthHeaders());
        assertEquals(expectedPercentile, usage.getUsage().get(0).getDailyStats().getPercentileRank());
        assertEquals(expectedPercentile, usage.getUsage().get(0).getWeeklyStats().getPercentileRank());
        assertEquals(expectedPercentile, usage.getUsage().get(0).getMonthlyStats().getPercentileRank());
      }
    }

    // Test API returns right number of days of usage requests
    String date = getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE - 1);
    // Number of days defaults to 1 when unspecified
    UUID tableId = TABLES.get(0).getId();
    getAndCheckUsage(TABLE, tableId, date, null /*, days unspecified */, 1, adminAuthHeaders());

    // Usage for specified number of days is returned
    getAndCheckUsage(TABLE, tableId, date, 1, 1, adminAuthHeaders());
    getAndCheckUsage(TABLE, tableId, date, 5, 5, adminAuthHeaders());
    getAndCheckUsage(TABLE, tableId, date, 30, 30, adminAuthHeaders());

    // Usage for days out of range returned default number of days
    // 0 days is defaulted to 1
    getAndCheckUsage(TABLE, tableId, date, 0, 1, adminAuthHeaders());
    // -1 days is defaulted to 1
    getAndCheckUsage(TABLE, tableId, date, -1, 1, adminAuthHeaders());
    // More than 30 days is defaulted to 30
    getAndCheckUsage(TABLE, tableId, date, 100, 30, adminAuthHeaders());

    // Nothing is returned when usage for a date is not available
    // One day beyond the last day of usage published
    date = getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE);
    // 0 days of usage resulted
    getAndCheckUsage(TABLE, tableId, date, 1, 0, adminAuthHeaders());
    // Only 4 past usage records returned. For the given date there is no usage report.
    getAndCheckUsage(TABLE, tableId, date, 5, 4, adminAuthHeaders());

    // Ensure GET .../tables/{id}?fields=usageSummary returns the latest usage
    date = getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE - 1); // Latest usage report date
    EntityUsage usage = getUsage(TABLE, tableId, date, null /* days not specified */, adminAuthHeaders());
    Table table = TableResourceTest.getTable(TABLES.get(0).getId(), "usageSummary", adminAuthHeaders());
    Assertions.assertEquals(usage.getUsage().get(0), table.getUsageSummary());

    // Ensure GET .../databases/{id}?fields=usageSummary returns the latest usage
    usage = getUsage(Entity.DATABASE, databaseId, date, null /* days not specified */, adminAuthHeaders());
    Database database = DatabaseResourceTest.getDatabase(databaseId, "usageSummary", adminAuthHeaders());
    Assertions.assertEquals(usage.getUsage().get(0), database.getUsageSummary());
  }

  public static DailyCount usageReport() {
    Random random = new Random();
    String today = RestUtil.DATE_FORMAT.format(new Date());
    return new DailyCount().withCount(random.nextInt(100)).withDate(today);
  }

  public static void reportUsageByNameAndCheck(String entity, String fqn, DailyCount usage, int weeklyCount,
                                               int monthlyCount, Map<String, String> authHeaders)
          throws HttpResponseException {
    reportUsageByName(entity, fqn, usage, authHeaders);
    checkUsageByName(usage.getDate(), entity, fqn, usage.getCount(), weeklyCount, monthlyCount, authHeaders);
  }

  public static void reportUsageAndCheck(String entity, UUID id, DailyCount usage, int weeklyCount, int monthlyCount,
                                         Map<String, String> authHeaders) throws HttpResponseException {
    reportUsage(entity, id, usage, authHeaders);
    checkUsage(usage.getDate(), entity, id, usage.getCount(), weeklyCount, monthlyCount, authHeaders);
  }

  public static void reportUsageByName(String entity, String name, DailyCount usage, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("usage/" + entity + "/name/" + name);
    TestUtils.post(target, usage, authHeaders);
  }

  public static void reportUsage(String entity, UUID id, DailyCount usage, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("usage/" + entity + "/" + id);
    TestUtils.post(target, usage, authHeaders);
  }

  public static void computePercentile(String entity, String date, Map<String, String> authHeaders)
          throws HttpResponseException {
    WebTarget target = getResource("usage/compute.percentile/" + entity + "/" + date);
    TestUtils.post(target, authHeaders);
  }

  public static void getAndCheckUsage(String entity, UUID id, String date, Integer days, int expectedRecords,
                                      Map<String, String> authHeaders) throws HttpResponseException {
    EntityUsage usage = getUsage(entity, id, date, days, authHeaders);
    assertEquals(expectedRecords, usage.getUsage().size());
  }

  public static EntityUsage getUsageByName(String entity, String fqn, String date, Integer days,
                                           Map<String, String> authHeaders) throws HttpResponseException {
    return getUsage(getResource("usage/" + entity +"/name/" + fqn), date, days, authHeaders);
  }

  public static EntityUsage getUsage(String entity, UUID id, String date, Integer days,
                                     Map<String, String> authHeaders) throws HttpResponseException {
    return getUsage(getResource("usage/" + entity + "/" + id), date, days, authHeaders);
  }

  public static EntityUsage getUsage(WebTarget target, String date, Integer days,
                                     Map<String, String> authHeaders) throws HttpResponseException {
    target = date != null ? target.queryParam("date", date) : target;
    target = days != null ? target.queryParam("days", days) : target;
    return TestUtils.get(target, EntityUsage.class, authHeaders);
  }


  public static void checkUsage(String date, String entity, UUID id, int dailyCount, int weeklyCount,
                                int monthlyCount, Map<String, String> authHeaders) throws HttpResponseException {
    EntityUsage usage = getUsage(entity, id, date, 1, authHeaders);
    assertEquals(id, usage.getEntity().getId());
    checkUsage(usage, date, entity, dailyCount, weeklyCount, monthlyCount);
  }

  public static void checkUsageByName(String date, String entity, String name, int dailyCount, int weeklyCount,
                                      int monthlyCount, Map<String, String> authHeaders) throws HttpResponseException {
    EntityUsage usage = getUsageByName(entity, name, date, 1, authHeaders);
    checkUsage(usage, date, entity, dailyCount, weeklyCount, monthlyCount);
  }

  public static void checkUsage(EntityUsage usage, String date, String entity, int dailyCount, int weeklyCount,
                                int monthlyCount) {
    assertEquals(entity, usage.getEntity().getType());
    UsageDetails usageDetails = usage.getUsage().get(0);
    assertEquals(date, usageDetails.getDate());
    assertEquals(dailyCount, usageDetails.getDailyStats().getCount());
    assertEquals(weeklyCount, usageDetails.getWeeklyStats().getCount());
    assertEquals(monthlyCount, usageDetails.getMonthlyStats().getCount());
  }
}
