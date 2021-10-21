package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;
import org.openmetadata.catalog.entity.data.Chart;
import org.openmetadata.catalog.entity.data.Table;

import java.util.List;

public interface ChartDAO3 extends EntityDAO<Chart>{
  @Override
  default String getTableName() { return "chart_entity"; }

  @Override
  default Class<Chart> getEntityClass() { return Chart.class; }

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
                  "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                  // service name
                  "fullyQualifiedName < :before " + // Pagination by chart fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by chart fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Define("table") String table, @Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                          @Bind("before") String before);

  @Override
  @SqlQuery("SELECT json FROM <table> WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
          "fullyQualifiedName > :after " +
          "ORDER BY fullyQualifiedName " +
          "LIMIT :limit")
  List<String> listAfter(@Define("table") String table, @Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                         @Bind("after") String after);

  @Override
  @SqlQuery("SELECT EXISTS (SELECT * FROM <table> WHERE id = :id)")
  boolean exists(@Define("table") String table, @Bind("id") String id);

  @Override
  @SqlUpdate("DELETE FROM <table> WHERE id = :id")
  int delete(@Define("table") String table, @Bind("id") String id);
}
