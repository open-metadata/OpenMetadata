package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Getter
@Setter
public class S3Configuration {

  @JsonProperty("bucketName")
  @NotBlank(message = "Bucket name must be provided")
  private String bucketName;

  @JsonProperty("region")
  @NotBlank(message = "Region must be provided")
  private String region;

  @JsonProperty("accessKey")
  private String accessKey;

  @JsonProperty("secretKey")
  private String secretKey;

  @JsonProperty("useIamRole")
  private boolean useIamRole = false;

  @JsonProperty("iamRoleArn")
  private String iamRoleArn;

  @JsonProperty("endpoint")
  private String endpoint;

  @JsonProperty("cloudFrontUrl")
  private String cloudFrontUrl;

  @JsonProperty("cloudFrontKeyId")
  private String cloudFrontKeyPairId;

  @JsonProperty("cloudFrontPrivateKeyPath")
  private String cloudFrontPrivateKeyPath;

  @JsonProperty("prefixPath")
  private String prefixPath;

  @JsonProperty("sseAlgorithm")
  private String sseAlgorithm;

  @JsonProperty("kmsKeyId")
  private String kmsKeyId;

  @AssertTrue(
      message = "Either useIamRole must be true or both accessKey and secretKey must be provided")
  public boolean isValidCredentials() {
    if (useIamRole) {
      return true;
    } else {
      return StringUtils.isNotBlank(accessKey) && StringUtils.isNotBlank(secretKey);
    }
  }
}
