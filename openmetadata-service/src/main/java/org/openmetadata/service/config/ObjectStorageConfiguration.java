package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import java.util.Locale;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Getter
@Setter
public class ObjectStorageConfiguration {

  @JsonProperty("enabled")
  private boolean enabled = false;

  @JsonProperty("maxFileSize")
  private long maxFileSize = 5 * 1024 * 1024; // 5MB in bytes

  /** Provider can be "s3", "azure", "inmemory", "in-memory", or "noop". */
  @JsonProperty("provider")
  private String provider;

  @JsonProperty("s3")
  private S3Configuration s3Configuration;

  @JsonProperty("azure")
  private AzureConfiguration azureConfiguration;

  @AssertTrue(
      message = "Object storage provider must be one of: s3, azure, inmemory, in-memory, noop")
  public boolean isValidProvider() {
    if (!enabled) {
      return true;
    }
    return switch (normalizedProvider()) {
      case "s3", "azure", "inmemory", "in-memory", "noop" -> true;
      default -> false;
    };
  }

  @AssertTrue(
      message =
          "S3 configuration requires bucketName, region, and either useIamRole=true or both"
              + " accessKey and secretKey")
  public boolean isValidS3Configuration() {
    if (!enabled || !"s3".equals(normalizedProvider())) {
      return true;
    }
    return s3Configuration != null
        && StringUtils.isNotBlank(s3Configuration.getBucketName())
        && StringUtils.isNotBlank(s3Configuration.getRegion())
        && s3Configuration.isValidCredentials();
  }

  @AssertTrue(message = "Azure configuration requires containerName and blobEndpoint")
  public boolean isValidAzureConfiguration() {
    if (!enabled || !"azure".equals(normalizedProvider())) {
      return true;
    }
    return azureConfiguration != null
        && StringUtils.isNotBlank(azureConfiguration.getContainerName())
        && StringUtils.isNotBlank(azureConfiguration.getBlobEndpoint());
  }

  private String normalizedProvider() {
    return provider == null ? "" : provider.trim().toLowerCase(Locale.ROOT);
  }
}
