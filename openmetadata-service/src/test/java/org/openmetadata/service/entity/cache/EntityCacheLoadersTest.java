package org.openmetadata.service.entity.cache;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedEntityDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDataDAOs.TableDAO;

class EntityCacheLoadersTest {
  @Test
  void idMissPopulatesRedisAndTheNextLoadUsesIt() {
    final Fixture fixture = new Fixture();
    assertEquals(fixture.json, fixture.loadId());
    assertEquals(fixture.json, fixture.cache.getBase(fixture.id, Entity.TABLE).orElseThrow());
    fixture.failDatabase();
    assertEquals(fixture.json, fixture.loadId());
  }

  @Test
  void nameMissPopulatesBothAliasesAndTheNextLoadUsesRedis() {
    final Fixture fixture = new Fixture();
    assertEquals(fixture.json, fixture.loadName());
    assertEquals(fixture.json, fixture.cache.getByName(Entity.TABLE, fixture.fqn).orElseThrow());
    assertEquals(fixture.json, fixture.cache.getBase(fixture.id, Entity.TABLE).orElseThrow());
    fixture.failDatabase();
    assertEquals(fixture.json, fixture.loadName());
  }

  @ParameterizedTest
  @ValueSource(strings = {"invalid-json", "{\"fullyQualifiedName\":\"service.table\"}"})
  void invalidIdEntriesAreReplacedFromTheDatabase(String invalid) {
    final Fixture fixture = new Fixture();
    fixture.cache.putBase(Entity.TABLE, fixture.id, invalid);
    assertEquals(fixture.json, fixture.loadId());
    assertEquals(fixture.json, fixture.cache.getBase(fixture.id, Entity.TABLE).orElseThrow());
  }

  @ParameterizedTest
  @ValueSource(
      strings = {
        "invalid-json",
        "{\"fullyQualifiedName\":\"service.table\"}",
        "{\"id\":\"b850a2ab-a29c-4550-bbc7-ac72e49e8145\"}"
      })
  void invalidNameEntriesAreReplacedFromTheDatabase(String invalid) {
    final Fixture fixture = new Fixture();
    fixture.cache.putByName(Entity.TABLE, fixture.fqn, invalid);
    assertEquals(fixture.json, fixture.loadName());
    assertEquals(fixture.json, fixture.cache.getByName(Entity.TABLE, fixture.fqn).orElseThrow());
  }

  @Test
  void idRowsWithMissingIdsAreRepairedBeforePublication() {
    final Fixture fixture = new Fixture();
    fixture.json =
        JsonUtils.pojoToJson(new Table().withName("table").withFullyQualifiedName(fixture.fqn));
    final Table repaired = JsonUtils.readValue(fixture.loadId(), Table.class);
    assertEquals(fixture.id, repaired.getId());
    assertEquals(fixture.fqn, repaired.getFullyQualifiedName());
    assertEquals(
        repaired,
        JsonUtils.readValue(
            fixture.cache.getBase(fixture.id, Entity.TABLE).orElseThrow(), Table.class));
  }

  @Test
  void incompleteDatabaseRowsAreNotCached() {
    final Fixture fixture = new Fixture();
    fixture.json = JsonUtils.pojoToJson(new Table().withId(fixture.id));
    assertThrows(IllegalStateException.class, fixture::loadId);
    assertThrows(IllegalStateException.class, fixture::loadName);
    assertTrue(fixture.cache.getBase(fixture.id, Entity.TABLE).isEmpty());
    assertTrue(fixture.cache.getByName(Entity.TABLE, fixture.fqn).isEmpty());
  }

  @Test
  void missingDatabaseRowsRetainNotFoundSemantics() {
    final Fixture fixture = new Fixture();
    fixture.json = null;
    assertThrows(EntityNotFoundException.class, fixture::loadId);
    assertThrows(EntityNotFoundException.class, fixture::loadName);
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void transientDatabaseErrorsAreNotConvertedToMissingEntities() {
    final Fixture fixture = new Fixture();
    fixture.failDatabase();
    assertThrows(IllegalStateException.class, fixture::loadId);
    assertThrows(IllegalStateException.class, fixture::loadName);
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void disabledCacheAndBypassLoadTheDatabaseWithoutPublishing() {
    final Fixture fixture = new Fixture();
    fixture.cacheEnabled = false;
    assertEquals(fixture.json, fixture.loadId());
    assertEquals(fixture.json, fixture.loadName());
    fixture.cacheEnabled = true;
    try (var ignored = EntityCacheBypass.skip()) {
      assertEquals(fixture.json, fixture.loadId());
      assertEquals(fixture.json, fixture.loadName());
    }
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void excludedTypesNeverConsultOrPopulateRedis() {
    final Fixture fixture = new Fixture();
    fixture.provider.read =
        () -> {
          throw new AssertionError("Excluded type accessed Redis");
        };
    assertEquals(fixture.json, fixture.loaders.byId(EntityCacheKeys.id(Entity.USER, fixture.id)));
    assertEquals(fixture.json, fixture.loaders.byName(EntityCacheKeys.name(Entity.USER, "UPPER")));
    assertEquals("upper", fixture.lastNameLookup);
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void aDatabaseWriteRacePreventsEitherAliasFromBeingPublished() {
    final Fixture fixture = new Fixture();
    fixture.databaseRead = () -> fixture.epochs.advance(Entity.TABLE, fixture.id, fixture.fqn);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadId);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadName);
    assertTrue(fixture.cache.getBase(fixture.id, Entity.TABLE).isEmpty());
    assertTrue(fixture.cache.getByName(Entity.TABLE, fixture.fqn).isEmpty());
  }

  @Test
  void aRemoteInvalidationDuringARedisHitRejectsTheStaleValue() {
    final Fixture fixture = new Fixture();
    fixture.loadName();
    fixture.provider.read = () -> fixture.epochs.advance(Entity.TABLE, fixture.id, fixture.fqn);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadId);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadName);
    fixture.provider.read = () -> {};
    assertTrue(fixture.cache.getBase(fixture.id, Entity.TABLE).isEmpty());
    assertTrue(fixture.cache.getByName(Entity.TABLE, fixture.fqn).isEmpty());
  }

  @Test
  void aRaceWithoutRedisStillRejectsTheStaleDatabaseRead() {
    final Fixture fixture = new Fixture();
    fixture.cacheEnabled = false;
    fixture.databaseRead = () -> fixture.epochs.advance(Entity.TABLE, fixture.id, fixture.fqn);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadId);
    assertThrows(EntityCacheLoaders.LoaderRaceException.class, fixture::loadName);
  }

  @Test
  void cachePolicyKeepsTheExistingExcludedTypes() {
    final List<String> excluded =
        List.of(
            Entity.USER,
            Entity.TASK,
            Entity.WORKFLOW,
            Entity.WORKFLOW_DEFINITION,
            Entity.WORKFLOW_INSTANCE,
            Entity.WORKFLOW_INSTANCE_STATE,
            Entity.TEST_CASE_RESOLUTION_STATUS,
            Entity.BOT,
            Entity.DOMAIN,
            Entity.DATA_PRODUCT);
    excluded.forEach(type -> assertFalse(EntityCachePolicy.isCacheable(type)));
    assertFalse(EntityCachePolicy.isCacheable(null));
    assertTrue(EntityCachePolicy.isCacheable(Entity.TABLE));
    assertTrue(EntityCachePolicy.isCacheable(Entity.PIPELINE));
  }

  private static final class Fixture {
    private final UUID id = UUID.randomUUID();
    private final String fqn = "service.table";
    private String json =
        JsonUtils.pojoToJson(new Table().withId(id).withName("table").withFullyQualifiedName(fqn));
    private Runnable databaseRead = () -> {};
    private String lastNameLookup;
    private boolean cacheEnabled = true;
    private final EntityCacheEpochs epochs = new EntityCacheEpochs();
    private final Provider provider = new Provider();
    private final CachedEntityDao cache =
        new CachedEntityDao(provider, new CacheKeys("om:loader-test"), new CacheConfig());
    private final EntityCacheLoaders loaders;

    private Fixture() {
      final TableDAO dao = mock(TableDAO.class);
      when(dao.getTableName()).thenReturn("table_entity");
      when(dao.getNameHashColumn()).thenReturn("fqnHash");
      when(dao.getCondition(Include.ALL)).thenReturn("");
      when(dao.findById(anyString(), any(UUID.class), anyString()))
          .thenAnswer(
              ignored -> {
                databaseRead.run();
                return json;
              });
      when(dao.findByName(anyString(), anyString(), anyString(), anyString()))
          .thenAnswer(
              invocation -> {
                lastNameLookup = invocation.getArgument(2);
                databaseRead.run();
                return json;
              });
      final EntityCacheSource source =
          new EntityCacheSource() {
            @Override
            public TableDAO getDao() {
              return dao;
            }

            @Override
            public Class<Table> getEntityClass() {
              return Table.class;
            }
          };
      loaders = new EntityCacheLoaders(type -> source, () -> cacheEnabled ? cache : null, epochs);
    }

    private String loadId() {
      return loaders.byId(EntityCacheKeys.id(Entity.TABLE, id));
    }

    private String loadName() {
      return loaders.byName(EntityCacheKeys.name(Entity.TABLE, fqn));
    }

    private void failDatabase() {
      databaseRead =
          () -> {
            throw new IllegalStateException("Database unavailable");
          };
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private Runnable read = () -> {};

    @Override
    public Optional<String> get(String key) {
      final String value = values.getIfPresent(key);
      read.run();
      return Optional.ofNullable(value);
    }

    @Override
    public Optional<String> hget(String key, String field) {
      return get(key);
    }

    @Override
    public void set(String key, String value, Duration ttl) {
      values.put(key, value);
    }

    @Override
    public void hset(String key, Map<String, String> fields, Duration ttl) {
      values.put(key, fields.get("base"));
    }

    @Override
    public void del(String... keys) {
      values.invalidateAll(List.of(keys));
    }
  }
}
