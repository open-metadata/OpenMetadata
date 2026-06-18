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

package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.dataformat.yaml.YAMLFactory;
import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.io.IOException;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullAndEmptySource;
import org.junit.jupiter.params.provider.ValueSource;

class ObjectStorageConfigurationTest {
  private final ObjectMapper yamlMapper = new ObjectMapper(new YAMLFactory());
  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void s3ProviderIgnoresInvalidAzureConfiguration() {
    ObjectStorageConfiguration config = baseConfig("s3");
    config.setS3Configuration(s3Config());
    config.setAzureConfiguration(new AzureConfiguration());

    assertTrue(validate(config).isEmpty());
  }

  @Test
  void azureProviderUsesDefaultAzureCredentialAndDoesNotRequireLegacyCredentials() {
    ObjectStorageConfiguration config = baseConfig("azure");
    config.setAzureConfiguration(
        azureConfigWithoutCredentials("https://account.blob.core.windows.net"));

    assertTrue(validate(config).isEmpty());
  }

  @Test
  void legacyAzureCredentialFieldsDeserializeButAreNotRequired() throws IOException {
    ObjectStorageConfiguration config =
        yamlMapper.readValue(
            """
            enabled: true
            provider: azure
            azure:
              containerName: assets
              blobEndpoint: https://account.blob.core.windows.net
              connectionString: DefaultEndpointsProtocol=https;AccountName=legacy;AccountKey=key
              useManagedIdentity: true
              clientId: legacy-client
              tenantId: legacy-tenant
              clientSecret: legacy-secret
            """,
            ObjectStorageConfiguration.class);

    assertTrue(validate(config).isEmpty());
  }

  @Test
  void azureProviderRequiresBlobEndpoint() {
    ObjectStorageConfiguration config = baseConfig("azure");
    config.setAzureConfiguration(azureConfigWithoutCredentials(""));

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "Azure configuration requires containerName and blobEndpoint", message(violations));
  }

  @Test
  void minioProviderIsRejectedAsUnsupportedProvider() {
    ObjectStorageConfiguration config = baseConfig("minio");

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "Object storage provider must be one of: s3, azure, inmemory, in-memory, noop",
        message(violations));
  }

  @ParameterizedTest
  @NullAndEmptySource
  @ValueSource(strings = {" ", "\t"})
  void enabledObjectStorageRequiresProvider(String provider) {
    ObjectStorageConfiguration config = baseConfig(provider);

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "Object storage provider must be configured when object storage is enabled",
        message(violations));
  }

  @Test
  void providerValidationNormalizesWhitespaceAndCase() {
    ObjectStorageConfiguration config = baseConfig(" S3 ");
    config.setS3Configuration(s3Config());

    assertTrue(validate(config).isEmpty());
  }

  @Test
  void azureProviderRequiresAzureConfiguration() {
    ObjectStorageConfiguration config = baseConfig("azure");

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "Azure configuration requires containerName and blobEndpoint", message(violations));
  }

  @Test
  void azureProviderRequiresContainerName() {
    ObjectStorageConfiguration config = baseConfig("azure");
    AzureConfiguration azureConfiguration =
        azureConfigWithoutCredentials("https://account.blob.core.windows.net");
    azureConfiguration.setContainerName("");
    config.setAzureConfiguration(azureConfiguration);

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "Azure configuration requires containerName and blobEndpoint", message(violations));
  }

  @Test
  void s3ProviderRequiresS3Configuration() {
    ObjectStorageConfiguration config = baseConfig("s3");

    Set<ConstraintViolation<ObjectStorageConfiguration>> violations = validate(config);

    assertEquals(1, violations.size());
    assertEquals(
        "S3 configuration requires bucketName, region, and either useIamRole=true or both"
            + " accessKey and secretKey",
        message(violations));
  }

  @Test
  void disabledObjectStorageSkipsProviderSpecificValidation() {
    ObjectStorageConfiguration config = new ObjectStorageConfiguration();
    config.setEnabled(false);

    assertTrue(validate(config).isEmpty());
  }

  @ParameterizedTest
  @ValueSource(strings = {"inmemory", "in-memory", "noop"})
  void localProvidersSkipS3AndAzureConfigurationValidation(String provider) {
    ObjectStorageConfiguration config = baseConfig(provider);

    assertTrue(validate(config).isEmpty());
  }

  private Set<ConstraintViolation<ObjectStorageConfiguration>> validate(
      ObjectStorageConfiguration config) {
    return validator.validate(config);
  }

  private ObjectStorageConfiguration baseConfig(String provider) {
    ObjectStorageConfiguration config = new ObjectStorageConfiguration();
    config.setEnabled(true);
    config.setProvider(provider);
    return config;
  }

  private S3Configuration s3Config() {
    S3Configuration config = new S3Configuration();
    config.setBucketName("assets");
    config.setRegion("us-east-1");
    config.setAccessKey("access-key");
    config.setSecretKey("secret-key");
    return config;
  }

  private AzureConfiguration azureConfigWithoutCredentials(String blobEndpoint) {
    AzureConfiguration config = new AzureConfiguration();
    config.setContainerName("assets");
    config.setBlobEndpoint(blobEndpoint);
    return config;
  }

  private String message(Set<ConstraintViolation<ObjectStorageConfiguration>> violations) {
    return violations.iterator().next().getMessage();
  }
}
