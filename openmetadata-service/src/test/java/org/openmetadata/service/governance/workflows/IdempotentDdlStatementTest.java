/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.governance.workflows;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.sql.Connection;
import java.sql.DatabaseMetaData;
import java.sql.ResultSet;
import java.sql.Statement;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class IdempotentDdlStatementTest {

  private Statement delegate;
  private Connection connection;
  private DatabaseMetaData meta;
  private IdempotentDdlStatement stmt;

  @BeforeEach
  void setUp() throws Exception {
    delegate = mock(Statement.class);
    connection = mock(Connection.class);
    meta = mock(DatabaseMetaData.class);
    when(connection.getMetaData()).thenReturn(meta);
    when(connection.getCatalog()).thenReturn("openmetadata");
    // Default: DB stores lowercase (PostgreSQL behaviour)
    when(meta.storesLowerCaseIdentifiers()).thenReturn(true);
    when(meta.storesUpperCaseIdentifiers()).thenReturn(false);
    stmt = new IdempotentDdlStatement(delegate, connection);
  }

  // --- CREATE INDEX ---

  @Test
  void skipsCreateIndexWhenIndexExists() throws Exception {
    ResultSet rs = mockResultSetWithIndexName("ACT_IDX_BYTEAR_DEPL");
    when(meta.getIndexInfo(
            eq("openmetadata"), isNull(), eq("act_ge_bytearray"), anyBoolean(), anyBoolean()))
        .thenReturn(rs);

    boolean result =
        stmt.execute("CREATE INDEX ACT_IDX_BYTEAR_DEPL ON ACT_GE_BYTEARRAY (DEPLOYMENT_ID_)");

    assertFalse(result);
    verify(delegate, never()).execute(anyString());
  }

  @Test
  void executesCreateIndexWhenIndexAbsent() throws Exception {
    ResultSet rs = emptyResultSet();
    when(meta.getIndexInfo(
            eq("openmetadata"), isNull(), eq("act_ge_bytearray"), anyBoolean(), anyBoolean()))
        .thenReturn(rs);
    when(delegate.execute(anyString())).thenReturn(false);

    stmt.execute("CREATE INDEX ACT_IDX_BYTEAR_DEPL ON ACT_GE_BYTEARRAY (DEPLOYMENT_ID_)");

    verify(delegate)
        .execute("CREATE INDEX ACT_IDX_BYTEAR_DEPL ON ACT_GE_BYTEARRAY (DEPLOYMENT_ID_)");
  }

  @Test
  void skipsCreateUniqueIndex() throws Exception {
    ResultSet rs = mockResultSetWithIndexName("ACT_UNIQ_MEMB");
    when(meta.getIndexInfo(
            eq("openmetadata"), isNull(), eq("act_id_membership"), anyBoolean(), anyBoolean()))
        .thenReturn(rs);

    boolean result =
        stmt.execute(
            "CREATE UNIQUE INDEX ACT_UNIQ_MEMB ON ACT_ID_MEMBERSHIP (USER_ID_, GROUP_ID_)");

    assertFalse(result);
    verify(delegate, never()).execute(anyString());
  }

  // --- CREATE TABLE ---

  @Test
  void skipsCreateTableWhenTableExists() throws Exception {
    ResultSet rs = singleRowResultSet();
    when(meta.getTables(eq("openmetadata"), isNull(), eq("act_ru_actinst"), isNull()))
        .thenReturn(rs);

    boolean result = stmt.execute("CREATE TABLE ACT_RU_ACTINST (ID_ varchar(64) NOT NULL)");

    assertFalse(result);
    verify(delegate, never()).execute(anyString());
  }

  @Test
  void executesCreateTableWhenTableAbsent() throws Exception {
    ResultSet rs = emptyResultSet();
    when(meta.getTables(eq("openmetadata"), isNull(), eq("act_ru_actinst"), isNull()))
        .thenReturn(rs);
    when(delegate.execute(anyString())).thenReturn(false);

    stmt.execute("CREATE TABLE ACT_RU_ACTINST (ID_ varchar(64) NOT NULL)");

    verify(delegate).execute("CREATE TABLE ACT_RU_ACTINST (ID_ varchar(64) NOT NULL)");
  }

  // --- ALTER TABLE ADD COLUMN ---

  @Test
  void skipsAlterTableAddColumnWhenColumnExists() throws Exception {
    ResultSet rs = mockResultSetWithColumnName("completed_by_");
    when(meta.getColumns(eq("openmetadata"), isNull(), eq("act_ru_actinst"), isNull()))
        .thenReturn(rs);

    boolean result =
        stmt.execute("ALTER TABLE ACT_RU_ACTINST ADD COLUMN COMPLETED_BY_ varchar(255)");

    assertFalse(result);
    verify(delegate, never()).execute(anyString());
  }

  @Test
  void executesAlterTableAddColumnWhenColumnAbsent() throws Exception {
    ResultSet rs = emptyResultSet();
    when(meta.getColumns(eq("openmetadata"), isNull(), eq("act_ru_actinst"), isNull()))
        .thenReturn(rs);
    when(delegate.execute(anyString())).thenReturn(false);

    stmt.execute("ALTER TABLE ACT_RU_ACTINST ADD COLUMN COMPLETED_BY_ varchar(255)");

    verify(delegate).execute("ALTER TABLE ACT_RU_ACTINST ADD COLUMN COMPLETED_BY_ varchar(255)");
  }

  @Test
  void doesNotMatchAlterTableAddConstraint() throws Exception {
    when(delegate.execute(anyString())).thenReturn(false);

    stmt.execute("ALTER TABLE ACT_RU_TASK ADD CONSTRAINT PK_RU PRIMARY KEY (ID_)");

    verify(delegate).execute("ALTER TABLE ACT_RU_TASK ADD CONSTRAINT PK_RU PRIMARY KEY (ID_)");
    verify(meta, never()).getColumns(anyString(), anyString(), anyString(), anyString());
  }

  @Test
  void doesNotMatchAlterTableAddPrimaryKey() throws Exception {
    when(delegate.execute(anyString())).thenReturn(false);

    stmt.execute("ALTER TABLE ACT_RU_TASK ADD PRIMARY KEY (ID_)");

    verify(delegate).execute("ALTER TABLE ACT_RU_TASK ADD PRIMARY KEY (ID_)");
    verify(meta, never()).getColumns(anyString(), anyString(), anyString(), anyString());
  }

  // --- executeUpdate overloads ---

  @Test
  void skipsExecuteUpdateForExistingIndex() throws Exception {
    ResultSet rs = mockResultSetWithIndexName("ACT_IDX_BYTEAR_DEPL");
    when(meta.getIndexInfo(
            eq("openmetadata"), isNull(), eq("act_ge_bytearray"), anyBoolean(), anyBoolean()))
        .thenReturn(rs);

    int result =
        stmt.executeUpdate("CREATE INDEX ACT_IDX_BYTEAR_DEPL ON ACT_GE_BYTEARRAY (DEPLOYMENT_ID_)");

    assertEquals(0, result);
    verify(delegate, never()).executeUpdate(anyString());
  }

  // --- Pass-through ---

  @Test
  void passesThroughNonDdlStatements() throws Exception {
    String sql = "SELECT * FROM ACT_GE_PROPERTY WHERE NAME_ = 'common.schema.version'";
    when(delegate.execute(sql)).thenReturn(true);

    stmt.execute(sql);

    verify(delegate).execute(sql);
  }

  @Test
  void skipsCreateIndexOnMysqlWithUpperCaseStoredIdentifiers() throws Exception {
    // MySQL lower_case_table_names=0: identifiers stored as-is (uppercase)
    when(meta.storesLowerCaseIdentifiers()).thenReturn(false);
    when(meta.storesUpperCaseIdentifiers()).thenReturn(true);

    ResultSet rs = mockResultSetWithIndexName("ACT_IDX_BYTEAR_DEPL");
    when(meta.getIndexInfo(
            eq("openmetadata"), isNull(), eq("ACT_GE_BYTEARRAY"), anyBoolean(), anyBoolean()))
        .thenReturn(rs);

    boolean result =
        stmt.execute("CREATE INDEX ACT_IDX_BYTEAR_DEPL ON ACT_GE_BYTEARRAY (DEPLOYMENT_ID_)");

    assertFalse(result);
    verify(delegate, never()).execute(anyString());
  }

  // --- Helpers ---

  private ResultSet mockResultSetWithIndexName(String name) throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.next()).thenReturn(true, false);
    when(rs.getString("INDEX_NAME")).thenReturn(name);
    return rs;
  }

  private ResultSet mockResultSetWithColumnName(String name) throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.next()).thenReturn(true, false);
    when(rs.getString("COLUMN_NAME")).thenReturn(name);
    return rs;
  }

  private ResultSet singleRowResultSet() throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.next()).thenReturn(true);
    return rs;
  }

  private ResultSet emptyResultSet() throws Exception {
    ResultSet rs = mock(ResultSet.class);
    when(rs.next()).thenReturn(false);
    return rs;
  }
}
