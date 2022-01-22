package org.openmetadata.catalog.airflow.models;

import java.util.List;
import lombok.Builder;
import lombok.Getter;

@Builder
@Getter
public class IngestionAirflowPipeline {
  String name;
  @Builder.Default Boolean forceDeploy = true;
  @Builder.Default Boolean pauseWorkflow = false;
  String description;
  @Builder.Default Integer concurrency = 1;
  @Builder.Default Integer maxActiveRuns = 1;
  @Builder.Default Integer workflowTimeout = 60;
  @Builder.Default String workflowDefaultView = "tree";
  @Builder.Default String orientation = "LR";
  String owner;
  String startDate;
  @Builder.Default Integer retries = 3;
  @Builder.Default Integer retryDelay = 300;
  String scheduleInterval;
  List<OpenMetadataIngestionTask> tasks;
}
