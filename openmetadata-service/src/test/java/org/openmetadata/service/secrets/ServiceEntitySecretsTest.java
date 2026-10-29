package org.openmetadata.service.secrets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.macasaet.fernet.Key;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.stream.Collectors;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.parallel.Isolated;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.api.services.CreateDatabaseService.DatabaseServiceType;
import org.openmetadata.schema.api.services.DatabaseConnection;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ServiceType;
import org.openmetadata.schema.services.connections.database.SnowflakeConnection;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.fernet.Fernet;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.jdbi3.ServiceEntityRepository;

@Isolated("swaps the process-wide secrets manager and repository registry")
class ServiceEntitySecretsTest {
  private static final String CLUSTER = "service-secret-tests";
  private static final String SERVICE_NAME = "warehouse";
  private static final String PASSWORD = "original-password";
  private static final String SECRET_ID = "/" + CLUSTER + "/database/" + SERVICE_NAME + "/password";
  private static final String FERNET_KEY = "mFNuF9gyyS4zNItmwvFq8wAf9TUFnNwj6m6pW1P5RjE=";

  private final List<String> storedJson = new ArrayList<>();
  private SecretsManager originalManager;
  private List<Key> originalKeys;
  private InMemorySecretsManager vault;
  private StorageRepository repository;

  @BeforeEach
  void setUp() {
    originalManager = SecretsManagerFactory.getSecretsManager();
    originalKeys = Fernet.getInstance().getCachedKeys();
    Fernet.getInstance().setFernetKey(FERNET_KEY);
    vault =
        new InMemorySecretsManager(
            new SecretsManager.SecretsConfig(CLUSTER, null, List.of(), null));
    SecretsManagerFactory.setSecretsManager(vault);
    CollectionDAO collection = mock(CollectionDAO.class);
    CollectionDAO.DatabaseServiceDAO dao = mock(CollectionDAO.DatabaseServiceDAO.class);
    when(dao.getEntityClass()).thenReturn(DatabaseService.class);
    when(dao.getTableName()).thenReturn("dbservice_entity");
    when(dao.getNameHashColumn()).thenReturn("nameHash");
    recordWrites(dao);
    Entity.setCollectionDAO(collection);
    repository = new StorageRepository(dao);
  }

  private void recordWrites(CollectionDAO.DatabaseServiceDAO dao) {
    doAnswer(call -> storedJson.add(call.getArgument(3)))
        .when(dao)
        .insert(anyString(), anyString(), anyString(), anyString());
    doAnswer(call -> storedJson.add(call.getArgument(2)))
        .when(dao)
        .update(any(UUID.class), anyString(), anyString());
    when(dao.updateWithVersion(
            anyString(), anyString(), anyString(), anyString(), anyString(), anyString()))
        .thenAnswer(
            call -> {
              storedJson.add(call.getArgument(4));
              return 1;
            });
    doAnswer(call -> storedJson.addAll(call.getArgument(3)))
        .when(dao)
        .insertMany(anyString(), anyString(), anyList(), anyList());
    doAnswer(call -> storedJson.addAll(call.getArgument(4)))
        .when(dao)
        .updateMany(anyString(), anyString(), anyList(), anyList(), anyList());
  }

  @AfterEach
  void tearDown() {
    SecretsManagerFactory.setSecretsManager(originalManager);
    Fernet.getInstance()
        .setFernetKey(
            originalKeys == null
                ? null
                : originalKeys.stream().map(Key::serialise).collect(Collectors.joining(",")));
    Entity.cleanup();
    Entity.setCollectionDAO(null);
  }

  @ParameterizedTest
  @ValueSource(booleans = {false, true})
  void preparingAServiceDoesNotCreateAVaultEntry(boolean update) {
    DatabaseService service = service(PASSWORD);

    repository.prepare(service, update);

    assertTrue(vault.getSecretsMap().isEmpty());
    assertInstanceOf(SnowflakeConnection.class, service.getConnection().getConfig());
  }

  @ParameterizedTest
  @ValueSource(strings = {"replacement-password", ""})
  void preparingAnUpdateLeavesTheVaultUntouched(String incomingPassword) {
    vault.upsertSecret(SECRET_ID, PASSWORD);
    DatabaseService service = service(incomingPassword);

    repository.prepare(service, true);

    assertEquals(Map.of(SECRET_ID, PASSWORD), vault.getSecretsMap());
    assertInstanceOf(SnowflakeConnection.class, service.getConnection().getConfig());
  }

  @ParameterizedTest
  @EnumSource(StoragePath.class)
  void everyStoragePathEncryptsCredentialsBeforeWritingTheRow(StoragePath path) {
    DatabaseService service = service(PASSWORD);

    repository.write(service, path);

    assertEquals(Map.of(SECRET_ID, PASSWORD), vault.getSecretsMap());
    assertEquals(1, storedJson.size());
    DatabaseService stored = JsonUtils.readValue(storedJson.getFirst(), DatabaseService.class);
    String storedPassword =
        JsonUtils.convertValue(stored.getConnection().getConfig(), SnowflakeConnection.class)
            .getPassword();
    assertTrue(Fernet.isTokenized(storedPassword));
    assertEquals(
        SecretsManager.SECRET_FIELD_PREFIX + SECRET_ID,
        Fernet.getInstance().decrypt(storedPassword));
  }

  @ParameterizedTest
  @EnumSource(StoragePath.class)
  void everyStoragePathAcceptsAServiceWithoutAConnection(StoragePath path) {
    repository.write(service(PASSWORD).withConnection(null), path);

    assertTrue(vault.getSecretsMap().isEmpty());
    assertEquals(1, storedJson.size());
  }

  private static DatabaseService service(String password) {
    return new DatabaseService()
        .withId(UUID.randomUUID())
        .withName(SERVICE_NAME)
        .withFullyQualifiedName(SERVICE_NAME)
        .withServiceType(DatabaseServiceType.Snowflake)
        .withConnection(
            new DatabaseConnection().withConfig(new SnowflakeConnection().withPassword(password)));
  }

  private enum StoragePath {
    CREATE,
    UPDATE,
    VERSIONED_UPDATE,
    BULK_CREATE,
    BULK_UPDATE
  }

  private static class StorageRepository
      extends ServiceEntityRepository<DatabaseService, DatabaseConnection> {
    StorageRepository(CollectionDAO.DatabaseServiceDAO dao) {
      super(
          "/v1/services/databaseServices/",
          Entity.DATABASE_SERVICE,
          dao,
          DatabaseConnection.class,
          "",
          ServiceType.DATABASE);
    }

    void write(DatabaseService service, StoragePath path) {
      switch (path) {
        case CREATE -> storeEntity(service, false);
        case UPDATE -> storeEntity(service, true);
        case VERSIONED_UPDATE -> storeEntityWithVersion(service, true, 0.1, 1L);
        case BULK_CREATE -> storeEntities(List.of(service));
        case BULK_UPDATE -> updateMany(List.of(service));
      }
    }
  }
}
