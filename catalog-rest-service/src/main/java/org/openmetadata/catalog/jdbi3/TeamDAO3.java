package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface TeamDAO3 {
  @SqlUpdate("INSERT INTO team_entity (json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlQuery("SELECT json FROM team_entity where id = :teamId")
  String findById(@Bind("teamId") String teamId);

  @SqlQuery("SELECT json FROM team_entity where name = :name")
  String findByName(@Bind("name") String name);

  @SqlQuery("SELECT count(*) FROM team_entity")
  int listCount();

  @SqlQuery(
          "SELECT json FROM (" +
                  "SELECT name, json FROM team_entity WHERE " +
                  "name < :before " + // Pagination by team name
                  "ORDER BY name DESC " + // Pagination ordering by team name
                  "LIMIT :limit" +
                  ") last_rows_subquery ORDER BY name")
  List<String> listBefore(@Bind("limit") int limit, @Bind("before") String before);

  @SqlQuery("SELECT json FROM team_entity WHERE " +
          "name > :after " + // Pagination by team name
          "ORDER BY name " + // Pagination ordering by team name
          "LIMIT :limit")
  List<String> listAfter(@Bind("limit") int limit, @Bind("after") String after);

  @SqlUpdate("DELETE FROM team_entity WHERE id = :teamId")
  int delete(@Bind("teamId") String teamId);

  @SqlUpdate("UPDATE team_entity SET json = :json WHERE id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);
}
