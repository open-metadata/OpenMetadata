package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ObjectStorageConfiguration {

  @JsonProperty("enabled")
  private boolean enabled = false;

  @JsonProperty("maxFileSize")
  private long maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

  /**
   * Provider can be "s3", "azure", or "noop" (for local testing).
   */
  @JsonProperty("provider")
  @NotNull
  private String provider;

  @JsonProperty("s3")
  @Valid
  private S3Configuration s3Configuration;

  @JsonProperty("azure")
  @Valid
  private AzureConfiguration azureConfiguration;
}
