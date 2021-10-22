package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Metrics;
import org.openmetadata.catalog.entity.data.Table;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

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
