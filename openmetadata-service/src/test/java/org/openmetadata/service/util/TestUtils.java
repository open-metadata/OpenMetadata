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

package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.jayway.jsonpath.DocumentContext;
import com.jayway.jsonpath.PathNotFoundException;
import java.util.List;
import java.util.Map;

public final class TestUtils {

  private TestUtils() {}

  /**
   * Simulates work by performing a CPU-intensive operation that takes approximately the specified
   * milliseconds. This is more reliable than Thread.sleep() for testing as it doesn't block threads
   * and is more predictable.
   */
  public static void simulateWork(long targetMillis) {
    long startTime = System.nanoTime();
    long targetNanos = targetMillis * 1_000_000L;

    while ((System.nanoTime() - startTime) < targetNanos) {
      Math.sqrt(Math.random());
    }
  }

  public static String plurializeEntityType(String entityType) {
    if (entityType.endsWith("s")) {
      return entityType + "es";
    } else if (entityType.endsWith("y")) {
      return entityType.substring(0, entityType.length() - 1) + "ies";
    } else {
      return entityType + "s";
    }
  }

  public static void assertFieldExists(
      DocumentContext jsonContext, String jsonPath, String fieldName) {
    List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
    assertFalse(
        (result == null || result.isEmpty()), "The query should contain '" + fieldName + "' term.");
  }

  public static void assertFieldDoesNotExist(
      DocumentContext jsonContext, String jsonPath, String fieldName) {
    try {
      List<Map<String, Object>> result = jsonContext.read(jsonPath, List.class);
      assertTrue(result.isEmpty(), "The query should not contain '" + fieldName + "' term.");
    } catch (PathNotFoundException e) {
      assertTrue(true, "The path does not exist as expected: " + jsonPath);
    }
  }
}
