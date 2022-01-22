package org.openmetadata.catalog.airflow.models;

import lombok.Getter;

@Getter
public class AirflowDagRun {
  String state;
  String startDate;
  String endDate;
}
