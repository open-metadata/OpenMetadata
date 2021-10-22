package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.teams.Team;

import java.util.List;

public interface TeamDAO3 extends EntityDAO<Team> {
  @Override
  default String getTableName() { return "team_entity"; }

  @Override
  default Class<Team> getEntityClass() { return Team.class; }

  @Override
  default String getNameColumn() { return "name"; }

  @Override
  @SqlQuery("SELECT count(*) FROM <table>")
  int listCount(@Define("table") String table);

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
}
