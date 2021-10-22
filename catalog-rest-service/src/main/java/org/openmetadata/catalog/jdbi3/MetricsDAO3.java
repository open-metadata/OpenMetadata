package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.data.Metrics;

import java.util.List;

public interface MetricsDAO3 extends EntityDAO<Metrics> {
  @Override
  default String getTableName() { return "metrics_entity"; }

  @Override
  default Class<Metrics> getEntityClass() { return Metrics.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }

  @SqlQuery("SELECT json FROM metric_entity")
  List<String> list();
}
