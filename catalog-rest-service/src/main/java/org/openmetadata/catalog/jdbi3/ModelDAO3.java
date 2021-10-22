package org.openmetadata.catalog.jdbi3;


import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.customizer.Define;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.data.Model;

import java.util.List;

public interface ModelDAO3 extends EntityDAO<Model>{
  @Override
  default String getTableName() { return "model_entity"; }

  @Override
  default Class<Model> getEntityClass() { return Model.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
