package org.openmetadata.service.governance.workflows.flowable.sql;

import org.flowable.common.engine.impl.cmd.CustomSqlExecution;

public class UnlockExecutionSql implements CustomSqlExecution<SqlMapper, Void> {

  private final String executionId;

  public UnlockExecutionSql(String executionId) {
    this.executionId = executionId;
  }

  @Override
  public Class<SqlMapper> getMapperClass() {
    return SqlMapper.class;
  }

  @Override
  public Void execute(SqlMapper mapper) {
    mapper.unlockExecution(executionId);
    return null;
  }
}
