package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.services.DatabaseService;

import java.util.List;

public interface DatabaseServiceDAO3 extends EntityDAO<DatabaseService> {
  @Override
  default String getTableName() { return "dbService_entity"; }

  @Override
  default Class<DatabaseService> getEntityClass() { return DatabaseService.class; }

  @Override
  @SqlQuery("SELECT json FROM <table> WHERE name = :name")
  String findByName(@Define("table") String table, @Bind("name") String name);

  // TODO clean this up
  @SqlQuery("SELECT json FROM dbService_Entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Define("table") String table, @Bind("name") String name);

  @Override
  default List<String> listAfter(String table, String parentFQN, int limit, String after) {
    return null;
  }

  @Override
  default List<String> listBefore(String table, String parentFQN, int limit, String before) {
    return null;
  }

  @Override
  default int listCount(String table, String databaseFQN) {
    return 0;
  }

  @Override
  default boolean exists(String table, String id) {
    return false;
  }

  @Override
  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);
}
