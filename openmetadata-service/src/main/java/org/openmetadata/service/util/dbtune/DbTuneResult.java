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
package org.openmetadata.service.util.dbtune;

import java.util.List;

public record DbTuneResult(
    String engine,
    String engineVersion,
    List<ServerParamCheck> serverParams,
    List<TableRecommendation> tableRecommendations) {

  public DbTuneResult {
    serverParams = serverParams == null ? List.of() : List.copyOf(serverParams);
    tableRecommendations =
        tableRecommendations == null ? List.of() : List.copyOf(tableRecommendations);
  }

  public List<TableRecommendation> actionableRecommendations() {
    return tableRecommendations.stream().filter(r -> r.action().isActionable()).toList();
  }
}
