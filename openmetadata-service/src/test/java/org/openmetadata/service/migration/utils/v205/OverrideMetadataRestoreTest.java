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

package org.openmetadata.service.migration.utils.v205;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;

import java.sql.SQLException;
import java.sql.SQLSyntaxErrorException;
import java.sql.SQLTransientConnectionException;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.service.jdbi3.MigrationDAO;
import org.openmetadata.service.migration.utils.v205.OverrideMetadataRestore.Window;

class OverrideMetadataRestoreTest {

  private MigrationDAO migrationDAO;

  @BeforeEach
  void setUp() {
    migrationDAO = mock(MigrationDAO.class);
  }

  @Test
  void triesEveryEntityTypeEvenWhenOneFails() {
    IllegalStateException failure =
        assertThrows(
            IllegalStateException.class,
            () -> OverrideMetadataRestore.restoreTypes(List.of("noSuchTypeA", "noSuchTypeB"), 0));

    assertTrue(failure.getMessage().contains("noSuchTypeA"), failure.getMessage());
    assertTrue(
        failure.getMessage().contains("noSuchTypeB"),
        "the type after a failing one must still be tried: " + failure.getMessage());
  }

  @Test
  void aMissingChangeLogMeansAFreshInstall() {
    assertTrue(
        OverrideMetadataRestore.isMissingTable(
            new IllegalStateException(new SQLSyntaxErrorException("no table", "42S02"))));
    assertTrue(
        OverrideMetadataRestore.isMissingTable(
            new IllegalStateException(new SQLException("relation does not exist", "42P01"))));
  }

  @Test
  void anyOtherFailureToReadTheChangeLogIsNotAFreshInstall() {
    assertFalse(
        OverrideMetadataRestore.isMissingTable(
            new IllegalStateException(new SQLTransientConnectionException("timed out", "08S01"))));
    assertFalse(OverrideMetadataRestore.isMissingTable(new NullPointerException()));
  }

  @Test
  void anUnreadableWindowRestoresNothingAndRecordsNoMarker() {
    OverrideMetadataRestore.restoreOnce(
        migrationDAO, new Window(null, new IllegalStateException("database unreachable")));

    verify(migrationDAO, never()).getSqlQuery(anyString(), anyString());
    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void aFailedRestoreRecordsNoMarkerAndDoesNotFailTheUpgrade() {
    // No entity repository is registered here, so every entity type fails.
    OverrideMetadataRestore.restoreOnce(migrationDAO, new Window(1_000L, null));

    verify(migrationDAO, never()).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }

  @Test
  void anInstanceThatNeverRan20RecordsTheMarker() {
    OverrideMetadataRestore.restoreOnce(migrationDAO, new Window(null, null));

    verify(migrationDAO).upsertServerMigrationSQL(anyString(), anyString(), anyString());
  }
}
