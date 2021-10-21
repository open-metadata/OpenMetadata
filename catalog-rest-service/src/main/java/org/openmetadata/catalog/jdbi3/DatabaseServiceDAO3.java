package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.services.DatabaseService;

import java.util.List;

public interface DatabaseServiceDAO3 extends EntityDAO<DatabaseService> {
  @Override
  default String getTableName() { return "dbService_Entity"; }

  @Override
  default Class<DatabaseService> getEntityClass() { return DatabaseService.class; }

  @Override
  default String getNameColumn() { return "name"; }

  // TODO clean this up
  @SqlQuery("SELECT json FROM dbService_Entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Define("table") String table, @Bind("name") String name);
}
