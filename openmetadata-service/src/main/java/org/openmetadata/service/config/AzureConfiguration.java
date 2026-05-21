package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AzureConfiguration {

  @JsonProperty("containerName")
  @NotBlank(message = "Container name must be provided")
  private String containerName;

  @JsonProperty("connectionString")
  private String connectionString;

  @JsonProperty("useManagedIdentity")
  private boolean useManagedIdentity = false;

  @JsonProperty("clientId")
  private String clientId;

  @JsonProperty("tenantId")
  private String tenantId;

  @JsonProperty("clientSecret")
  private String clientSecret;

  @JsonProperty("cdnUrl")
  private String cdnUrl;

  @JsonProperty("cdnKeyName")
  private String cdnKeyName;

  @JsonProperty("cdnKey")
  private String cdnKey;

  @JsonProperty("prefixPath")
  private String prefixPath;

  @JsonProperty("blobEndpoint")
  private String blobEndpoint;
}
