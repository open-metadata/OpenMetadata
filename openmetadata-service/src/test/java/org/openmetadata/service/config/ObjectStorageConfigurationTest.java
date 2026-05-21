package org.openmetadata.service.config;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import jakarta.validation.ConstraintViolation;
import jakarta.validation.Validation;
import jakarta.validation.Validator;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ObjectStorageConfigurationTest {
  private final Validator validator = Validation.buildDefaultValidatorFactory().getValidator();

  @Test
  void s3ProviderDoesNotValidateAzureCredentials() {
    ObjectStorageConfiguration config = baseConfig("s3");
    config.setS3Configuration(s3Config());
    config.setAzureConfiguration(azureConfigWithoutCredentials("missing-endpoint"));

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
