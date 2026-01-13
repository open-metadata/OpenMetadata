package org.openmetadata.service.jdbi3;

import java.sql.ResultSet;
import java.sql.SQLException;
import org.jdbi.v3.core.mapper.RowMapper;
import org.jdbi.v3.core.statement.StatementContext;

public class IndexMappingVersionMapper
    implements RowMapper<IndexMappingVersionDAO.IndexMappingVersion> {
  @Override
  public IndexMappingVersionDAO.IndexMappingVersion map(ResultSet rs, StatementContext ctx)
      throws SQLException {
    return new IndexMappingVersionDAO.IndexMappingVersion(
        rs.getString("entityType"), rs.getString("mappingHash"));
  }
}
