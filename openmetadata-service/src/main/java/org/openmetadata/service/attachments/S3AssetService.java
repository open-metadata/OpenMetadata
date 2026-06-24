package org.openmetadata.service.attachments;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionException;
import lombok.extern.slf4j.Slf4j;
import org.apache.commons.io.IOUtils;
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.service.config.S3Configuration;
import org.openmetadata.service.util.AsyncService;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.AwsCredentialsProvider;
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.cloudfront.CloudFrontUtilities;
import software.amazon.awssdk.services.cloudfront.model.CustomSignerRequest;
import software.amazon.awssdk.services.cloudfront.url.SignedUrl;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.S3ClientBuilder;
import software.amazon.awssdk.services.s3.model.*;
import software.amazon.awssdk.services.s3.presigner.S3Presigner;
import software.amazon.awssdk.services.s3.presigner.model.GetObjectPresignRequest;
import software.amazon.awssdk.services.s3.presigner.model.PresignedGetObjectRequest;

@Slf4j
public class S3AssetService implements AssetService {
  private final S3Configuration config;
  private final S3Client s3Client;
  private final S3Presigner presigner;
  private final CloudFrontUtilities cloudFrontUtilities;
  private final String actualBucketName;
  private final String prefixPath;

  public S3AssetService(S3Configuration config) {
    this.config = config;
    this.actualBucketName = config.getBucketName();
    this.prefixPath = formatPrefix(config.getPrefixPath());

    AwsCredentialsProvider credentialsProvider = resolveCredentials(config);
    URI endpointOverride =
        CommonUtil.nullOrEmpty(config.getEndpoint()) ? null : URI.create(config.getEndpoint());
    software.amazon.awssdk.services.s3.S3Configuration serviceConfiguration =
        software.amazon.awssdk.services.s3.S3Configuration.builder()
            .pathStyleAccessEnabled(endpointOverride != null)
            .build();

    S3ClientBuilder builder =
        S3Client.builder()
            .region(Region.of(config.getRegion()))
            .credentialsProvider(credentialsProvider)
            .serviceConfiguration(serviceConfiguration);

    if (endpointOverride != null) {
      builder.endpointOverride(endpointOverride);
    }

    this.s3Client = builder.build();
    S3Presigner.Builder presignerBuilder =
        S3Presigner.builder()
            .region(Region.of(config.getRegion()))
            .credentialsProvider(credentialsProvider)
            .serviceConfiguration(serviceConfiguration);
    if (endpointOverride != null) {
      presignerBuilder.endpointOverride(endpointOverride);
    }
    this.presigner = presignerBuilder.build();

    this.cloudFrontUtilities = CloudFrontUtilities.create();
  }

  @Override
  public void close() {
    // S3Client and S3Presigner both hold HTTP connection pools backed by the AWS SDK —
    // release them on shutdown so the JVM doesn't leak pool threads / sockets.
    try {
      s3Client.close();
    } catch (Exception e) {
      LOG.warn("Failed to close S3 client cleanly", e);
    }
    try {
      presigner.close();
    } catch (Exception e) {
      LOG.warn("Failed to close S3 presigner cleanly", e);
    }
  }

  private AwsCredentialsProvider resolveCredentials(S3Configuration config) {
    if (config.getEndpoint() != null && !config.getEndpoint().isEmpty()) {
      LOG.info("Custom endpoint detected, using StaticCredentialsProvider");
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(config.getAccessKey(), config.getSecretKey()));
    }
    try {
      AwsCredentialsProvider defaultProvider = DefaultCredentialsProvider.create();
      defaultProvider.resolveCredentials(); // Triggers validation
      LOG.info("Using AWS DefaultCredentialsProvider");
      return defaultProvider;
    } catch (Exception e) {
      LOG.warn(
          "Default credentials not found. Falling back to static credentials. Reason: {}",
          e.getMessage());
      return StaticCredentialsProvider.create(
          AwsBasicCredentials.create(config.getAccessKey(), config.getSecretKey()));
    }
  }

  private String formatPrefix(String rawPrefix) {
    if (CommonUtil.nullOrEmpty(rawPrefix)) return "";
    return rawPrefix.endsWith("/") ? rawPrefix : rawPrefix + "/";
  }

  private String resolveKey(String assetId) {
    return prefixPath + assetId;
  }

  @Override
  public CompletableFuture<String> upload(Asset asset, InputStream content) {
    return AsyncService.executeAsync(
        () -> {
          try {
            String key = resolveKey(asset.getId());
            PutObjectRequest.Builder putBuilder =
                PutObjectRequest.builder()
                    .bucket(actualBucketName)
                    .key(key)
                    .contentType(asset.getContentType());

            if (config.getSseAlgorithm() != null && !config.getSseAlgorithm().isEmpty()) {
              if ("AES256".equals(config.getSseAlgorithm())) {
                putBuilder.serverSideEncryption(ServerSideEncryption.AES256);
              } else if ("aws:kms".equals(config.getSseAlgorithm())) {
                putBuilder.serverSideEncryption(ServerSideEncryption.AWS_KMS);
                if (config.getKmsKeyId() != null && !config.getKmsKeyId().isEmpty()) {
                  putBuilder.ssekmsKeyId(config.getKmsKeyId());
                }
              }
            }

            PutObjectRequest putRequest = putBuilder.build();
            if (asset.getSize() == null) {
              byte[] bytes = IOUtils.toByteArray(content);
              s3Client.putObject(putRequest, RequestBody.fromBytes(bytes));
            } else {
              s3Client.putObject(
                  putRequest, RequestBody.fromInputStream(content, asset.getSize().longValue()));
            }
            return "success";
          } catch (Exception e) {
            throw new CompletionException(e);
          }
        },
        "Upload",
        asset.getId());
  }

  @Override
  public CompletableFuture<InputStream> read(Asset asset) {
    // Open the S3 object on the caller's thread rather than hopping through
    // AsyncService. Every caller of read() immediately joins on the returned
    // future, so routing the blocking getObject through AsyncService's bounded
    // pool just added scheduling overhead and created a starvation path — when
    // a caller already running on AsyncService (or a caller that can monopolize
    // AsyncService throughput) blocks on join(), the submitted read task has to
    // fight for a worker before it can run.
    try {
      LOG.debug("Reading asset {} from S3 bucket {}", asset.getId(), actualBucketName);
      String key = resolveKey(asset.getId());
      GetObjectRequest getRequest =
          GetObjectRequest.builder().bucket(actualBucketName).key(key).build();
      InputStream inputStream = s3Client.getObject(getRequest);
      LOG.debug("Successfully opened input stream for asset {}", asset.getId());
      return CompletableFuture.completedFuture(inputStream);
    } catch (Exception e) {
      CompletableFuture<InputStream> failed = new CompletableFuture<>();
      failed.completeExceptionally(e);
      return failed;
    }
  }

  @Override
  public CompletableFuture<Void> delete(Asset asset) {
    return AsyncService.executeAsync(
        () -> {
          try {
            String key = resolveKey(asset.getId());
            DeleteObjectRequest deleteRequest =
                DeleteObjectRequest.builder().bucket(actualBucketName).key(key).build();

            s3Client.deleteObject(deleteRequest);
            LOG.debug("Successfully deleted asset {}", asset.getId());
            return null;
          } catch (Exception e) {
            throw new CompletionException(e);
          }
        },
        "Delete",
        asset.getId());
  }

  @Override
  public String generateDownloadURL(Asset asset) {
    // The stored asset.url points at the S3 object key, not a signed URL. Return a
    // short-lived presigned URL instead so the caller can actually fetch the object.
    // Matches AzureAssetService.generateDownloadURL which does the same thing.
    return generateDownloadUrlWithExpiry(asset, Duration.ofMinutes(15));
  }

  @Override
  public String generateDownloadUrlWithExpiry(Asset asset, Duration expiry) {
    String cloudFrontUrl = config.getCloudFrontUrl();
    String key = resolveKey(asset.getId());

    if (cloudFrontUrl != null
        && !cloudFrontUrl.isEmpty()
        && config.getCloudFrontKeyPairId() != null
        && config.getCloudFrontPrivateKeyPath() != null) {
      try {
        String resourceUrl = cloudFrontUrl + "/" + key;
        Path privateKeyPath = Paths.get(config.getCloudFrontPrivateKeyPath());

        CustomSignerRequest signerRequest =
            CustomSignerRequest.builder()
                .resourceUrl(resourceUrl)
                .keyPairId(config.getCloudFrontKeyPairId())
                .privateKey(privateKeyPath)
                .expirationDate(Instant.now().plus(expiry))
                .build();

        SignedUrl signedUrl = cloudFrontUtilities.getSignedUrlWithCustomPolicy(signerRequest);
        return signedUrl.url();
      } catch (Exception e) {
        LOG.error("Failed to generate CloudFront signed URL: {}", e.getMessage(), e);
      }
    }

    GetObjectPresignRequest presignRequest =
        GetObjectPresignRequest.builder()
            .signatureDuration(expiry)
            .getObjectRequest(req -> req.bucket(actualBucketName).key(key))
            .build();

    PresignedGetObjectRequest presignedRequest = presigner.presignGetObject(presignRequest);
    return presignedRequest.url().toString();
  }
}
