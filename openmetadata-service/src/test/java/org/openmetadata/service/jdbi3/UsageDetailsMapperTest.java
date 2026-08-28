package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.UsageDetails;

class UsageDetailsMapperTest {

  private ResultSet mockResultSet(java.sql.Date usageDate) throws SQLException {
    ResultSet r = mock(ResultSet.class);
    when(r.getDate("usageDate")).thenReturn(usageDate);
    when(r.getInt("count1")).thenReturn(10);
    when(r.getDouble("percentile1")).thenReturn(80.0);
    when(r.getInt("count7")).thenReturn(70);
    when(r.getDouble("percentile7")).thenReturn(75.0);
    when(r.getInt("count30")).thenReturn(300);
    when(r.getDouble("percentile30")).thenReturn(70.0);
    return r;
  }

  private ResultSet mockResultSetWithId(java.sql.Date usageDate) throws SQLException {
    ResultSet r = mockResultSet(usageDate);
    when(r.getString("id")).thenReturn("test-entity-id");
    return r;
  }

  // --- CollectionDAO.UsageDAO.UsageDetailsMapper ---

  @Test
  void collectionDaoMapper_producesDateWithoutTimeComponent() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSet(date);

    CollectionDAO.UsageDAO.UsageDetailsMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mock(StatementContext.class));

    assertEquals("2026-03-19", result.getDate());
    assertFalse(result.getDate().contains(" "), "Date must not contain space (ES incompatible)");
    assertFalse(
        result.getDate().contains("00:00:00"),
        "Date must not contain time component (MySQL getString() artifact)");
  }

  @Test
  void collectionDaoMapper_nullDateReturnsNull() throws SQLException {
    ResultSet r = mockResultSet(null);

    CollectionDAO.UsageDAO.UsageDetailsMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mock(StatementContext.class));

    assertNull(result.getDate());
  }

  @Test
  void collectionDaoMapper_mapsAllStatsCorrectly() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSet(date);

    CollectionDAO.UsageDAO.UsageDetailsMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mock(StatementContext.class));

    assertNotNull(result.getDailyStats());
    assertEquals(10, result.getDailyStats().getCount());
    assertEquals(80.0, result.getDailyStats().getPercentileRank());

    assertNotNull(result.getWeeklyStats());
    assertEquals(70, result.getWeeklyStats().getCount());
    assertEquals(75.0, result.getWeeklyStats().getPercentileRank());

    assertNotNull(result.getMonthlyStats());
    assertEquals(300, result.getMonthlyStats().getCount());
    assertEquals(70.0, result.getMonthlyStats().getPercentileRank());
  }

  // --- CollectionDAO.UsageDAO.UsageDetailsWithIdMapper ---

  @Test
  void collectionDaoWithIdMapper_producesDateWithoutTimeComponent() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSetWithId(date);

    CollectionDAO.UsageDAO.UsageDetailsWithIdMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsWithIdMapper();
    CollectionDAO.UsageDAO.UsageDetailsWithId result = mapper.map(r, mock(StatementContext.class));

    assertEquals("test-entity-id", result.getEntityId());
    assertEquals("2026-03-19", result.getUsageDetails().getDate());
    assertFalse(result.getUsageDetails().getDate().contains(" "));
  }

  @Test
  void collectionDaoWithIdMapper_nullDateReturnsNull() throws SQLException {
    ResultSet r = mockResultSetWithId(null);

    CollectionDAO.UsageDAO.UsageDetailsWithIdMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsWithIdMapper();
    CollectionDAO.UsageDAO.UsageDetailsWithId result = mapper.map(r, mock(StatementContext.class));

    assertEquals("test-entity-id", result.getEntityId());
    assertNull(result.getUsageDetails().getDate());
  }

  @Test
  void collectionDaoWithIdMapper_mapsStatsCorrectly() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSetWithId(date);

    CollectionDAO.UsageDAO.UsageDetailsWithIdMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsWithIdMapper();
    CollectionDAO.UsageDAO.UsageDetailsWithId result = mapper.map(r, mock(StatementContext.class));

    UsageDetails usage = result.getUsageDetails();
    assertEquals(10, usage.getDailyStats().getCount());
    assertEquals(70, usage.getWeeklyStats().getCount());
    assertEquals(300, usage.getMonthlyStats().getCount());
  }

  // --- UsageRepository.UsageDetailsMapper ---

  @Test
  void usageRepoMapper_producesDateWithoutTimeComponent() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSet(date);

    UsageRepository.UsageDetailsMapper mapper = new UsageRepository.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mock(StatementContext.class));

    assertEquals("2026-03-19", result.getDate());
    assertFalse(result.getDate().contains(" "));
  }

  @Test
  void usageRepoMapper_nullDateReturnsNull() throws SQLException {
    ResultSet r = mockResultSet(null);

    UsageRepository.UsageDetailsMapper mapper = new UsageRepository.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mock(StatementContext.class));

    assertNull(result.getDate());
  }

  // --- java.sql.Date format contract ---

  @Test
  void sqlDateToString_alwaysProducesEsCompatibleFormat() {
    // java.sql.Date.toString() contract: always "yyyy-MM-dd"
    // This is the foundation of the fix — if this ever changes, all mappers break.
    String[] testDates = {"2026-03-19", "2020-01-01", "2025-12-31"};
    for (String dateStr : testDates) {
      java.sql.Date date = java.sql.Date.valueOf(dateStr);
      String formatted = date.toString();
      assertEquals(dateStr, formatted);
      assertFalse(formatted.contains(" "), "Must not contain space: " + formatted);
      assertFalse(formatted.contains("T"), "Must not contain T separator: " + formatted);
      assertEquals(10, formatted.length(), "Must be exactly yyyy-MM-dd length: " + formatted);
    }
  }
}
