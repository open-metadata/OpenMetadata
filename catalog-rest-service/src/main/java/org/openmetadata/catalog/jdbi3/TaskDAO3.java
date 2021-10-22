package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Table;
import org.openmetadata.catalog.entity.data.Task;
import org.skife.jdbi.v2.sqlobject.Bind;
import org.skife.jdbi.v2.sqlobject.SqlQuery;
import org.skife.jdbi.v2.sqlobject.SqlUpdate;

import java.util.List;

public interface TaskDAO3 extends EntityDAO<Task>{
  @Override
  default String getTableName() { return "task_entity"; }

  @Override
  default Class<Task> getEntityClass() { return Task.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
