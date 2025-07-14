package org.openmetadata.service.datacontract.odcs;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.List;
import java.util.Map;
import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.Pattern;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * ODCS (Open Data Contract Standard) root model
 * Supports versions: v3.0.0, v3.0.1, v3.0.2
 */
@Data
@NoArgsConstructor
@JsonIgnoreProperties(ignoreUnknown = true)
public class ODCSContract {
  
  @JsonProperty("apiVersion")
  @NotBlank(message = "apiVersion is required")
  @Pattern(regexp = "v3\\.0\\.[0-2]", message = "Only ODCS versions v3.0.0, v3.0.1, v3.0.2 are supported")
  private String apiVersion;
  
  @JsonProperty("kind")
  @NotBlank(message = "kind is required")
  @Pattern(regexp = "DataContract", message = "kind must be 'DataContract'")
  private String kind;
  
  @JsonProperty("id")
  @NotBlank(message = "id is required")
  private String id;
  
  @JsonProperty("name")
  private String name;
  
  @JsonProperty("version")
  @NotBlank(message = "version is required")
  private String version;
  
  @JsonProperty("status")
  @NotBlank(message = "status is required")
  @Pattern(regexp = "proposed|draft|active|deprecated|retired", 
           message = "status must be one of: proposed, draft, active, deprecated, retired")
  private String status;
  
  @JsonProperty("tenant")
  private String tenant;
  
  @JsonProperty("domain")
  private String domain;
  
  @JsonProperty("dataProduct")
  private String dataProduct;
  
  @JsonProperty("description")
  @Valid
  private ODCSDescription description;
  
  @JsonProperty("schema")
  @Valid
  private List<ODCSSchema> schema;
  
  @JsonProperty("quality")
  @Valid
  private List<ODCSQuality> quality;
  
  @JsonProperty("support")
  @Valid
  private List<ODCSSupport> support;
  
  @JsonProperty("price")
  @Valid
  private ODCSPrice price;
  
  @JsonProperty("team")
  @Valid
  private List<ODCSTeam> team;
  
  @JsonProperty("roles")
  @Valid
  private List<ODCSRole> roles;
  
  @JsonProperty("slaProperties")
  @Valid
  private List<ODCSSla> slaProperties;
  
  @JsonProperty("servers")
  private List<Map<String, Object>> servers; // Ignored during import
  
  @JsonProperty("terms")
  private Map<String, Object> terms;
  
  @JsonProperty("tags")
  private List<String> tags;
  
  @JsonProperty("links")
  private Map<String, String> links;
  
  @JsonProperty("customProperties")
  private Map<String, Object> customProperties;
}