package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Database;

public interface DatabaseDAO3 extends EntityDAO<Database> {
  @Override
  default String getTableName() { return "database_entity"; }

  @Override
  default Class<Database> getEntityClass() {
    return Database.class;
  }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
