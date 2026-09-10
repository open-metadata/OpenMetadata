package org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.steps;

import java.util.List;
import org.openmetadata.schema.ColumnsEntityInterface;
import org.openmetadata.schema.type.Column;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.ColumnCoverage;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;

/** Uses the versioned entity, whose children are intact, before the bounded projection is indexed. */
public final class RecursiveColumnStatsStep implements EnrichmentStep {
  @Override
  public String name() {
    return ColumnCoverage.FIELD;
  }

  @Override
  public void apply(EnrichmentTarget target) {
    var columns =
        target.entity() instanceof ColumnsEntityInterface entity
            ? entity.getColumns()
            : List.<Column>of();
    target.entityMap().put(ColumnCoverage.FIELD, ColumnCoverage.from(columns));
  }
}
