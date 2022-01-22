package org.openmetadata.catalog.airflow.models;

import java.util.Map;
import lombok.Builder;
import lombok.Getter;
import lombok.Setter;

@Builder
@Getter
@Setter
public class OpenMetadataIngestionComponent {
  String type;
  Map<String, Object> config;
}
