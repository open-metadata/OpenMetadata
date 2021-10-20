package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface TableDAO3 extends EntityDAO {
  @Override
  default String getTableName() {
    return "table_entity";
  }

  @Override
  @SqlQuery("SELECT json FROM <table> WHERE fullyQualifiedName = :tableFQN")
  String findByFqn(@Define("table") String table, @Bind("tableFQN") String tableFQN);

  @Override
  @SqlQuery("SELECT count(*) FROM <table> WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL)")
  int listCount(@Define("table") String table, @Bind("databaseFQN") String databaseFQN);

  @Override
  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM <table> WHERE " +
                  "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND " +
                  "fullyQualifiedName < :before " + // Pagination by table fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by table fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Define("table") String table, @Bind("databaseFQN") String databaseFQN, @Bind("limit") int limit,
                          @Bind("before") String before);

  @Override
  @SqlQuery("SELECT json FROM <table> WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND "+//Filter by databaseName
          "fullyQualifiedName > :after " + // Pagination by table fullyQualifiedName
          "ORDER BY fullyQualifiedName " + // Pagination ordering by table fullyQualifiedName
          "LIMIT :limit")
  List<String> listAfter(@Define("table") String table, @Bind("databaseFQN") String databaseFQN, @Bind("limit") int limit,
                         @Bind("after") String after);

  @Override
  @SqlQuery("SELECT EXISTS (SELECT * FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  @Override
  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);
}
