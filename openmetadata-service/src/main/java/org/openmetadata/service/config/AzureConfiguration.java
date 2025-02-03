package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AzureConfiguration {

  @JsonProperty("containerName")
  private String containerName;

  @JsonProperty("connectionString")
  private String connectionString;

  @JsonProperty("useManagedIdentity")
  private boolean useManagedIdentity;

  @JsonProperty("clientId")
  private String clientId;

  @JsonProperty("tenantId")
  private String tenantId;

  @JsonProperty("clientSecret")
  private String clientSecret;
}