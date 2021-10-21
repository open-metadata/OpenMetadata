package org.openmetadata.catalog.jdbi3;

import org.openmetadata.catalog.entity.data.Pipeline;

public interface PipelineDAO3 extends EntityDAO<Pipeline> {
  @Override
  default String getTableName() { return "pipeline_entity"; }

  @Override
  default Class<Pipeline> getEntityClass() { return Pipeline.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }
}
