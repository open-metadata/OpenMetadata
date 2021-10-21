package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.entity.data.Database;

import java.util.List;

public interface DatabaseDAO3 extends EntityDAO<Database> {
  @Override
  default String getTableName() { return "database_entity"; }

  @Override
  default Class<Database> getEntityClass() {
    return Database.class;
  }

  @Override
  @SqlQuery("SELECT json FROM <table> WHERE fullyQualifiedName = :name")
  String findByName(@Define("table") String table, @Bind("name") String name);

  @Override
  @SqlQuery("SELECT count(*) FROM <table> WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
  int listCount(@Define("table") String table, @Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM <table> WHERE " +
                  "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by service name
                  "fullyQualifiedName < :before " + // Pagination by database fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by database fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Define("table") String table, @Bind("fqnPrefix") String parentFQN, @Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM <table> WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
          "fullyQualifiedName > :after " +
          "ORDER BY fullyQualifiedName " +
          "LIMIT :limit")
  List<String> listAfter(@Define("table") String table, @Bind("fqnPrefix") String parentFQN, @Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlQuery("SELECT EXISTS (SELECT * FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);
}
