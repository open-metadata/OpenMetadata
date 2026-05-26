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
import java.util.List;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Top-level fitness report describing whether the current ES/OS cluster is sized appropriately for
 * the data OpenMetadata is storing in it.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class SearchClusterFitnessReport {
  private FitnessVerdict overallVerdict;
  private String summary;
  private Long generatedAtMillis;

  private String searchDistribution;
  private String searchVersion;
  private String clusterStatus;
  private String clusterName;
  private Integer totalNodes;
  private Integer dataNodes;
  private Long totalPrimarySizeBytes;
  private Long totalDocsCount;
  private Integer totalIndices;
  private Integer totalShards;

  private Integer clusterIndicesCount;

  private List<FitnessSignal> signals;
  private List<IndexFootprint> indices;
  private List<IndexFootprint> otherIndicesOnCluster;
  private List<NodeFootprint> nodes;
  private SizingGuidance sizingGuidance;
  private List<String> inaccessibleMetrics;
}
