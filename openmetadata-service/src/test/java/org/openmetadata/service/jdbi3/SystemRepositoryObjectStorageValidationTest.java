package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.mockStatic;
import static org.mockito.Mockito.when;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.openmetadata.schema.system.StepValidation;
import org.openmetadata.service.Entity;
import org.openmetadata.service.OpenMetadataApplicationConfig;
import org.openmetadata.service.attachments.AssetServiceFactory;
import org.openmetadata.service.config.ObjectStorageConfiguration;
import org.openmetadata.service.jdbi3.CollectionDAO.SystemDAO;
import org.openmetadata.service.migration.MigrationValidationClient;

/**
 * Validates the /system/validate "Object Storage" step against the REAL AssetServiceFactory and
 * InMemoryAssetService (live write/read/delete probe) — only the repository bootstrap is mocked.
 */
class SystemRepositoryObjectStorageValidationTest {

  private MockedStatic<Entity> entityMock;
  private MockedStatic<MigrationValidationClient> migrationMock;
  private SystemRepository systemRepository;
  private OpenMetadataApplicationConfig appConfig;

  @BeforeEach
  void setup() {
    entityMock = mockStatic(Entity.class);
    migrationMock = mockStatic(MigrationValidationClient.class);

    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    SystemDAO systemDAO = mock(SystemDAO.class);
    when(collectionDAO.systemDAO()).thenReturn(systemDAO);
    entityMock.when(Entity::getCollectionDAO).thenReturn(collectionDAO);

    MigrationValidationClient migrationClient = mock(MigrationValidationClient.class);
    migrationMock.when(MigrationValidationClient::getInstance).thenReturn(migrationClient);

    appConfig = mock(OpenMetadataApplicationConfig.class);
    systemRepository = new SystemRepository();
    AssetServiceFactory.shutdown();
  }

  @AfterEach
  void tearDown() {
    AssetServiceFactory.shutdown();
    entityMock.close();
    migrationMock.close();
  }

  @Test
  void failsWhenObjectStorageIsDisabled() {
    ObjectStorageConfiguration storageConfig = new ObjectStorageConfiguration();
    storageConfig.setEnabled(false);
    when(appConfig.getObjectStorage()).thenReturn(storageConfig);

    StepValidation result = systemRepository.getObjectStorageValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("disabled"));
  }

  @Test
  void failsWhenObjectStorageConfigurationIsMissing() {
    when(appConfig.getObjectStorage()).thenReturn(null);

    StepValidation result = systemRepository.getObjectStorageValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("disabled"));
  }

  @Test
  void failsWhenFactoryHoldsNoOpProvider() {
    ObjectStorageConfiguration disabled = new ObjectStorageConfiguration();
    disabled.setEnabled(false);
    when(appConfig.getObjectStorage()).thenReturn(disabled);
    AssetServiceFactory.init(appConfig);

    ObjectStorageConfiguration claimedEnabled = new ObjectStorageConfiguration();
    claimedEnabled.setEnabled(true);
    claimedEnabled.setProvider("s3");
    when(appConfig.getObjectStorage()).thenReturn(claimedEnabled);

    StepValidation result = systemRepository.getObjectStorageValidation(appConfig);

    assertFalse(result.getPassed());
    assertTrue(result.getMessage().contains("NOOP"));
  }

  @Test
  void passesLiveRoundTripProbeWithInMemoryProvider() {
    ObjectStorageConfiguration storageConfig = new ObjectStorageConfiguration();
    storageConfig.setEnabled(true);
    storageConfig.setProvider("inmemory");
    when(appConfig.getObjectStorage()).thenReturn(storageConfig);
    AssetServiceFactory.init(appConfig);

    StepValidation result = systemRepository.getObjectStorageValidation(appConfig);

    assertTrue(result.getPassed(), "Probe should succeed: " + result.getMessage());
    assertTrue(result.getMessage().contains("inmemory"));
  }
}
