package org.openmetadata.service.governance.workflows.flowable.sql;

import org.flowable.common.engine.impl.cmd.CustomSqlExecution;

public class UnlockJobSql implements CustomSqlExecution<SqlMapper, Void> {

  private final String executionId;

  public UnlockJobSql(String executionId) {
    this.executionId = executionId;
  }

  @Override
  public Class<SqlMapper> getMapperClass() {
    return SqlMapper.class;
  }

  @Override
  public Void execute(SqlMapper mapper) {
    mapper.unlockJob(executionId);
    return null;
  }
}
