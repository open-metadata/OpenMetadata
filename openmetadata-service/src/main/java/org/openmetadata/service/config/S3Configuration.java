package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;
import org.apache.commons.lang3.StringUtils;

@Getter
@Setter
public class S3Configuration {

  @JsonProperty("bucketName")
  private String bucketName;

  @JsonProperty("region")
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

  public boolean isValidCredentials() {
    if (useIamRole) {
      return true;
    } else {
      return StringUtils.isNotBlank(accessKey) && StringUtils.isNotBlank(secretKey);
    }
  }
}
