package org.openmetadata.catalog.airflow.models;

import lombok.Builder;
import lombok.Getter;

@Getter
@Builder
public class AirflowAuthRequest {
  String username;
  String password;
  @Builder.Default String provider = "db";
  @Builder.Default Boolean refresh = true;
}
