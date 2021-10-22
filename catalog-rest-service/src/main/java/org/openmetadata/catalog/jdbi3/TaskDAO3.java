package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Task;

public interface TaskDAO3 extends EntityDAO<Task>{
  @Override
  default String getTableName() { return "task_entity"; }

  @Override
  default Class<Task> getEntityClass() { return Task.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
