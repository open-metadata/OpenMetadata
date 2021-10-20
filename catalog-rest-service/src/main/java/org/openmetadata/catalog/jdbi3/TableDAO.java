package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface TableDAO {
  @SqlUpdate("INSERT INTO table_entity (json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE table_entity SET  json = :json WHERE id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM table_entity WHERE id = :tableId")
  String findById(@Bind("tableId") String tableId);

  @SqlQuery("SELECT json FROM table_entity WHERE fullyQualifiedName = :tableFQN")
  String findByFqn(@Bind("tableFQN") String tableFQN);

  @SqlQuery("SELECT count(*) FROM table_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL)")
  int listCount(@Bind("databaseFQN") String databaseFQN);

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT fullyQualifiedName, json FROM table_entity WHERE " +
                  "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND " +
                  "fullyQualifiedName < :before " + // Pagination by table fullyQualifiedName
                  "ORDER BY fullyQualifiedName DESC " + // Pagination ordering by table fullyQualifiedName
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY fullyQualifiedName")
  List<String> listBefore(@Bind("databaseFQN") String databaseFQN, @Bind("limit") int limit,
                          @Bind("before") String before);

  @SqlQuery("SELECT json FROM table_entity WHERE " +
          "(fullyQualifiedName LIKE CONCAT(:databaseFQN, '.%') OR :databaseFQN IS NULL) AND "+//Filter by databaseName
          "fullyQualifiedName > :after " + // Pagination by table fullyQualifiedName
          "ORDER BY fullyQualifiedName " + // Pagination ordering by table fullyQualifiedName
          "LIMIT :limit")
  List<String> listAfter(@Bind("databaseFQN") String databaseFQN, @Bind("limit") int limit,
                         @Bind("after") String after);

  @SqlQuery("SELECT EXISTS (SELECT * FROM table_entity WHERE id = :id)")
  boolean exists(@Bind("id") String id);

  @SqlUpdate("DELETE FROM table_entity WHERE id = :id")
  int delete(@Bind("id") String id);
}
