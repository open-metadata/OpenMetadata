package org.openmetadata.catalog.jdbi3;


import org.openmetadata.catalog.entity.data.Table;

public interface TableDAO3 extends EntityDAO<Table> {
  @Override
  default String getTableName() {
    return "table_entity";
  }

  @Override
  default Class<Table> getEntityClass() { return Table.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
