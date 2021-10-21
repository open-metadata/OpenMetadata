package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface BotsDAO {
  @SqlUpdate("INSERT INTO bot_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlQuery("SELECT json FROM bot_entity WHERE name = :name")
  String findByName(@Bind("name") String name);

  @SqlQuery("SELECT json FROM bot_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);
}
