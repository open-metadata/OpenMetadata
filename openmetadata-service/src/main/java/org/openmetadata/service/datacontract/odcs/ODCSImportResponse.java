package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import org.openmetadata.schema.entity.data.DataContract;

/**
 * Response returned after importing an ODCS contract
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class ODCSImportResponse {
  
  @JsonProperty("contract")
  private DataContract contract;
  
  @JsonProperty("importReport")
  private ODCSImportReport importReport;
}