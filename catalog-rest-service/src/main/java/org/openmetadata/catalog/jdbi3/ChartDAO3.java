package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Chart;

public interface ChartDAO3 extends EntityDAO<Chart>{
  @Override
  default String getTableName() { return "chart_entity"; }

  @Override
  default Class<Chart> getEntityClass() { return Chart.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
