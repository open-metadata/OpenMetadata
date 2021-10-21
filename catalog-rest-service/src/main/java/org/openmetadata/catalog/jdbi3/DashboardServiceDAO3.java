package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.services.DashboardService;

import java.util.List;

public interface DashboardServiceDAO3 extends EntityDAO<DashboardService> {
  @Override
  default String getTableName() { return "dashboard_service_entity"; }

  @Override
  default String getNameColumn() { return "name"; }

  @Override
  default Class<DashboardService> getEntityClass() { return DashboardService.class; }

  @SqlQuery("SELECT json FROM dashboard_service_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);
}
