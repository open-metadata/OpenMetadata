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

package org.openmetadata.service.util;

import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * Reads a stored event payload without letting one unreadable row fail the whole page. The alert
 * diagnostics endpoints report on rows that were written by earlier versions, so a payload can name
 * an {@code EventType} this build no longer declares; the generated enum's {@code @JsonCreator}
 * throws on it and {@link JsonUtils#readValue} surfaces that as a 500. Delivery and audit consumers
 * already skip such a row, and these readers do the same.
 */
@Slf4j
public final class ChangeEventJsonUtils {
  private static final int MAX_LOGGED_JSON_LENGTH = 500;

  private ChangeEventJsonUtils() {}

  /** Returns null instead of throwing when the payload cannot be deserialized. */
  public static <T> T readOrNull(String json, Class<T> clz) {
    T value = null;
    try {
      value = JsonUtils.readValue(json, clz);
    } catch (JsonParsingException ex) {
      LOG.warn(
          "Skipping unreadable {} payload: {}. Event data [truncated to {} chars]: {}",
          clz.getSimpleName(),
          ex.getMessage(),
          MAX_LOGGED_JSON_LENGTH,
          truncateForLogging(json));
    }
    return value;
  }

  private static String truncateForLogging(String json) {
    String truncated = json;
    if (json != null && json.length() > MAX_LOGGED_JSON_LENGTH) {
      truncated = json.substring(0, MAX_LOGGED_JSON_LENGTH) + "...";
    }
    return truncated;
  }
}
