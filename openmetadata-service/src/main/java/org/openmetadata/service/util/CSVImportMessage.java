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
  @Getter @Setter private Integer progress;
  @Getter @Setter private Integer total;
  @Getter @Setter private String message;

  public CSVImportMessage(String jobId, String status, CsvImportResult result, String error) {
    this.jobId = jobId;
    this.status = status;
    this.result = result;
    this.error = error;
  }

  public CSVImportMessage(
      String jobId,
      String status,
      CsvImportResult result,
      String error,
      Integer progress,
      Integer total,
      String message) {
    this.jobId = jobId;
    this.status = status;
    this.result = result;
    this.error = error;
    this.progress = progress;
    this.total = total;
    this.message = message;
  }
}
