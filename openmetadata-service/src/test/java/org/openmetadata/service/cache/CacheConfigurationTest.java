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

package org.openmetadata.service.cache;

import static org.junit.jupiter.api.Assertions.*;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import jakarta.validation.ValidatorFactory;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.junit.jupiter.api.*;
import org.openmetadata.service.config.CacheConfiguration;

@Slf4j
class CacheConfigurationTest {

  private Validator validator;

  @BeforeEach
  public void setup() {
    ValidatorFactory factory = Validation.buildDefaultValidatorFactory();
    validator = factory.getValidator();
  }

  @Test
  @DisplayName("Test default cache configuration values")
  public void testDefaultCacheConfigurationValues() {
    CacheConfiguration config = new CacheConfiguration();
    assertFalse(config.isEnabled(), "Cache should be disabled by default");
    assertEquals(
        CacheConfiguration.CacheProvider.REDIS_STANDALONE,
        config.getProvider(),
        "Default provider should be REDIS_STANDALONE");
    assertEquals(6379, config.getPort(), "Default port should be 6379");
    assertEquals(
        CacheConfiguration.AuthType.PASSWORD,
        config.getAuthType(),
        "Default auth type should be PASSWORD");
    assertFalse(config.isUseSsl(), "SSL should be disabled by default");
    assertEquals(0, config.getDatabase(), "Default database should be 0");
    assertEquals(3600, config.getTtlSeconds(), "Default TTL should be 3600 seconds");
    assertEquals(
        5, config.getConnectionTimeoutSecs(), "Default connection timeout should be 5 seconds");
    assertEquals(60, config.getSocketTimeoutSecs(), "Default socket timeout should be 60 seconds");
    assertEquals(3, config.getMaxRetries(), "Default max retries should be 3");

    assertTrue(config.isWarmupEnabled(), "Warmup should be enabled by default");
    assertEquals(100, config.getWarmupBatchSize(), "Default warmup batch size should be 100");
    assertEquals(2, config.getWarmupThreads(), "Default warmup threads should be 2");
  }

  @Test
  @DisplayName("Test valid cache configuration validation")
  public void testValidCacheConfigurationValidation() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "Valid configuration should have no violations");
  }

  @Test
  @DisplayName("Test cache configuration validation with missing host")
  public void testCacheConfigurationValidationMissingHost() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setPassword("test-password");

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(violations.isEmpty(), "Configuration without host should have violations");

    boolean foundHostViolation =
        violations.stream().anyMatch(v -> v.getMessage().contains("Host must be provided"));
    assertTrue(foundHostViolation, "Should have violation for missing host");
  }

  @Test
  @DisplayName("Test cache configuration validation with missing password")
  public void testCacheConfigurationValidationMissingPassword() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setAuthType(CacheConfiguration.AuthType.PASSWORD);
    // Password is not set

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(violations.isEmpty(), "Configuration without password should have violations");

    boolean foundPasswordViolation =
        violations.stream().anyMatch(v -> v.getMessage().contains("Password must be provided"));
    assertTrue(foundPasswordViolation, "Should have violation for missing password");

    LOG.info("Cache configuration validation missing password test passed");
  }

  @Test
  @Order(5)
  @DisplayName("Test cache configuration validation with invalid port")
  public void testCacheConfigurationValidationInvalidPort() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");
    config.setPort(0); // Invalid port

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(violations.isEmpty(), "Configuration with invalid port should have violations");

    boolean foundPortViolation =
        violations.stream().anyMatch(v -> v.getMessage().contains("Port must be greater than 0"));
    assertTrue(foundPortViolation, "Should have violation for invalid port");

    LOG.info("Cache configuration validation invalid port test passed");
  }

  @Test
  @Order(6)
  @DisplayName("Test cache configuration validation with invalid database")
  public void testCacheConfigurationValidationInvalidDatabase() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");
    config.setDatabase(16); // Invalid database (Redis databases are 0-15)

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(violations.isEmpty(), "Configuration with invalid database should have violations");

    boolean foundDatabaseViolation =
        violations.stream()
            .anyMatch(v -> v.getMessage().contains("Database must be between 0 and 15"));
    assertTrue(foundDatabaseViolation, "Should have violation for invalid database");
  }

  @Test
  @Order(7)
  @DisplayName("Test warmup configuration validation with invalid batch size")
  public void testWarmupConfigurationValidationInvalidBatchSize() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");
    config.setWarmupBatchSize(0);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(
        violations.isEmpty(),
        "Configuration with invalid warmup batch size should have violations");

    boolean foundBatchSizeViolation =
        violations.stream()
            .anyMatch(v -> v.getMessage().contains("Warmup batch size must be positive"));
    assertTrue(foundBatchSizeViolation, "Should have violation for invalid warmup batch size");
  }

  @Test
  @Order(8)
  @DisplayName("Test warmup configuration validation with invalid thread count")
  public void testWarmupConfigurationValidationInvalidThreadCount() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");
    config.setWarmupThreads(0); // Invalid thread count

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(
        violations.isEmpty(),
        "Configuration with invalid warmup thread count should have violations");

    boolean foundThreadsViolation =
        violations.stream()
            .anyMatch(v -> v.getMessage().contains("Warmup threads must be positive"));
    assertTrue(foundThreadsViolation, "Should have violation for invalid warmup thread count");

    LOG.info("Warmup configuration validation invalid thread count test passed");
  }

  @Test
  @Order(9)
  @DisplayName("Test cache configuration validation with cluster database")
  public void testCacheConfigurationValidationClusterDatabase() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("localhost");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.REDIS_CLUSTER);
    config.setDatabase(1); // Database selection not supported in cluster mode

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(violations.isEmpty(), "Cluster configuration with database should have violations");

    boolean foundClusterDatabaseViolation =
        violations.stream()
            .anyMatch(
                v -> v.getMessage().contains("Database selection not supported in cluster mode"));
    assertTrue(foundClusterDatabaseViolation, "Should have violation for database in cluster mode");
  }

  @Test
  @Order(10)
  @DisplayName("Test AWS ElastiCache configuration validation")
  public void testAwsElastiCacheConfigurationValidation() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("elasticache.aws.com");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.ELASTICACHE_STANDALONE);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(
        violations.isEmpty(),
        "ElastiCache configuration without AWS config should have violations");

    boolean foundAwsConfigViolation =
        violations.stream()
            .anyMatch(
                v ->
                    v.getMessage()
                        .contains("AWS config must be provided for ElastiCache providers"));
    assertTrue(foundAwsConfigViolation, "Should have violation for missing AWS config");
  }

  @Test
  @DisplayName("Test Azure Redis configuration validation")
  public void testAzureRedisConfigurationValidation() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("azure-redis.cache.windows.net");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.AZURE_REDIS);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertFalse(
        violations.isEmpty(),
        "Azure Redis configuration without Azure config should have violations");

    boolean foundAzureConfigViolation =
        violations.stream()
            .anyMatch(
                v ->
                    v.getMessage()
                        .contains("Azure config must be provided for Azure Redis provider"));
    assertTrue(foundAzureConfigViolation, "Should have violation for missing Azure config");
  }

  @Test
  @DisplayName("Test valid AWS configuration")
  public void testValidAwsConfiguration() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("elasticache.aws.com");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.ELASTICACHE_STANDALONE);

    CacheConfiguration.AwsConfig awsConfig = new CacheConfiguration.AwsConfig();
    awsConfig.setRegion("us-east-1");
    awsConfig.setAccessKey("test-access-key");
    awsConfig.setSecretKey("test-secret-key");
    config.setAwsConfig(awsConfig);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "Valid AWS configuration should have no violations");
  }

  @Test
  @DisplayName("Test AWS IAM role configuration")
  public void testAwsIamRoleConfiguration() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("elasticache.aws.com");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.ELASTICACHE_STANDALONE);

    CacheConfiguration.AwsConfig awsConfig = new CacheConfiguration.AwsConfig();
    awsConfig.setRegion("us-east-1");
    awsConfig.setUseIamRole(true);
    config.setAwsConfig(awsConfig);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "AWS IAM role configuration should have no violations");
  }

  @Test
  @DisplayName("Test valid Azure configuration")
  public void testValidAzureConfiguration() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(true);
    config.setHost("azure-redis.cache.windows.net");
    config.setPassword("test-password");
    config.setProvider(CacheConfiguration.CacheProvider.AZURE_REDIS);

    CacheConfiguration.AzureConfig azureConfig = new CacheConfiguration.AzureConfig();
    azureConfig.setResourceGroup("test-rg");
    azureConfig.setSubscriptionId("test-subscription");
    config.setAzureConfig(azureConfig);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "Valid Azure configuration should have no violations");
  }

  @Test
  @DisplayName("Test comprehensive valid configuration with warmup")
  public void testComprehensiveValidConfigurationWithWarmup() {
    CacheConfiguration config = new CacheConfiguration();

    // Basic cache configuration
    config.setEnabled(true);
    config.setProvider(CacheConfiguration.CacheProvider.REDIS_STANDALONE);
    config.setHost("localhost");
    config.setPort(6379);
    config.setAuthType(CacheConfiguration.AuthType.PASSWORD);
    config.setPassword("secure-password");
    config.setUseSsl(false);
    config.setDatabase(0);
    config.setTtlSeconds(7200);
    config.setConnectionTimeoutSecs(10);
    config.setSocketTimeoutSecs(120);
    config.setMaxRetries(5);

    // Warmup configuration
    config.setWarmupEnabled(true);
    config.setWarmupBatchSize(50);
    config.setWarmupThreads(4);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "Comprehensive valid configuration should have no violations");

    // Verify all values are set correctly
    assertTrue(config.isEnabled());
    assertEquals("localhost", config.getHost());
    assertEquals("secure-password", config.getPassword());
    assertTrue(config.isWarmupEnabled());
    assertEquals(50, config.getWarmupBatchSize());
    assertEquals(4, config.getWarmupThreads());
  }

  @Test
  @DisplayName("Test disabled cache configuration validation")
  public void testDisabledCacheConfigurationValidation() {
    CacheConfiguration config = new CacheConfiguration();
    config.setEnabled(false);

    Set<ConstraintViolation<CacheConfiguration>> violations = validator.validate(config);
    assertTrue(violations.isEmpty(), "Default disabled cache configuration should be valid");

    config.setPort(-1);
    config.setDatabase(100);
    config.setWarmupBatchSize(-5);
    config.setWarmupThreads(0);

    violations = validator.validate(config);
    assertFalse(
        violations.isEmpty(),
        "Invalid values should still cause violations even when cache is disabled");
  }
}
