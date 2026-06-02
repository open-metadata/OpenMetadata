/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.migration.utils.v11210;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.List;
import java.util.Map;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.openmetadata.service.jdbi3.locator.ConnectionType;

class MigrationUtilTest {

  private static Map<String, Object> stuckCertificationRow() {
    return Map.of(
        "id", "11111111-1111-1111-1111-111111111111",
        "fqnhash", "abcdef",
        "tagfqn", "Certification.Gold",
        "applieddate", 1700000000000L,
        "expirydate", 1800000000000L);
  }

  @Test
  void postgresHealInsertCastsMetadataToJson() {
    // The #2B regression: on PG the metadata (json) column rejects an uncast varchar bind. The
    // heal's insert must cast :metadata to json or it fails the same way v1125 did.
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(anyString()).mapToMap().list())
        .thenReturn(List.of(stuckCertificationRow()));
    ArgumentCaptor<String> insertSql = ArgumentCaptor.forClass(String.class);

    MigrationUtil.healStuckCertificationOnEntityJson(handle, ConnectionType.POSTGRES);

    verify(handle, atLeastOnce()).prepareBatch(insertSql.capture());
    assertTrue(
        insertSql.getAllValues().stream().allMatch(sql -> sql.contains(":metadata::json")),
        "PostgreSQL heal insert must cast :metadata to json");
  }

  @Test
  void mysqlHealInsertDoesNotCastMetadata() {
    // MySQL JSON columns accept a string literal; the ::json cast is PG-only syntax.
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(anyString()).mapToMap().list())
        .thenReturn(List.of(stuckCertificationRow()));
    ArgumentCaptor<String> insertSql = ArgumentCaptor.forClass(String.class);

    MigrationUtil.healStuckCertificationOnEntityJson(handle, ConnectionType.MYSQL);

    verify(handle, atLeastOnce()).prepareBatch(insertSql.capture());
    assertFalse(
        insertSql.getAllValues().stream().anyMatch(sql -> sql.contains("::json")),
        "MySQL heal insert must not use the PG-only ::json cast");
  }

  @Test
  void healWithNoStuckRowsIsNoOp() {
    // Idempotency: clusters with nothing stranded (fresh installs, healthy MySQL, already-healed
    // PG) match zero rows and must neither insert nor throw.
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    when(handle.createQuery(anyString()).mapToMap().list()).thenReturn(List.of());

    assertDoesNotThrow(
        () -> MigrationUtil.healStuckCertificationOnEntityJson(handle, ConnectionType.POSTGRES));
    verify(handle, never()).prepareBatch(anyString());
  }
}
