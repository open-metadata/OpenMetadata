package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface UserDAO {
  @SqlUpdate("INSERT INTO user_entity (json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlQuery("SELECT json FROM user_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM user_entity WHERE name = :name")
  String findByName(@Bind("name") String name);

  @SqlQuery("SELECT json FROM user_entity WHERE email = :email")
  String findByEmail(@Bind("email") String email);

  @SqlQuery("SELECT json FROM user_entity")
  List<String> list();

  @SqlQuery("SELECT count(*) FROM user_entity")
  int listCount();

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT name, json FROM user_entity WHERE " +
                  "name < :before " + // Pagination by user name
                  "ORDER BY name DESC " + // Pagination ordering by user name
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY name")
  List<String> listBefore(@Bind("limit") int limit, @Bind("before") String before);

  @SqlQuery("SELECT json FROM user_entity WHERE " +
          "name > :after " + // Pagination by user name
          "ORDER BY name " + // Pagination ordering by user name
          "LIMIT :limit")
  List<String> listAfter(@Bind("limit") int limit, @Bind("after") String after);

  @SqlUpdate("UPDATE user_entity SET json = :json WHERE id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT EXISTS (SELECT * FROM user_entity where id = :id)")
  boolean exists(@Bind("id") String id);
}
