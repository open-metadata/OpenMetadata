package org.openmetadata.service.apps.bundles.insights.stats;

import java.util.List;
import java.util.Map;
import org.openmetadata.schema.system.IndexingError;
import org.openmetadata.schema.system.StepStats;

public record WorkflowResult(
    String workflowName,
    Map<String, StepStats> stepStats,
    List<IndexingError> failures,
    boolean failed) {}
