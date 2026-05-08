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
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.AsyncJobResponse;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.databases.DatabaseService;

/**
 * Verifies the fluent restore builders added for issue #4003. {@code .restore().execute()}
 * routes to the synchronous SDK call; chaining {@code .async()} switches to the server-side
 * async path and returns an {@link AsyncJobResponse}.
 */
class RestoreFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TableService mockTables;
  @Mock private DatabaseService mockDatabases;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.tables()).thenReturn(mockTables);
    when(mockClient.databases()).thenReturn(mockDatabases);
    Tables.setDefaultClient(mockClient);
    Databases.setDefaultClient(mockClient);
  }

  @Test
  void tablesFluent_syncRestore_callsRestore() throws Exception {
    String id = UUID.randomUUID().toString();
    Table restored = new Table().withId(UUID.fromString(id)).withName("t");
    when(mockTables.restore(id)).thenReturn(restored);

    Table result = Tables.find(id).restore().execute();

    assertSame(restored, result);
    verify(mockTables).restore(id);
    verify(mockTables, never()).restoreServerAsync(eq(id));
  }

  @Test
  void tablesFluent_asyncRestore_callsRestoreServerAsync() throws Exception {
    String id = UUID.randomUUID().toString();
    AsyncJobResponse expected = new AsyncJobResponse("job-1", "Restore initiated successfully.");
    when(mockTables.restoreServerAsync(id)).thenReturn(expected);

    AsyncJobResponse result = Tables.find(id).restore().async().execute();

    assertNotNull(result);
    assertEquals("job-1", result.getJobId());
    assertEquals("Restore initiated successfully.", result.getMessage());
    verify(mockTables).restoreServerAsync(id);
    verify(mockTables, never()).restore(eq(id));
  }

  @Test
  void databasesFluent_syncRestore_callsRestore() throws Exception {
    String id = UUID.randomUUID().toString();
    Database restored = new Database().withId(UUID.fromString(id)).withName("db");
    when(mockDatabases.restore(id)).thenReturn(restored);

    Database result = Databases.find(id).restore().execute();

    assertSame(restored, result);
    verify(mockDatabases).restore(id);
    verify(mockDatabases, never()).restoreServerAsync(eq(id));
  }

  @Test
  void databasesFluent_asyncRestore_callsRestoreServerAsync() throws Exception {
    String id = UUID.randomUUID().toString();
    AsyncJobResponse expected = new AsyncJobResponse("job-2", "Restore initiated successfully.");
    when(mockDatabases.restoreServerAsync(id)).thenReturn(expected);

    AsyncJobResponse result = Databases.find(id).restore().async().execute();

    assertNotNull(result);
    assertEquals("job-2", result.getJobId());
    verify(mockDatabases).restoreServerAsync(id);
    verify(mockDatabases, never()).restore(eq(id));
  }
}
