/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under the License.
 */
package org.openmetadata.service.search.fitness;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/** Capacity-planning guidance derived from the observed data footprint and current cluster. */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SizingGuidance {
  private Long totalPrimarySizeBytes;
  private Long totalDocsCount;
  private Integer observedDataNodes;
  private Integer recommendedDataNodes;
  private Long observedHeapPerNodeBytes;
  private Long recommendedHeapPerNodeBytes;
  private Long recommendedDiskPerNodeBytes;
  private String verdict;
  private String rationale;
}
