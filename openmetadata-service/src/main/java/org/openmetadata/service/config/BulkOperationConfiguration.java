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
package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import lombok.Getter;
import lombok.Setter;

/** Configuration for bulk operations with bounded thread pool and admission control. */
@Getter
@Setter
public class BulkOperationConfiguration {

  /** Max threads for processing. Default: 10 */
  @JsonProperty
  @Min(1)
  @Max(100)
  private int maxThreads = 10;

  /** Max queued operations. When full, returns 503. Default: 1000 */
  @JsonProperty
  @Min(100)
  @Max(10000)
  private int queueSize = 1000;

  /** Timeout in seconds. Returns partial results if exceeded. Default: 300 */
  @JsonProperty
  @Min(30)
  @Max(3600)
  private int timeoutSeconds = 300;
}
