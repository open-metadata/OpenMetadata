package org.openmetadata.service.util;

import lombok.extern.slf4j.Slf4j;
import org.apache.commons.lang3.StringUtils;
import org.openmetadata.schema.security.credentials.AWSBaseConfig;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.AwsSessionCredentials;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.sts.StsClient;
import software.amazon.awssdk.services.sts.auth.StsAssumeRoleCredentialsProvider;
import software.amazon.awssdk.services.sts.model.AssumeRoleRequest;

@Slf4j
public class AwsCredentialsUtil {

  private AwsCredentialsUtil() {}

  public static AwsCredentialsProvider buildCredentialsProvider(AWSBaseConfig config) {
    AwsCredentialsProvider baseProvider = buildBaseProvider(config);

    if (StringUtils.isNotEmpty(config.getAssumeRoleArn())) {
      LOG.info("Using assume role authentication with ARN: {}", config.getAssumeRoleArn());
      return buildAssumeRoleProvider(config, baseProvider);
    }
    return baseProvider;
  }

  private static AwsCredentialsProvider buildBaseProvider(AWSBaseConfig config) {
    if (StringUtils.isNotEmpty(config.getAccessKeyId())
        && StringUtils.isNotEmpty(config.getSecretAccessKey())) {
      if (StringUtils.isNotEmpty(config.getSessionToken())) {
        LOG.info("Using AWS session credentials (temporary credentials)");
        return StaticCredentialsProvider.create(
            AwsSessionCredentials.create(
                config.getAccessKeyId(), config.getSecretAccessKey(), config.getSessionToken()));
      }
      LOG.info("Using AWS static credentials (access key/secret key)");
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(config.getAccessKeyId(), config.getSecretAccessKey()));
    }
    if (Boolean.TRUE.equals(config.getEnabled())) {
      LOG.info("Using AWS default credential provider chain (IAM role, environment, etc.)");
      return DefaultCredentialsProvider.create();
    }
    throw new IllegalArgumentException(
        "AWS credentials not configured. Either provide accessKeyId/secretAccessKey "
            + "or set enabled=true to use IAM authentication via the default credential provider chain.");
  }

  private static AwsCredentialsProvider buildAssumeRoleProvider(
      AWSBaseConfig config, AwsCredentialsProvider baseProvider) {
    String sessionName =
        StringUtils.isNotEmpty(config.getAssumeRoleSessionName())
            ? config.getAssumeRoleSessionName()
            : "OpenMetadataSession";

    StsClient stsClient =
        StsClient.builder()
            .credentialsProvider(baseProvider)
            .region(Region.of(config.getRegion()))
            .build();

    return StsAssumeRoleCredentialsProvider.builder()
        .stsClient(stsClient)
        .refreshRequest(
            () ->
                AssumeRoleRequest.builder()
                    .roleArn(config.getAssumeRoleArn())
                    .roleSessionName(sessionName)
                    .build())
        .build();
  }

  public static Region getRegion(AWSBaseConfig config) {
    return StringUtils.isNotEmpty(config.getRegion()) ? Region.of(config.getRegion()) : null;
  }

  public static boolean isAwsConfigured(AWSBaseConfig config) {
    return config != null && StringUtils.isNotEmpty(config.getRegion());
  }

  public static boolean isAwsIamAuthEnabled(AWSBaseConfig config) {
    return config != null
        && Boolean.TRUE.equals(config.getEnabled())
        && StringUtils.isNotEmpty(config.getRegion());
  }

  public static boolean hasStaticCredentials(AWSBaseConfig config) {
    return config != null
        && StringUtils.isNotEmpty(config.getAccessKeyId())
        && StringUtils.isNotEmpty(config.getSecretAccessKey());
  }
}
