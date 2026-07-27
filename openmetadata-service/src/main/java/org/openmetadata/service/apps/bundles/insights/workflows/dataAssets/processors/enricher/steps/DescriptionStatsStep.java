/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import java.util.Map;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.search.SearchIndexUtils;

/**
 * Emits the description-coverage stats: {@code hasDescription} (0/1), and — for entities that
 * carry a {@code columns} array — {@code numberOfColumns}, {@code numberOfColumnsWithDescription},
 * and {@code hasColumnDescription} (1 iff every column has a non-empty description, 0 otherwise;
 * empty column lists count as covered).
 */
public final class DescriptionStatsStep implements EnrichmentStep {

  public static final String NAME = "descriptionStats";

  @Override
  public String name() {
    return NAME;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    EntityInterface entity = target.entity();
    Map<String, Object> entityMap = target.entityMap();
    entityMap.put("hasDescription", CommonUtil.nullOrEmpty(entity.getDescription()) ? 0 : 1);
    if (!SearchIndexUtils.hasColumns(entity)) {
      return;
    }
    ColumnsEntityInterface columnsEntity = (ColumnsEntityInterface) entity;
    int totalColumns = columnsEntity.getColumns().size();
    int columnsWithDescription =
        columnsEntity.getColumns().stream()
            .map(column -> CommonUtil.nullOrEmpty(column.getDescription()) ? 0 : 1)
            .reduce(0, Integer::sum);
    entityMap.put("numberOfColumns", totalColumns);
    entityMap.put("numberOfColumnsWithDescription", columnsWithDescription);
    entityMap.put("hasColumnDescription", columnsWithDescription == totalColumns ? 1 : 0);
  }
}
