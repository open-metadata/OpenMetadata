package org.openmetadata.catalog.airflow.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import lombok.Getter;

@Getter
public class AirflowListResponse {
  @JsonProperty("status")
  String status;

  @JsonProperty("next_run")
  String nextRun;

  @JsonProperty("dag_runs")
  List<AirflowDagRun> dagRuns;
}
