package org.openmetadata.catalog.jdbi3;

import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface ReportDAO {
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
