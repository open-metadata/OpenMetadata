package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface FeedDAO3 {
  @SqlUpdate("INSERT INTO thread_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM thread_entity")
  List<String> list();

  @SqlUpdate("UPDATE thread_entity SET json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);
}
