package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.Bots;

import java.util.List;

public interface BotsDAO3 extends EntityDAO<Bots>{
  @Override
  default String getTableName() { return "bots_entity"; }

  @Override
  default Class<Bots> getEntityClass() { return Bots.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }

  @SqlQuery("SELECT json FROM bot_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);
}
