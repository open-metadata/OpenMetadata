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

/** Configuration for top-level DB-heavy asynchronous operations. */
@Getter
@Setter
public class AsyncOperationsConfiguration {

  /**
   * Maximum concurrently running DB-heavy asynchronous tasks. A value of {@code 0} disables the
   * bound and restores the unbounded executor behavior.
   */
  @JsonProperty
  @Min(0)
  @Max(500)
  private int maxConcurrentDbTasks = 25;
}
