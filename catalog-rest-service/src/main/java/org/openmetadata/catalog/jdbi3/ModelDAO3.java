package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface ModelDAO3 {
  @SqlUpdate("INSERT INTO model_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE model_entity SET json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM model_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM model_entity WHERE fullyQualifiedName = :name")
  String findByFQN(@Bind("name") String name);

  @SqlQuery("SELECT count(*) FROM model_entity")
  int listCount();

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM model_entity WHERE " +
                  "fullyQualifiedName < :before " + // Pagination by model fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " +
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM model_entity WHERE " +
          "fullyQualifiedName > :after " +
          "ORDER BY fullyQualifiedName " +
          "LIMIT :limit")
  List<String> listAfter(@Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlUpdate("DELETE FROM model_entity WHERE id = :id")
  int delete(@Bind("id") String id);
}
