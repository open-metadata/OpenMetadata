package org.openmetadata.catalog.jdbi3;

import org.jdbi.v3.sqlobject.statement.SqlQuery;
import org.openmetadata.catalog.entity.data.Report;

import java.util.List;

public interface ReportDAO3 extends EntityDAO<Report> {
  @Override
  default String getTableName() { return "report_entity"; }

  @Override
  default Class<Report> getEntityClass() { return Report.class; }

  @Override
  default String getNameColumn() { return "fullyQualifiedName"; }

  @SqlQuery("SELECT json FROM report_entity")
  List<String> list();
}
