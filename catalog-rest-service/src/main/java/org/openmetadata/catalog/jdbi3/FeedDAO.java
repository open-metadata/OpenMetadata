package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface FeedDAO {
  @SqlUpdate("INSERT INTO thread_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlQuery("SELECT json FROM thread_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM thread_entity")
  List<String> list();

  @SqlUpdate("UPDATE thread_entity SET json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);
}
