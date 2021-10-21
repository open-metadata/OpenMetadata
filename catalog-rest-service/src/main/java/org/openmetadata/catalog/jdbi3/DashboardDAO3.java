package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Dashboard;

public interface DashboardDAO3 extends EntityDAO<Dashboard> {
  @Override
  default String getTableName() { return "dashboard_entity"; }

  @Override
  default Class<Dashboard> getEntityClass() { return Dashboard.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
