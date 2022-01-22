package org.openmetadata.catalog.airflow.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.Map;
import lombok.Builder;
import lombok.Getter;

@Builder
@Getter
public class IngestionTaskConfig {
  @Builder.Default
  @JsonProperty("python_callable_name")
  String pythonCallableName = "metadata_ingestion_workflow";

  @Builder.Default
  @JsonProperty("python_callable_file")
  String pythonCallableFile = "metadata_ingestion.py";

  @JsonProperty("op_kwargs")
  Map<String, Object> opKwargs;
}
