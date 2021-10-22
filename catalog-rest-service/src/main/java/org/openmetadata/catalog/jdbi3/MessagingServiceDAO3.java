package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.services.MessagingService;

import java.util.List;

public interface MessagingServiceDAO3 extends EntityDAO<MessagingService> {
  @Override
  default String getTableName() { return "messaging_service_entity"; }

  @Override
  default Class<MessagingService> getEntityClass() { return MessagingService.class; }

  @Override
  default String getNameColumn() { return "name"; }

  @SqlQuery("SELECT json FROM messaging_service_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);
}
