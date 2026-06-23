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
package org.openmetadata.service.attachments;

import static org.junit.jupiter.api.Assertions.assertArrayEquals;
import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;

import java.io.ByteArrayInputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.attachments.Asset;
import org.openmetadata.service.config.S3Configuration;
import org.testcontainers.containers.localstack.LocalStackContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;
import org.testcontainers.utility.DockerImageName;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * End-to-end test of {@link S3AssetService} against a real S3 backend emulated by LocalStack in a
 * Testcontainer, exercising the actual AWS SDK upload/read/delete path rather than Mockito stand-
 * ins. Skipped automatically when Docker is not available.
 */
@Testcontainers(disabledWithoutDocker = true)
class S3AssetServiceLocalStackTest {

  private static final DockerImageName LOCALSTACK_IMAGE =
      DockerImageName.parse("localstack/localstack:3.8.1");

  private static final String BUCKET_NAME = "openmetadata-assets-it";

  @Container
  static final LocalStackContainer LOCALSTACK =
      new LocalStackContainer(LOCALSTACK_IMAGE).withServices(LocalStackContainer.Service.S3);

  private S3AssetService assetService;

  @BeforeEach
  void setUp() {
    try (S3Client bootstrap = newRawClient()) {
      bootstrap.createBucket(builder -> builder.bucket(BUCKET_NAME));
    }
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
    config.setRegion(LOCALSTACK.getRegion());
    config.setAccessKey(LOCALSTACK.getAccessKey());
    config.setSecretKey(LOCALSTACK.getSecretKey());
    config.setEndpoint(LOCALSTACK.getEndpoint().toString());
    return config;
  }

  private static S3Client newRawClient() {
    return S3Client.builder()
        .endpointOverride(LOCALSTACK.getEndpoint())
        .region(Region.of(LOCALSTACK.getRegion()))
        .credentialsProvider(
            StaticCredentialsProvider.create(
                AwsBasicCredentials.create(LOCALSTACK.getAccessKey(), LOCALSTACK.getSecretKey())))
        .forcePathStyle(true)
        .build();
  }
}
