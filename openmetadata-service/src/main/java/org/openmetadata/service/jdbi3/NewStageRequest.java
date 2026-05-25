package org.openmetadata.service.jdbi3;

import java.util.List;
import java.util.UUID;

public record NewStageRequest(
    String workflowInstanceStage,
    UUID workflowInstanceExecutionId,
    UUID workflowInstanceId,
    String workflowDefinitionName,
    Long startedAt,
    UUID scheduleRunId,
    List<String> entityList) {}
