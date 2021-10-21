package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface PipelineServiceDAO {
  @SqlUpdate("INSERT INTO pipeline_service_entity (json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE pipeline_service_entity SET  json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM pipeline_service_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM pipeline_service_entity WHERE name = :name")
  String findByName(@Bind("name") String name);

  @SqlQuery("SELECT json FROM pipeline_service_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);

  @SqlUpdate("DELETE FROM pipeline_service_entity WHERE id = :id")
  int delete(@Bind("id") String id);
}
