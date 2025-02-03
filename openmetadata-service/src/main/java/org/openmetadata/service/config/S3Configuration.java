package org.openmetadata.service.config;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Getter;
import lombok.Setter;

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
  private boolean useIamRole;

  @JsonProperty("iamRoleArn")
  private String iamRoleArn;
}
