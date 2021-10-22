package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface MetricsDAO {
  @SqlUpdate("INSERT INTO metric_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE metrics_entity SET  json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM metric_entity WHERE id = :id")
  String findById(@Bind("id") String id);

  @SqlQuery("SELECT json FROM metric_entity WHERE fullyQualifiedName = :name")
  String findByFQN(@Bind("name") String name);

  @SqlQuery("SELECT json FROM metric_entity")
  List<String> list();

  @SqlQuery("SELECT EXISTS (SELECT * FROM metric_entity where id = :id)")
  boolean exists(@Bind("id") String id);
}
