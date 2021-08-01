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
import org.openmetadata.common.utils.CommonUtil;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import javax.ws.rs.client.WebTarget;
import java.text.ParseException;
import java.util.ArrayList;
import java.util.Calendar;
import java.util.Date;
import java.util.List;
import java.util.Random;
import java.util.UUID;

import static javax.ws.rs.core.Response.Status.BAD_REQUEST;
import static javax.ws.rs.core.Response.Status.NOT_FOUND;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

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
      TABLES.add(TableResourceTest.createTable(createTable));
    }
  }

  @Test
  public void post_usageWithNonExistentEntityId_4xx() {
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> reportUsage(Entity.TABLE, TestUtils.NON_EXISTENT_ENTITY, usageReport()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityNotFound(Entity.TABLE, TestUtils.NON_EXISTENT_ENTITY));
  }

  @Test
  public void post_usageInvalidEntityName_4xx() {
    String invalidEntityType = "invalid";
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> reportUsage(invalidEntityType, UUID.randomUUID(), usageReport()));
    TestUtils.assertResponse(exception, NOT_FOUND, CatalogExceptionMessage.entityTypeNotFound(invalidEntityType));
  }

  @Test
  public void post_usageWithNegativeCountName_4xx() {
    DailyCount dailyCount = usageReport().withCount(-1); // Negative usage count
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> reportUsage(Entity.TABLE, UUID.randomUUID(), dailyCount));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[count must be greater than or equal to 0]");
  }

  @Test
  public void post_usageWithoutDate_4xx() {
    DailyCount usageReport = usageReport().withDate(null); // Negative usage count
    HttpResponseException exception =
            assertThrows(HttpResponseException.class, () -> reportUsage(Entity.TABLE, UUID.randomUUID(), usageReport));
    TestUtils.assertResponse(exception, BAD_REQUEST, "[date must not be null]");
  }

  @Test
  public void post_validUsageByName_200_OK(TestInfo test) throws HttpResponseException {
    Table table = TableResourceTest.createTable(TableResourceTest.create(test));
    DailyCount usageReport = usageReport().withCount(100).withDate(RestUtil.DATE_FORMAT.format(new Date()));
    reportUsageByNameAndCheck(Entity.TABLE, table.getFullyQualifiedName(), usageReport, 100, 100);
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
      String date = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, day);
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
        reportUsageAndCheck(Entity.TABLE, id, usageReport, weeklyCount, monthlyCount);

        // Database has cumulative count of all the table usage
        databaseDailyCount += usageCount;
        databaseWeeklyCount = Math.min(day, 6) * dailyDatabaseUsageCount + databaseDailyCount; // Cumulative weekly count for database
        databaseMonthlyCount = Math.min(day, 29) * dailyDatabaseUsageCount + databaseDailyCount; // Cumulative monthly count for database
        LOG.info("dailyDatabaseUsageCount {}, databaseDailyCount {} weekly {} monthly {}", dailyDatabaseUsageCount, databaseDailyCount, databaseWeeklyCount, databaseMonthlyCount);
        checkUsage(date, Entity.DATABASE, databaseId, databaseDailyCount, databaseWeeklyCount, databaseMonthlyCount);
      }

      // Compute daily percentiles now that all table usage have been published for a given date
      computePercentile(Entity.TABLE, date);
      computePercentile(Entity.DATABASE, date);
      // TODO check database percentile

      // For each day check percentile
      for (int tableIndex = 0; tableIndex < TABLES.size(); tableIndex++) {
        int expectedPercentile = 100*(tableIndex)/TABLES.size();
        EntityUsage usage = getUsage(Entity.TABLE, TABLES.get(tableIndex).getId(), date, 1);
        assertEquals(expectedPercentile, usage.getUsage().get(0).getDailyStats().getPercentileRank());
        assertEquals(expectedPercentile, usage.getUsage().get(0).getWeeklyStats().getPercentileRank());
        assertEquals(expectedPercentile, usage.getUsage().get(0).getMonthlyStats().getPercentileRank());
      }
    }

    // Test API returns right number of days of usage requests
    String date = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE - 1);
    // Number of days defaults to 1 when unspecified
    UUID tableId = TABLES.get(0).getId();
    getAndCheckUsage(Entity.TABLE, tableId, date, null /*, days not specified */, 1);

    // Usage for specified number of days is returned
    getAndCheckUsage(Entity.TABLE, tableId, date, 1, 1);
    getAndCheckUsage(Entity.TABLE, tableId, date, 5, 5);
    getAndCheckUsage(Entity.TABLE, tableId, date, 30, 30);

    // Usage for days out of range returned default number of days
    getAndCheckUsage(Entity.TABLE, tableId, date, 0, 1); // 0 days is defaulted to 1
    getAndCheckUsage(Entity.TABLE, tableId, date, -1, 1); // -1 days is defaulted to 1
    getAndCheckUsage(Entity.TABLE, tableId, date, 100, 30); // More than 30 days is defaulted to 30

    // Nothing is returned when usage for a date is not available
    date = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE); // One day beyond the last day of usage published
    getAndCheckUsage(Entity.TABLE, tableId, date, 1, 0); // 0 days of usage resulted
    getAndCheckUsage(Entity.TABLE, tableId, date, 5, 4); // Only 4 past usage records returned. For the given date there is no usage report.

    // Ensure GET .../tables/{id}?fields=usageSummary returns the latest usage
    date = CommonUtil.getDateStringByOffset(RestUtil.DATE_FORMAT, today, DAYS_OF_USAGE - 1); // Latest usage report date
    EntityUsage usage = getUsage(Entity.TABLE, tableId, date, null /*, days not specified */);
    Table table = TableResourceTest.getTable(TABLES.get(0).getId(), "usageSummary");
    Assertions.assertEquals(usage.getUsage().get(0), table.getUsageSummary());

    // Ensure GET .../databases/{id}?fields=usageSummary returns the latest usage
    usage = getUsage(Entity.DATABASE, databaseId, date, null /*, days not specified */);
    Database database = DatabaseResourceTest.getDatabase(databaseId, "usageSummary");
    Assertions.assertEquals(usage.getUsage().get(0), database.getUsageSummary());
  }

  /** Get date after n days from the given date or before n days when n is negative */
  public static String getNextDate(String strDate, int days) throws ParseException {
    Date date = RestUtil.DATE_FORMAT.parse(strDate);
    Calendar calendar = Calendar.getInstance();
    calendar.setTime(date);
    calendar.add(Calendar.DATE, days);
    Date nextDay = calendar.getTime();
    return RestUtil.DATE_FORMAT.format(nextDay);
  }

  public static DailyCount usageReport() {
    Random random = new Random();
    String today = RestUtil.DATE_FORMAT.format(new Date());
    return new DailyCount().withCount(random.nextInt(100)).withDate(today);
  }

  public static void reportUsageByNameAndCheck(String entity, String fqn, DailyCount usage, int weeklyCount, int monthlyCount) throws HttpResponseException {
    reportUsageByName(entity, fqn, usage);
    checkUsageByName(usage.getDate(), entity, fqn, usage.getCount(), weeklyCount, monthlyCount);
  }

  public static void reportUsageAndCheck(String entity, UUID id, DailyCount usage, int weeklyCount, int monthlyCount) throws HttpResponseException {
    reportUsage(entity, id, usage);
    checkUsage(usage.getDate(), entity, id, usage.getCount(), weeklyCount, monthlyCount);
  }

  public static void reportUsageByName(String entity, String name, DailyCount usage) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("usage/" + entity + "/name/" + name);
    TestUtils.post(target, usage);
  }

  public static void reportUsage(String entity, UUID id, DailyCount usage) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("usage/" + entity + "/" + id);
    TestUtils.post(target, usage);
  }

  public static void computePercentile(String entity, String date) throws HttpResponseException {
    WebTarget target = CatalogApplicationTest.getResource("usage/compute.percentile/" + entity + "/" + date);
    TestUtils.post(target);
  }

  public static void getAndCheckUsage(String entity, UUID id, String date, Integer days, int expectedRecords) throws HttpResponseException {
    EntityUsage usage = getUsage(entity, id, date, days);
    assertEquals(expectedRecords, usage.getUsage().size());
  }

  public static EntityUsage getUsageByName(String entity, String fqn, String date, Integer days) throws HttpResponseException {
    return getUsage(CatalogApplicationTest.getResource("usage/" + entity +"/name/" + fqn), date, days);
  }

  public static EntityUsage getUsage(String entity, UUID id, String date, Integer days) throws HttpResponseException {
    return getUsage(CatalogApplicationTest.getResource("usage/" + entity + "/" + id), date, days);
  }

  public static EntityUsage getUsage(WebTarget target, String date, Integer days) throws HttpResponseException {
    target = date != null ? target.queryParam("date", date) : target;
    target = days != null ? target.queryParam("days", days) : target;
    return TestUtils.get(target, EntityUsage.class);
  }


  public static void checkUsage(String date, String entity, UUID id, int dailyCount, int weeklyCount, int monthlyCount) throws HttpResponseException {
    EntityUsage usage = getUsage(entity, id, date, 1);
    assertEquals(id, usage.getEntity().getId());
    checkUsage(usage, date, entity, dailyCount, weeklyCount, monthlyCount);
  }

  public static void checkUsageByName(String date, String entity, String name, int dailyCount, int weeklyCount, int monthlyCount) throws HttpResponseException {
    EntityUsage usage = getUsageByName(entity, name, date, 1);
    checkUsage(usage, date, entity, dailyCount, weeklyCount, monthlyCount);
  }

  public static void checkUsage(EntityUsage usage, String date, String entity, int dailyCount, int weeklyCount, int monthlyCount) {
    assertEquals(entity, usage.getEntity().getType());
    UsageDetails usageDetails = usage.getUsage().get(0);
    assertEquals(date, usageDetails.getDate());
    assertEquals(dailyCount, usageDetails.getDailyStats().getCount());
    assertEquals(weeklyCount, usageDetails.getWeeklyStats().getCount());
    assertEquals(monthlyCount, usageDetails.getMonthlyStats().getCount());
  }
}
