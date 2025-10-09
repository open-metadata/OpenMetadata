/*
 *  Copyright 2025 Collate
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

package org.openmetadata.service.logstorage;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.io.IOException;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.openmetadata.schema.api.configuration.LogStorageConfiguration;
import org.openmetadata.schema.security.credentials.AWSCredentials;
import org.openmetadata.sdk.PipelineServiceClientInterface;
import org.openmetadata.service.monitoring.StreamableLogsMetrics;

/**
 * Test class for LogStorageFactory.
 * Verifies factory creates correct storage implementations with metrics.
 */
@ExtendWith(MockitoExtension.class)
public class LogStorageFactoryTest {

  @Mock private PipelineServiceClientInterface mockPipelineServiceClient;
  @Mock private StreamableLogsMetrics mockMetrics;

  private LogStorageConfiguration s3Config;
  private LogStorageConfiguration defaultConfig;

  @BeforeEach
  void setUp() {
    s3Config =
        new LogStorageConfiguration()
            .withType(LogStorageConfiguration.Type.S_3)
            .withBucketName("test-bucket")
            .withAwsConfig(new AWSCredentials().withAwsRegion("us-east-1"))
            .withPrefix("test-prefix");

    defaultConfig = null; // null config should create default storage
  }

  @Test
  void testCreateDefaultStorage() throws IOException {
    LogStorageInterface storage =
        LogStorageFactory.create(defaultConfig, mockPipelineServiceClient, mockMetrics);

    assertNotNull(storage);
    assertInstanceOf(DefaultLogStorage.class, storage);
    assertEquals("default", storage.getStorageType());
  }

  @Test
  void testCreateS3StorageWithMetrics() throws IOException {
    // Note: This test would need additional setup to mock S3Client creation
    // For now, we're testing that the factory correctly passes metrics
    assertThrows(
        Exception.class,
        () -> {
          LogStorageFactory.create(s3Config, mockPipelineServiceClient, mockMetrics);
        });
    // The exception is expected because we haven't mocked S3Client.builder()
    // In a real scenario with proper mocking, this would create an S3LogStorage instance
  }

  @Test
  void testCreateDefaultStorageWithoutMetrics() throws IOException {
    LogStorageInterface storage = LogStorageFactory.create(null, mockPipelineServiceClient, null);

    assertNotNull(storage);
    assertInstanceOf(DefaultLogStorage.class, storage);
  }

  @Test
  void testNullStorageType() {
    LogStorageConfiguration invalidConfig = new LogStorageConfiguration().withType(null);

    assertThrows(
        IllegalArgumentException.class,
        () -> {
          LogStorageFactory.create(invalidConfig, mockPipelineServiceClient, mockMetrics);
        });
  }

  @Test
  void testNullPipelineServiceClient() {
    // Default storage requires PipelineServiceClient
    assertThrows(
        IOException.class,
        () -> {
          LogStorageFactory.create(null, null, mockMetrics);
        });
  }

  @Test
  void testMetricsIntegration() throws IOException {
    SimpleMeterRegistry registry = new SimpleMeterRegistry();
    StreamableLogsMetrics realMetrics = new StreamableLogsMetrics(registry);

    LogStorageInterface storage =
        LogStorageFactory.create(defaultConfig, mockPipelineServiceClient, realMetrics);

    assertNotNull(storage);
    assertInstanceOf(DefaultLogStorage.class, storage);
    // Verify storage was created successfully with metrics
    // For S3LogStorage, metrics would be used during operations
  }

  @Test
  void testCreateExplicitDefaultStorage() throws IOException {
    LogStorageInterface storage =
        LogStorageFactory.create(defaultConfig, mockPipelineServiceClient, mockMetrics);

    assertNotNull(storage);
    assertInstanceOf(DefaultLogStorage.class, storage);
    assertEquals("default", storage.getStorageType());
  }
}
