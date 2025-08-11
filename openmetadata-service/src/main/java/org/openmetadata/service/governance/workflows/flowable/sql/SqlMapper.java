package org.openmetadata.service.governance.workflows.flowable.sql;

import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Update;

public interface SqlMapper {
  @Update(
      "UPDATE ACT_RU_EXECUTION SET LOCK_OWNER_ = NULL, LOCK_TIME_ = NULL WHERE ID_ = #{executionId}")
  void unlockExecution(@Param("executionId") String executionId);

  @Update("UPDATE ACT_RU_JOB SET LOCK_OWNER_ = NULL, LOCK_EXP_TIME_ = NULL WHERE ID_ = #{jobId}")
  void unlockJob(@Param("jobId") String jobId);
}
