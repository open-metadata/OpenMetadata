package org.openmetadata.service.util;

import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import org.openmetadata.schema.type.csv.CsvImportResult;

@NoArgsConstructor
public class CSVImportMessage {
  @Getter @Setter private String jobId;
  @Getter @Setter private String status;
  @Getter @Setter private CsvImportResult result;
  @Getter @Setter private String error;

  public CSVImportMessage(String jobId, String status, CsvImportResult result, String error) {
    this.jobId = jobId;
    this.status = status;
    this.result = result;
    this.error = error;
  }
}
