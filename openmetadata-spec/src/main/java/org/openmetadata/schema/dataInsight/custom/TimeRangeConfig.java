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
package org.openmetadata.schema.dataInsight.custom;

import com.fasterxml.jackson.annotation.JsonSubTypes;
import com.fasterxml.jackson.annotation.JsonTypeInfo;

/**
 * A Data Insight chart's time-range intent. Pure data carrier discriminated by the {@code type}
 * field; resolution into a concrete (startMillis, endMillis, live) window lives in the service layer
 * (TimeRangeConfigResolver). Record compact constructors enforce the schema invariants so a payload
 * that bypassed schema validation fails fast at deserialization.
 */
@JsonTypeInfo(use = JsonTypeInfo.Id.NAME, include = JsonTypeInfo.As.PROPERTY, property = "type")
@JsonSubTypes({
  @JsonSubTypes.Type(value = TimeRangeConfig.LiveSnapshot.class, name = "LiveSnapshot"),
  @JsonSubTypes.Type(value = TimeRangeConfig.RollingWindow.class, name = "RollingWindow"),
  @JsonSubTypes.Type(value = TimeRangeConfig.CompletedPeriod.class, name = "CompletedPeriod"),
  @JsonSubTypes.Type(value = TimeRangeConfig.FixedWindow.class, name = "FixedWindow"),
})
public sealed interface TimeRangeConfig {

  /** Calendar unit for {@link RollingWindow} and {@link CompletedPeriod}. */
  enum CalendarUnit {
    day,
    week,
    month,
    quarter,
    year
  }

  /** Current state. The resolver yields {@code live=true}; start/end are ignored downstream. */
  record LiveSnapshot() implements TimeRangeConfig {}

  /** Sliding trailing window that moves on every refresh. Schema constraint: value >= 1. */
  record RollingWindow(int value, CalendarUnit unit) implements TimeRangeConfig {
    public RollingWindow {
      if (value < 1) {
        throw new IllegalArgumentException("RollingWindow value must be >= 1, got " + value);
      }
      if (unit == null) {
        throw new IllegalArgumentException("RollingWindow unit is required");
      }
    }
  }

  /** Last {@code value} complete calendar periods, aligned to UTC boundaries. Constraint: value >= 1. */
  record CompletedPeriod(int value, CalendarUnit unit) implements TimeRangeConfig {
    public CompletedPeriod {
      if (value < 1) {
        throw new IllegalArgumentException("CompletedPeriod value must be >= 1, got " + value);
      }
      if (unit == null) {
        throw new IllegalArgumentException("CompletedPeriod unit is required");
      }
    }
  }

  /** Frozen absolute range in epoch milliseconds (UTC). Constraint: endTimestamp > startTimestamp. */
  record FixedWindow(long startTimestamp, long endTimestamp) implements TimeRangeConfig {
    public FixedWindow {
      if (endTimestamp <= startTimestamp) {
        throw new IllegalArgumentException(
            "FixedWindow endTimestamp ("
                + endTimestamp
                + ") must be greater than startTimestamp ("
                + startTimestamp
                + ")");
      }
    }
  }
}
