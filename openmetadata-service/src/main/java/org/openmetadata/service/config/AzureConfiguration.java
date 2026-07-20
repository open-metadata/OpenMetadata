package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AzureConfiguration {

  @JsonProperty("containerName")
  private String containerName;

  /**
   * Deprecated Azure credential fields are retained only so existing YAML files
   * continue to deserialize while asset uploads authenticate through
   * DefaultAzureCredential.
   */
  @Deprecated
  @JsonProperty("connectionString")
  private String connectionString;

  @Deprecated
  @JsonProperty("useManagedIdentity")
  private boolean useManagedIdentity;

  @Deprecated
  @JsonProperty("clientId")
  private String clientId;

  @Deprecated
  @JsonProperty("tenantId")
  private String tenantId;

  @Deprecated
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
