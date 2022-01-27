package org.openmetadata.catalog.airflow.models;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Builder;
import lombok.Getter;

@Builder
@Getter
public class OpenMetadataIngestionConfig {
  OpenMetadataIngestionComponent source;
  OpenMetadataIngestionComponent sink;

  @JsonProperty("metadata_server")
  OpenMetadataIngestionComponent metadataServer;
}
