package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.List;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Report generated after importing an ODCS contract
 */
@Data
@NoArgsConstructor
public class ODCSImportReport {

  @JsonProperty("mappedFields")
  private List<String> mappedFields = new ArrayList<>();

  @JsonProperty("skippedFields")
  private List<String> skippedFields = new ArrayList<>();

  @JsonProperty("warnings")
  private List<String> warnings = new ArrayList<>();

  @JsonProperty("errors")
  private List<String> errors = new ArrayList<>();

  @JsonProperty("odcsVersion")
  private String odcsVersion;

  @JsonProperty("contractId")
  private String contractId;

  @JsonProperty("contractName")
  private String contractName;

  public void addMappedField(String field) {
    mappedFields.add(field);
  }

  public void addSkippedField(String field) {
    skippedFields.add(field);
  }

  public void addWarning(String warning) {
    warnings.add(warning);
  }

  public void addError(String error) {
    errors.add(error);
  }

  public boolean hasErrors() {
    return !errors.isEmpty();
  }
}
