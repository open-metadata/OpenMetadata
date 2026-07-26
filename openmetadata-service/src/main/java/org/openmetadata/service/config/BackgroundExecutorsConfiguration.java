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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

/** Concurrency limits for background work that can borrow database connections. */
@Getter
@Setter
public class BackgroundExecutorsConfiguration {

  @JsonProperty
  @Min(1)
  @Max(100)
  private int changeEventParallelism = 20;

  /** Number of ordered lifecycle lanes. A value of {@code 0} selects the CPU-based default. */
  @JsonProperty
  @Min(0)
  @Max(32)
  private int lifecycleLanes = 0;

  @JsonProperty
  @Min(1)
  @Max(100)
  private int userActivityDbPermits = 10;

  @JsonProperty
  @Min(1)
  @Max(100)
  private int backgroundJobWorkers = 3;
}
