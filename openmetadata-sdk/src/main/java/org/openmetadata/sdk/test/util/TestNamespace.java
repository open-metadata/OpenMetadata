/*
 *  Copyright 2025 Collate
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
package org.openmetadata.sdk.test.util;

import java.util.UUID;

/**
 * Per-test-method namespace for entity names. Combines a process-wide run id, a test class id,
 * and the current test method id to produce collision-free prefixes when multiple tests (or
 * multiple processes running in parallel) hit the same server. Call {@link #prefix(String)} or
 * {@link #shortPrefix(String)} when naming entities; call {@link #uniqueShortId()} when a fresh
 * unique id is needed on every call.
 */
public class TestNamespace {
  private static final String RUN_ID = UUID.randomUUID().toString().replaceAll("-", "");
  private final String classId;
  private String methodId;
  private String cachedShortPrefix;

  public TestNamespace(String classId) {
    this.classId = classId;
  }

  public void setMethodId(String methodId) {
    this.methodId = methodId;
    this.cachedShortPrefix = null;
  }

  public String prefix(String base) {
    return base + "__" + RUN_ID + "__" + classId + (methodId != null ? ("__" + methodId) : "");
  }

  /**
   * Returns a short prefix suitable for database entity names with length constraints. The result
   * is cached per method — calling this multiple times within the same test method returns the
   * same value. Use {@link #uniqueShortId()} if you need a fresh unique id on every call.
   */
  public String shortPrefix() {
    if (cachedShortPrefix == null) {
      String shortRun = RUN_ID.substring(0, 8);
      String methodHash =
          methodId != null ? Integer.toHexString(Math.abs(methodId.hashCode()) % 0xFFFF) : "0";
      String uniqueSuffix = UUID.randomUUID().toString().substring(0, 4);
      cachedShortPrefix = shortRun + methodHash + uniqueSuffix;
    }
    return cachedShortPrefix;
  }

  public String shortPrefix(String base) {
    return shortPrefix() + "_" + base;
  }

  public String uniqueShortId() {
    String shortRun = RUN_ID.substring(0, 8);
    String methodHash =
        methodId != null ? Integer.toHexString(Math.abs(methodId.hashCode()) % 0xFFFF) : "0";
    String uniqueSuffix = UUID.randomUUID().toString().substring(0, 4);
    return shortRun + methodHash + uniqueSuffix;
  }
}
