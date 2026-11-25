package org.openmetadata.service.migration.utils;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Iterator;
import java.util.List;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class MigrationTableUtilTest {

  private Handle handle;
  private DatabaseMetaData metaData;

  @BeforeEach
  void setUp() throws SQLException {
    handle = mock(Handle.class);
    Connection connection = mock(Connection.class);
    metaData = mock(DatabaseMetaData.class);
    when(handle.getConnection()).thenReturn(connection);
    when(connection.getMetaData()).thenReturn(metaData);
    when(connection.getCatalog()).thenReturn("openmetadata_db");
    when(connection.getSchema()).thenReturn(null);
  }

  @Test
  void findsATableOnlyInTheDatabaseTheMigrationIsConnectedTo() throws SQLException {
    // A MySQL server holding a second OpenMetadata database: unscoped, its table is found too.
    ResultSet everyDatabase = tables("thread_entity_archived");
    ResultSet currentDatabase = tables();
    when(metaData.getTables(eq(null), any(), anyString(), any())).thenReturn(everyDatabase);
    when(metaData.getTables(eq("openmetadata_db"), any(), anyString(), any()))
        .thenReturn(currentDatabase);

    assertFalse(MigrationTableUtil.tableExists(handle, "thread_entity_archived"));
  }

  @Test
  void findsATableTheCurrentDatabaseHas() throws SQLException {
    ResultSet currentDatabase = tables("thread_entity_legacy");
    when(metaData.getTables(eq("openmetadata_db"), any(), anyString(), any()))
        .thenReturn(currentDatabase);

    assertTrue(MigrationTableUtil.tableExists(handle, "thread_entity_legacy"));
  }

  @Test
  void ignoresTablesThatOnlyMatchTheNameAsAPattern() throws SQLException {
    // '_' is a single-character wildcard in the metadata pattern.
    ResultSet currentDatabase = tables("threadXentity");
    when(metaData.getTables(eq("openmetadata_db"), any(), anyString(), any()))
        .thenReturn(currentDatabase);

    assertFalse(MigrationTableUtil.tableExists(handle, "thread_entity"));
  }

  @Test
  void treatsAMetadataFailureAsMissing() throws SQLException {
    when(metaData.getTables(any(), any(), anyString(), any()))
        .thenThrow(new SQLException("metadata unavailable"));

    assertFalse(MigrationTableUtil.tableExists(handle, "thread_entity"));
  }

  private static ResultSet tables(String... names) throws SQLException {
    ResultSet resultSet = mock(ResultSet.class);
    Iterator<String> remaining = List.of(names).iterator();
    String[] current = new String[1];
    when(resultSet.next())
        .thenAnswer(
            invocation -> {
              boolean hasNext = remaining.hasNext();
              if (hasNext) {
                current[0] = remaining.next();
              }
              return hasNext;
            });
    when(resultSet.getString("TABLE_NAME")).thenAnswer(invocation -> current[0]);
    return resultSet;
  }
}
