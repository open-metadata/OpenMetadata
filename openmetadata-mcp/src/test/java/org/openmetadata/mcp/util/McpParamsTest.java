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

package org.openmetadata.mcp.util;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Pins the three shared fall-through cases (missing key, present-but-null, unparseable) that the
 * per-tool {@code parseIntParam}/{@code parseBooleanParam}/{@code parseDoubleParam} copies all
 * funnelled to the default, so migrating the call sites to {@link McpParams} cannot drift.
 */
class McpParamsTest {

  private static Map<String, Object> params(String key, Object value) {
    Map<String, Object> params = new HashMap<>();
    params.put(key, value);
    return params;
  }

  @Test
  void getIntAcceptsNumberAndNumericString() {
    assertThat(McpParams.getInt(params("size", 25), "size", 1)).isEqualTo(25);
    assertThat(McpParams.getInt(params("size", "30"), "size", 1)).isEqualTo(30);
  }

  @Test
  void getIntFallsBackOnMissingNullAndUnparseable() {
    assertThat(McpParams.getInt(new HashMap<>(), "size", 7)).isEqualTo(7);
    assertThat(McpParams.getInt(params("size", null), "size", 7)).isEqualTo(7);
    assertThat(McpParams.getInt(params("size", "abc"), "size", 7)).isEqualTo(7);
  }

  @Test
  void getDoubleAcceptsNumberAndNumericString() {
    assertThat(McpParams.getDouble(params("threshold", 0.5), "threshold", 0.0)).isEqualTo(0.5);
    assertThat(McpParams.getDouble(params("threshold", "0.25"), "threshold", 0.0)).isEqualTo(0.25);
  }

  @Test
  void getDoubleFallsBackOnMissingNullAndUnparseable() {
    assertThat(McpParams.getDouble(new HashMap<>(), "threshold", 1.0)).isEqualTo(1.0);
    assertThat(McpParams.getDouble(params("threshold", null), "threshold", 1.0)).isEqualTo(1.0);
    assertThat(McpParams.getDouble(params("threshold", "x"), "threshold", 1.0)).isEqualTo(1.0);
  }

  @Test
  void getBooleanAcceptsBooleanAndString() {
    assertThat(McpParams.getBoolean(params("flag", true), "flag", false)).isTrue();
    assertThat(McpParams.getBoolean(params("flag", "true"), "flag", false)).isTrue();
    assertThat(McpParams.getBoolean(params("flag", "TRUE"), "flag", false)).isTrue();
    assertThat(McpParams.getBoolean(params("flag", "nonsense"), "flag", false)).isFalse();
  }

  @Test
  void getBooleanFallsBackOnMissingAndNull() {
    assertThat(McpParams.getBoolean(new HashMap<>(), "flag", true)).isTrue();
    assertThat(McpParams.getBoolean(params("flag", null), "flag", true)).isTrue();
  }
}
