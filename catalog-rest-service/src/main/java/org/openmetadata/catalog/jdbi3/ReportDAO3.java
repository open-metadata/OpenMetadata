package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.jdbi.v3.sqlobject.statement.SqlUpdate;

import java.util.List;

public interface ReportDAO3 {
  @SqlUpdate("INSERT INTO report_entity(json) VALUES (:json)")
  void insert(@Bind("json") String json);

  @SqlUpdate("UPDATE report_entity SET  json = :json where id = :id")
  void update(@Bind("id") String id, @Bind("json") String json);

  @SqlQuery("SELECT json FROM report_entity WHERE id = :id")
  String findById(@Bind("name") String id);

  @SqlQuery("SELECT json FROM report_entity WHERE fullyQualifiedName = :name")
  String findByFQN(@Bind("name") String name);

  @SqlQuery("SELECT json FROM report_entity")
  List<String> list();

  @SqlQuery("SELECT EXISTS (SELECT * FROM report_entity where id = :id)")
  boolean exists(@Bind("id") String id);
}
