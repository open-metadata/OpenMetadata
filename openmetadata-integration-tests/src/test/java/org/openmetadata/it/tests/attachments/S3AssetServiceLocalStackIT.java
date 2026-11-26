/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */
package org.openmetadata.it.tests.attachments;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.service.attachments.S3AssetService;
import org.openmetadata.service.config.S3Configuration;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.BucketAlreadyOwnedByYouException;

/**
 * End-to-end test of {@link S3AssetService} against a real S3 API served by the suite's object
 * storage container, exercising the actual AWS SDK upload/read/delete path rather than Mockito
 * stand-ins.
 */
@Execution(ExecutionMode.CONCURRENT)
class S3AssetServiceLocalStackIT {

  private static final String BUCKET_NAME = "openmetadata-assets-it";
  private static final String ACCESS_KEY = "accesskey";
  private static final String SECRET_KEY = "secretkey";
  private static final String REGION = "us-east-1";

  private S3AssetService assetService;

  @BeforeAll
  static void createBucket() {
    TestSuiteBootstrap.setupObjectStorage();
    try (S3Client bootstrap = newRawClient()) {
      try {
        bootstrap.createBucket(builder -> builder.bucket(BUCKET_NAME));
      } catch (BucketAlreadyOwnedByYouException alreadyCreated) {
        // another class of this JVM created it first
      }
    }
  }

  @BeforeEach
  void setUp() {
    assetService = new S3AssetService(localStackConfig());
  }

  @AfterEach
  void tearDown() {
    if (assetService != null) {
      assetService.close();
    }
  }

  @Test
  void uploadWithExplicitSizeRoundTrips() throws Exception {
    byte[] payload = "explicit-size-payload".getBytes(StandardCharsets.UTF_8);
    Asset asset = newAsset();
    asset.setSize(payload.length);

    assetService.upload(asset, new ByteArrayInputStream(payload)).join();

    assertArrayEquals(payload, readBack(asset));
  }

  @Test
  void uploadWithNullSizeSucceeds() throws Exception {
    byte[] payload =
        "OpenMetadata object storage validation probe".getBytes(StandardCharsets.UTF_8);
    Asset asset = newAsset();

    assertDoesNotThrow(
        () -> assetService.upload(asset, new ByteArrayInputStream(payload)).join(),
        "upload must not NPE when the asset size is unset (the system-validation probe path)");

    assertArrayEquals(payload, readBack(asset));
  }

  @Test
  void uploadWithNullSizeAndUnderreportingStreamRoundTrips() throws Exception {
    byte[] payload =
        "a payload longer than any single available() estimate would report"
            .getBytes(StandardCharsets.UTF_8);
    Asset asset = newAsset();
    InputStream underreporting =
        new ByteArrayInputStream(payload) {
          @Override
          public int available() {
            return 1;
          }
        };

    assetService.upload(asset, underreporting).join();

    assertArrayEquals(
        payload,
        readBack(asset),
        "the full stream must be uploaded; available() must not be used as the content length");
  }

  private byte[] readBack(Asset asset) throws Exception {
    byte[] result;
    try (InputStream stream = assetService.read(asset).join()) {
      result = stream.readAllBytes();
    }
    return result;
  }

  private static Asset newAsset() {
    Asset asset = new Asset();
    asset.setId("system-validation-" + UUID.randomUUID());
    asset.setContentType("text/plain");
    return asset;
  }

  private static S3Configuration localStackConfig() {
    S3Configuration config = new S3Configuration();
    config.setBucketName(BUCKET_NAME);
    config.setRegion(REGION);
    config.setAccessKey(ACCESS_KEY);
    config.setSecretKey(SECRET_KEY);
    config.setEndpoint(TestSuiteBootstrap.getObjectStorageEndpoint());
    return config;
  }

  private static S3Client newRawClient() {
    return S3Client.builder()
        .endpointOverride(URI.create(TestSuiteBootstrap.getObjectStorageEndpoint()))
        .region(Region.of(REGION))
        .credentialsProvider(
            StaticCredentialsProvider.create(AwsBasicCredentials.create(ACCESS_KEY, SECRET_KEY)))
        .forcePathStyle(true)
        .build();
  }
}
