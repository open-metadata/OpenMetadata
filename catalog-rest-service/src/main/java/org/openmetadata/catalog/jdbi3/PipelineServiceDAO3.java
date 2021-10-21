package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.customizer.Bind;
import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.services.PipelineService;

import java.util.List;

public interface PipelineServiceDAO3 extends EntityDAO<PipelineService> {
  @Override
  default String getTableName() { return "pipeline_service_entity"; }

  @Override
  default Class<PipelineService> getEntityClass() { return PipelineService.class; }

  @Override
  default String getNameColumn() { return "name"; }

  @SqlQuery("SELECT json FROM pipeline_service_entity WHERE (name = :name OR :name is NULL)")
  List<String> list(@Bind("name") String name);
}
