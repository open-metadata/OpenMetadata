package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.when;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.jdbi.v3.core.statement.StatementContext;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.type.UsageDetails;

public class UsageDetailsMapperTest {

  private ResultSet mockResultSet(java.sql.Date usageDate) throws SQLException {
    ResultSet r = Mockito.mock(ResultSet.class);
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

  private StatementContext mockContext() {
    return Mockito.mock(StatementContext.class);
  }

  @Test
  void testCollectionDAOUsageDetailsMapperWithDate() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSet(date);

    CollectionDAO.UsageDAO.UsageDetailsMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mockContext());

    assertEquals("2026-03-19", result.getDate());
    assertEquals(10, result.getDailyStats().getCount());
    assertEquals(70, result.getWeeklyStats().getCount());
    assertEquals(300, result.getMonthlyStats().getCount());
  }

  @Test
  void testCollectionDAOUsageDetailsMapperWithNullDate() throws SQLException {
    ResultSet r = mockResultSet(null);

    CollectionDAO.UsageDAO.UsageDetailsMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mockContext());

    assertNull(result.getDate());
  }

  @Test
  void testCollectionDAOUsageDetailsWithIdMapperWithDate() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSetWithId(date);

    CollectionDAO.UsageDAO.UsageDetailsWithIdMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsWithIdMapper();
    CollectionDAO.UsageDAO.UsageDetailsWithId result = mapper.map(r, mockContext());

    assertEquals("test-entity-id", result.getEntityId());
    assertEquals("2026-03-19", result.getUsageDetails().getDate());
  }

  @Test
  void testCollectionDAOUsageDetailsWithIdMapperWithNullDate() throws SQLException {
    ResultSet r = mockResultSetWithId(null);

    CollectionDAO.UsageDAO.UsageDetailsWithIdMapper mapper =
        new CollectionDAO.UsageDAO.UsageDetailsWithIdMapper();
    CollectionDAO.UsageDAO.UsageDetailsWithId result = mapper.map(r, mockContext());

    assertEquals("test-entity-id", result.getEntityId());
    assertNull(result.getUsageDetails().getDate());
  }

  @Test
  void testUsageRepositoryMapperWithDate() throws SQLException {
    java.sql.Date date = java.sql.Date.valueOf("2026-03-19");
    ResultSet r = mockResultSet(date);

    UsageRepository.UsageDetailsMapper mapper = new UsageRepository.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mockContext());

    assertEquals("2026-03-19", result.getDate());
    assertEquals(10, result.getDailyStats().getCount());
    assertEquals(70, result.getWeeklyStats().getCount());
    assertEquals(300, result.getMonthlyStats().getCount());
  }

  @Test
  void testUsageRepositoryMapperWithNullDate() throws SQLException {
    ResultSet r = mockResultSet(null);

    UsageRepository.UsageDetailsMapper mapper = new UsageRepository.UsageDetailsMapper();
    UsageDetails result = mapper.map(r, mockContext());

    assertNull(result.getDate());
  }
}
