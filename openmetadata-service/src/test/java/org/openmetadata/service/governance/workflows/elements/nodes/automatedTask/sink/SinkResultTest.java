/*
 *  Copyright 2024 Collate
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

package org.openmetadata.service.governance.workflows.elements.nodes.automatedTask.sink;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SinkResultTest {

  @Test
  void testSuccessSingleEntity() {
    String entityFqn = "database.schema.table";
    SinkResult result = SinkResult.success(entityFqn);

    assertTrue(result.isSuccess());
    assertEquals(1, result.getSyncedCount());
    assertEquals(0, result.getFailedCount());
    assertEquals(List.of(entityFqn), result.getSyncedEntities());
    assertTrue(result.getErrors().isEmpty());
  }

  @Test
  void testSuccessMultipleEntities() {
    List<String> entities = List.of("table1", "table2", "table3");
    SinkResult result = SinkResult.success(entities);

    assertTrue(result.isSuccess());
    assertEquals(3, result.getSyncedCount());
    assertEquals(0, result.getFailedCount());
    assertEquals(entities, result.getSyncedEntities());
    assertTrue(result.getErrors().isEmpty());
  }

  @Test
  void testFailureWithMessage() {
    String entityFqn = "database.schema.table";
    String errorMessage = "Connection refused";
    SinkResult result = SinkResult.failure(entityFqn, errorMessage);

    assertFalse(result.isSuccess());
    assertEquals(0, result.getSyncedCount());
    assertEquals(1, result.getFailedCount());
    assertEquals(1, result.getErrors().size());

    SinkResult.SinkError error = result.getErrors().get(0);
    assertEquals(entityFqn, error.getEntityFqn());
    assertEquals(errorMessage, error.getErrorMessage());
  }

  @Test
  void testFailureWithException() {
    String entityFqn = "database.schema.table";
    RuntimeException exception = new RuntimeException("Network error");
    SinkResult result = SinkResult.failure(entityFqn, exception);

    assertFalse(result.isSuccess());
    assertEquals(0, result.getSyncedCount());
    assertEquals(1, result.getFailedCount());
    assertEquals(1, result.getErrors().size());

    SinkResult.SinkError error = result.getErrors().get(0);
    assertEquals(entityFqn, error.getEntityFqn());
    assertEquals("Network error", error.getErrorMessage());
    assertEquals(exception, error.getCause());
  }

  @Test
  void testBuilderWithMetadata() {
    SinkResult result =
        SinkResult.builder()
            .success(true)
            .syncedCount(5)
            .failedCount(0)
            .syncedEntities(List.of("e1", "e2", "e3", "e4", "e5"))
            .metadata(Map.of("commitSha", "abc123", "branch", "main"))
            .build();

    assertTrue(result.isSuccess());
    assertEquals(5, result.getSyncedCount());
    assertEquals("abc123", result.getMetadata().get("commitSha"));
    assertEquals("main", result.getMetadata().get("branch"));
  }

  @Test
  void testBuilderWithErrors() {
    SinkResult.SinkError error1 =
        SinkResult.SinkError.builder()
            .entityFqn("table1")
            .errorMessage("Permission denied")
            .errorCode("403")
            .build();

    SinkResult.SinkError error2 =
        SinkResult.SinkError.builder()
            .entityFqn("table2")
            .errorMessage("Not found")
            .errorCode("404")
            .build();

    SinkResult result =
        SinkResult.builder()
            .success(false)
            .syncedCount(3)
            .failedCount(2)
            .syncedEntities(List.of("table3", "table4", "table5"))
            .errors(List.of(error1, error2))
            .build();

    assertFalse(result.isSuccess());
    assertEquals(3, result.getSyncedCount());
    assertEquals(2, result.getFailedCount());
    assertEquals(2, result.getErrors().size());
    assertEquals("403", result.getErrors().get(0).getErrorCode());
    assertEquals("404", result.getErrors().get(1).getErrorCode());
  }

  @Test
  void testSinkErrorBuilder() {
    Exception cause = new RuntimeException("Root cause");
    SinkResult.SinkError error =
        SinkResult.SinkError.builder()
            .entityFqn("my.entity.fqn")
            .errorMessage("Failed to sync")
            .errorCode("SYNC_FAILED")
            .cause(cause)
            .build();

    assertEquals("my.entity.fqn", error.getEntityFqn());
    assertEquals("Failed to sync", error.getErrorMessage());
    assertEquals("SYNC_FAILED", error.getErrorCode());
    assertEquals(cause, error.getCause());
  }

  @Test
  void testDefaultCollections() {
    SinkResult result = SinkResult.builder().success(true).syncedCount(0).failedCount(0).build();

    assertNotNull(result.getSyncedEntities());
    assertNotNull(result.getErrors());
    assertNotNull(result.getMetadata());
    assertTrue(result.getSyncedEntities().isEmpty());
    assertTrue(result.getErrors().isEmpty());
    assertTrue(result.getMetadata().isEmpty());
  }
}
