package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface PipelineServiceDAO3 {
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
