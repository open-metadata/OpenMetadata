package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.teams.Team;

import java.util.List;

public interface TeamDAO3 extends EntityDAO<Team> {
  @Override
  default String getTableName() { return "team_entity"; }

  @Override
  default Class<Team> getEntityClass() { return Team.class; }

  @Override
  default String getNameColumn() { return "name"; }
}
