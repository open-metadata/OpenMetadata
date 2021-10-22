package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.teams.User;

import java.util.List;

public interface UserDAO3 extends EntityDAO<User> {
  @Override
  default String getTableName() { return "user_entity"; }

  @Override
  default Class<User> getEntityClass() { return User.class; }

  @Override
  default String getNameColumn() { return "name"; }

  @SqlQuery("SELECT json FROM user_entity")
  List<String> list();

  @SqlQuery("SELECT json FROM user_entity WHERE email = :email")
  String findByEmail(@Bind("email") String email);

  @Override
  @SqlQuery("SELECT count(*) FROM <table>")
  int listCount(@Define("table") String table);

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

  @SqlQuery("SELECT count(*) FROM user_entity")
  int listCount();

}
