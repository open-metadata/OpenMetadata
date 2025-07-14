package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS Description model containing purpose, limitations, and usage information
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSDescription {
  
  @JsonProperty("purpose")
  private String purpose;
  
  @JsonProperty("limitations")
  private String limitations;
  
  @JsonProperty("usage")
  private String usage;
  
  @JsonProperty("authoritativeDefinitions")
  private List<Map<String, String>> authoritativeDefinitions;
  
  /**
   * Combine all description fields into a single markdown string for OpenMetadata
   */
  public String toMarkdown() {
    StringBuilder sb = new StringBuilder();
    
    if (purpose != null && !purpose.isEmpty()) {
      sb.append("## Purpose\n").append(purpose).append("\n\n");
    }
    
    if (limitations != null && !limitations.isEmpty()) {
      sb.append("## Limitations\n").append(limitations).append("\n\n");
    }
    
    if (usage != null && !usage.isEmpty()) {
      sb.append("## Usage\n").append(usage).append("\n\n");
    }
    
    if (authoritativeDefinitions != null && !authoritativeDefinitions.isEmpty()) {
      sb.append("## Authoritative Definitions\n");
      for (Map<String, String> def : authoritativeDefinitions) {
        def.forEach((key, value) -> sb.append("- **").append(key).append("**: ").append(value).append("\n"));
      }
    }
    
    return sb.toString().trim();
  }
}