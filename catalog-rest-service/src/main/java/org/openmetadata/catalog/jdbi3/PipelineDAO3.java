package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface PipelineDAO3 {
  @SqlUpdate("INSERT INTO pipeline_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE pipeline_entity SET  json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM pipeline_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM pipeline_entity WHERE fullyQualifiedName = :name")
  String findByFQN(@Bind("name") String name);

  @SqlQuery("SELECT count(*) FROM pipeline_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL)")
  int listCount(@Bind("fqnPrefix") String fqnPrefix);

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM pipeline_entity WHERE " +
                  "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +// Filter by
                  // service name
                  "fullyQualifiedName < :before " + // Pagination by pipeline fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by  fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM pipeline_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:fqnPrefix, '.%') OR :fqnPrefix IS NULL) AND " +
          "fullyQualifiedName > :after " +
          "ORDER BY fullyQualifiedName " +
          "LIMIT :limit")
  List<String> listAfter(@Bind("fqnPrefix") String fqnPrefix, @Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlUpdate("DELETE FROM pipeline_entity WHERE id = :id")
  int delete(@Bind("id") String id);
}
