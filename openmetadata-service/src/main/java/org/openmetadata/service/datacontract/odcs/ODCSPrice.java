package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Price model for data pricing information
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSPrice {

  @JsonProperty("priceAmount")
  private Double priceAmount;

  @JsonProperty("priceCurrency")
  private String priceCurrency;

  @JsonProperty("priceUnit")
  private String priceUnit;
}
