package org.openmetadata.catalog.jdbi3;


import org.openmetadata.catalog.entity.services.DatabaseService;

public interface DatabaseServiceDAO3 extends EntityDAO<DatabaseService> {
  @Override
  default String getTableName() { return "dbService_Entity"; }

  @Override
  default Class<DatabaseService> getEntityClass() { return DatabaseService.class; }

  @Override
  default String getNameColumn() { return "name"; }
}
