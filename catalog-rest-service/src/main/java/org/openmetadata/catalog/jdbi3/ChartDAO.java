package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface ChartDAO {
  @SqlUpdate("INSERT INTO chart_entity (json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE chart_entity SET  json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM chart_entity WHERE fullyQualifiedName = :name")
  String findByFQN(@Bind("name") String name);

  @SqlQuery("SELECT json FROM chart_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT count(*) FROM chart_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
  int listCount(@Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM chart_entity WHERE " +
                  "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                  // service name
                  "fullyQualifiedName < :before " + // Pagination by chart fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by chart fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM chart_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
          "fullyQualifiedName > :after " +
          "ORDER BY fullyQualifiedName " +
          "LIMIT :limit")
  List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlQuery("SELECT EXISTS (SELECT * FROM chart_entity WHERE id = :id)")
  boolean exists(@Bind("id") String id);

  @SqlUpdate("DELETE FROM chart_entity WHERE id = :id")
  int delete(@Bind("id") String id);
}
