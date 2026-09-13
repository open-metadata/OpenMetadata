package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.service.exception.CatalogExceptionMessage.entityNotFound;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import com.google.common.util.concurrent.UncheckedExecutionException;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.cache.NotFoundCache;
import org.openmetadata.service.config.CacheConfiguration;
import org.openmetadata.service.entity.cache.EntityCacheEpochs;
import org.openmetadata.service.entity.cache.EntityCacheKeys;
import org.openmetadata.service.entity.cache.EntityCacheLoaders;
import org.openmetadata.service.entity.cache.EntityCacheSource;
import org.openmetadata.service.entity.cache.EntityLocalCache;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.EntityDataDAOs.TableDAO;
import org.openmetadata.service.util.FreshReadScope;

class EntityLookupServiceTest {
  @Test
  void untouchedL1HitsReturnIndependentEntitiesWithoutRedisOrDatabaseReads() {
    final Fixture fixture = new Fixture();
    fixture.prime();
    final Table first = fixture.lookup.byId(fixture.id, Include.NON_DELETED, true);
    first.setDescription("Caller changed its copy");
    final Table second = fixture.lookup.byId(fixture.id, Include.NON_DELETED, true);
    final Table byName = fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, true);
    assertNotSame(first, second);
    assertNull(second.getDescription());
    assertEquals(second, byName);
    assertEquals(0, fixture.databaseReads.get());
    assertEquals(0, fixture.provider.reads.get());
  }

  @Test
  void writeEpochsMakeExistingNegativeMarkersEvictRacingL1Entries() {
    final Fixture fixture = new Fixture();
    fixture.prime();
    fixture.epochs.advance(Entity.TABLE, fixture.id, fixture.fqn);
    fixture.missing.markNotFoundById(Entity.TABLE, fixture.id);
    fixture.missing.markNotFoundByName(Entity.TABLE, fixture.fqn);
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byId(fixture.id, Include.NON_DELETED, true));
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, true));
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertNull(
        fixture.local.byName().getIfPresent(EntityCacheKeys.name(Entity.TABLE, fixture.fqn)));
    assertEquals(0, fixture.databaseReads.get());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void missingRowsAreRememberedAndRepeatedReadsAvoidTheDatabase(boolean cached) {
    final Fixture fixture = new Fixture();
    fixture.row = null;
    for (int attempt = 0; attempt < 2; attempt++) {
      assertThrows(
          EntityNotFoundException.class,
          () -> fixture.lookup.byId(fixture.id, Include.NON_DELETED, cached));
      assertThrows(
          EntityNotFoundException.class,
          () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, cached));
    }
    assertEquals(2, fixture.databaseReads.get());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void allAndDeletedReadsIgnoreNegativeMarkers(boolean cached) {
    final Fixture fixture = new Fixture();
    fixture.missing.markNotFoundById(Entity.TABLE, fixture.id);
    fixture.missing.markNotFoundByName(Entity.TABLE, fixture.fqn);
    fixture.row.setDeleted(true);
    assertTrue(fixture.lookup.byId(fixture.id, Include.ALL, cached).getDeleted());
    assertTrue(fixture.lookup.byName(fixture.fqn, Include.DELETED, cached).getDeleted());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void inclusionFiltersRemainEnforcedOnBothAliases(boolean cached) {
    final Fixture fixture = new Fixture();
    fixture.row.setDeleted(true);
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byId(fixture.id, Include.NON_DELETED, cached));
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, cached));
    fixture.local.byId().invalidateAll();
    fixture.local.byName().invalidateAll();
    fixture.row.setDeleted(false);
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byId(fixture.id, Include.DELETED, cached));
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byName(fixture.fqn, Include.DELETED, cached));
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void transientDatabaseFailuresNeverBecomeNegativeCacheEntries(boolean cached) {
    final Fixture fixture = new Fixture();
    fixture.databaseRead =
        () -> {
          throw new IllegalStateException("Database unavailable");
        };
    assertThrows(
        IllegalStateException.class,
        () -> fixture.lookup.byId(fixture.id, Include.NON_DELETED, cached));
    assertThrows(
        IllegalStateException.class,
        () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, cached));
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void freshReadsBypassAndEvictBothLocalAliases() {
    final Fixture fixture = new Fixture();
    fixture.prime();
    fixture.row.setDescription("Changed in the database");
    try (var ignored = FreshReadScope.enter()) {
      assertEquals(
          "Changed in the database",
          fixture.lookup.byId(fixture.id, Include.ALL, true).getDescription());
      assertEquals(
          "Changed in the database",
          fixture.lookup.byName(fixture.fqn, Include.ALL, true).getDescription());
    }
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
    assertNull(
        fixture.local.byName().getIfPresent(EntityCacheKeys.name(Entity.TABLE, fixture.fqn)));
    assertEquals(2, fixture.databaseReads.get());
  }

  @Test
  void aRacingLoaderFallsBackToTheFreshDatabasePath() {
    final Fixture fixture = new Fixture();
    fixture.databaseRead = () -> fixture.epochs.advance(Entity.TABLE, fixture.id, fixture.fqn);
    assertEquals(fixture.id, fixture.lookup.byId(fixture.id, Include.NON_DELETED, true).getId());
    assertEquals(
        fixture.fqn,
        fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, true).getFullyQualifiedName());
    assertEquals(4, fixture.databaseReads.get());
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void idRepairOnCacheBypassDoesNotMutateTheStoredRow() {
    final Fixture fixture = new Fixture();
    fixture.row.setId(null);
    assertEquals(fixture.id, fixture.lookup.byId(fixture.id, Include.ALL, false).getId());
    assertNull(fixture.row.getId());
  }

  @Test
  void aCachedRowWithoutItsIdReloadsTheDatabase() {
    final Fixture fixture = new Fixture();
    fixture
        .local
        .byId()
        .put(
            EntityCacheKeys.id(Entity.TABLE, fixture.id),
            JsonUtils.pojoToJson(new Table().withFullyQualifiedName(fixture.fqn)));
    assertEquals(fixture.id, fixture.lookup.byId(fixture.id, Include.NON_DELETED, true).getId());
    assertEquals(1, fixture.databaseReads.get());
    assertNull(fixture.local.byId().getIfPresent(EntityCacheKeys.id(Entity.TABLE, fixture.id)));
  }

  @Test
  void absentNegativeCacheAndProviderOutageLeaveDatabaseReadsAvailable() {
    final Fixture fixture = new Fixture();
    fixture.negativeEnabled = false;
    assertEquals(fixture.id, fixture.lookup.byId(fixture.id, Include.ALL, true).getId());
    fixture.negativeEnabled = true;
    fixture.provider.unavailable = true;
    fixture.row = null;
    assertThrows(
        EntityNotFoundException.class,
        () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, true));
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void flatNamesAreQuotedAndUserNegativeKeysAreCanonical() {
    final Fixture fixture = new Fixture();
    fixture.quoted = true;
    fixture.lookup.byName("name.with.dots", Include.ALL, false);
    assertEquals("\"name.with.dots\"", fixture.lastName);
    final Fixture user = new Fixture(Entity.USER);
    user.row = null;
    assertThrows(
        EntityNotFoundException.class,
        () -> user.lookup.byName("UPPER@example.com", Include.NON_DELETED, false));
    assertThrows(
        EntityNotFoundException.class,
        () -> user.lookup.byName("upper@example.com", Include.NON_DELETED, false));
    assertEquals(1, user.databaseReads.get());
  }

  @Test
  void explicitBypassKeepsDatabaseWrapperExceptionsWithoutNegativeCaching() {
    final Fixture fixture = new Fixture();
    final var failure =
        new UncheckedExecutionException(new EntityNotFoundException("DAO lookup failed"));
    fixture.databaseRead =
        () -> {
          throw failure;
        };
    assertSame(
        failure,
        assertThrows(
            UncheckedExecutionException.class,
            () -> fixture.lookup.byId(fixture.id, Include.NON_DELETED, false)));
    assertSame(
        failure,
        assertThrows(
            UncheckedExecutionException.class,
            () -> fixture.lookup.byName(fixture.fqn, Include.NON_DELETED, false)));
    assertTrue(fixture.provider.values.asMap().isEmpty());
  }

  @Test
  void defaultLookupsAndIdReferencesKeepTheL1FirstPath() {
    final Fixture fixture = new Fixture();
    fixture.prime();
    final Table byId = fixture.lookup.byId(fixture.id, Include.NON_DELETED);
    final Table byName = fixture.lookup.byName(fixture.fqn, Include.NON_DELETED);
    final EntityReference reference = fixture.lookup.referenceById(fixture.id, Include.NON_DELETED);
    assertEquals(byId, byName);
    assertNotSame(byId, byName);
    assertEquals(fixture.id, reference.getId());
    assertEquals(fixture.fqn, reference.getFullyQualifiedName());
    assertEquals(0, fixture.databaseReads.get());
    assertEquals(0, fixture.provider.reads.get());
  }

  @Test
  void nullableNameLookupOnlyConvertsNotFoundAndRetainsNegativeCaching() {
    final Fixture fixture = new Fixture();
    fixture.row = null;
    assertNull(fixture.lookup.byNameOrNull(fixture.fqn, Include.NON_DELETED));
    assertNull(fixture.lookup.byNameOrNull(fixture.fqn, Include.NON_DELETED));
    assertEquals(1, fixture.databaseReads.get());
    final var unavailable = new IllegalStateException("Database unavailable");
    fixture.databaseRead =
        () -> {
          throw unavailable;
        };
    assertSame(
        unavailable,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.lookup.byNameOrNull("another.table", Include.NON_DELETED)));
  }

  @Test
  void batchEntitiesRetainDaoOrderDuplicatesAndMutableResults() {
    final Fixture fixture = new Fixture();
    fixture.prime();
    final List<UUID> ids = List.of(fixture.id, fixture.id);
    final List<Table> rows = new ArrayList<>(List.of(fixture.row, fixture.row));
    when(fixture.dao.findEntitiesByIds(anyList(), any(Include.class)))
        .thenAnswer(
            call -> {
              assertSame(ids, call.getArgument(0));
              assertSame(Include.DELETED, call.getArgument(1));
              return rows;
            });
    assertSame(rows, fixture.lookup.byIds(ids, Include.DELETED));
    assertEquals(0, fixture.databaseReads.get());
    assertEquals(0, fixture.provider.reads.get());
  }

  @Test
  void batchReferencesUseTheirProjectionWithoutLoadingCanonicalRows() {
    final Fixture fixture = new Fixture();
    final List<UUID> ids = List.of(fixture.id, fixture.id);
    final EntityReference reference = new EntityReference().withId(fixture.id);
    final List<EntityReference> references = List.of(reference, reference);
    when(fixture.dao.findReferencesByIds(anyList(), any(Include.class)))
        .thenAnswer(
            call -> {
              assertSame(ids, call.getArgument(0));
              assertSame(Include.ALL, call.getArgument(1));
              return references;
            });
    assertSame(references, fixture.lookup.referencesByIds(ids, Include.ALL));
    assertEquals(0, fixture.databaseReads.get());
    assertEquals(0, fixture.provider.reads.get());
  }

  @ParameterizedTest
  @ValueSource(booleans = {true, false})
  void nameReferencesPreserveQuotingFirstResultAndUncachedProjection(boolean quoted) {
    final Fixture fixture = new Fixture();
    fixture.quoted = quoted;
    fixture.prime();
    final String name = quoted ? "\"name.with.dots\"" : "name.with.dots";
    final var reads = new AtomicInteger();
    final EntityReference first = new EntityReference().withId(fixture.id);
    when(fixture.dao.findReferencesByFqns(anyList(), any(Include.class)))
        .thenAnswer(
            call -> {
              assertEquals(List.of(name), call.getArgument(0));
              assertSame(Include.ALL, call.getArgument(1));
              reads.incrementAndGet();
              return List.of(first, new EntityReference().withId(UUID.randomUUID()));
            });
    assertSame(first, fixture.lookup.referenceByName("name.with.dots", Include.ALL));
    assertSame(first, fixture.lookup.referenceByName("name.with.dots", Include.ALL));
    assertEquals(2, reads.get());
    assertEquals(0, fixture.databaseReads.get());
    assertEquals(0, fixture.provider.reads.get());
    doReturn(List.of()).when(fixture.dao).findReferencesByFqns(anyList(), any(Include.class));
    final var missing =
        assertThrows(
            EntityNotFoundException.class,
            () -> fixture.lookup.referenceByName("name.with.dots", Include.NON_DELETED));
    assertEquals(entityNotFound(Entity.TABLE, name), missing.getMessage());
    final var unavailable = new IllegalStateException("Database unavailable");
    doThrow(unavailable).when(fixture.dao).findReferencesByFqns(anyList(), any(Include.class));
    assertSame(
        unavailable,
        assertThrows(
            IllegalStateException.class,
            () -> fixture.lookup.referenceByName("name.with.dots", Include.ALL)));
  }

  private static final class Fixture {

    private final UUID id = UUID.randomUUID();
    private final String fqn = "service.table";
    private Table row = new Table().withId(id).withName("table").withFullyQualifiedName(fqn);
    private final AtomicInteger databaseReads = new AtomicInteger();
    private Runnable databaseRead = () -> {};
    private String lastName;
    private boolean quoted;
    private boolean negativeEnabled = true;
    private final EntityCacheEpochs epochs = new EntityCacheEpochs();
    private final Provider provider = new Provider();
    private final NotFoundCache missing =
        new NotFoundCache(provider, new CacheKeys("om:lookup-test"), new CacheConfig());
    private final EntityLocalCache local;
    private final EntityLookupService<Table> lookup;
    private final TableDAO dao = mock(TableDAO.class);

    private Fixture() {
      this(Entity.TABLE);
    }

    private Fixture(String type) {
      when(dao.getTableName()).thenReturn("table_entity");
      when(dao.getNameHashColumn()).thenReturn("fqnHash");
      when(dao.getCondition(Include.ALL)).thenReturn("");
      when(dao.findById(anyString(), any(UUID.class), anyString()))
          .thenAnswer(ignored -> JsonUtils.pojoToJson(read()));
      when(dao.findByName(anyString(), anyString(), anyString(), anyString()))
          .thenAnswer(ignored -> JsonUtils.pojoToJson(read()));
      when(dao.findEntityById(any(UUID.class), any(Include.class))).thenAnswer(ignored -> read());
      when(dao.findEntityByName(anyString(), any(Include.class)))
          .thenAnswer(
              invocation -> {
                lastName = invocation.getArgument(0);
                return read();
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
      final var loaders = new EntityCacheLoaders(ignored -> source, () -> null, epochs);
      local = new EntityLocalCache(loaders::byId, loaders::byName, new CacheConfiguration());
      lookup =
          new EntityLookupService<>(
              new EntityLookupService.Schema<>(type, Table.class, () -> quoted),
              dao,
              new EntityLookupService.Caches(
                  local::byId, local::byName, () -> negativeEnabled ? missing : null, epochs));
    }

    private Table read() {
      databaseReads.incrementAndGet();
      databaseRead.run();
      return row == null ? null : JsonUtils.deepCopy(row, Table.class);
    }

    private void prime() {
      final String json = JsonUtils.pojoToJson(row);
      local.byId().put(EntityCacheKeys.id(Entity.TABLE, id), json);
      local.byName().put(EntityCacheKeys.name(Entity.TABLE, fqn), json);
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private final AtomicInteger reads = new AtomicInteger();
    private boolean unavailable;

    @Override
    public boolean available() {
      return !unavailable;
    }

    @Override
    public Optional<String> get(String key) {
      reads.incrementAndGet();
      return Optional.ofNullable(values.getIfPresent(key));
    }

    @Override
    public void set(String key, String value, Duration ttl) {
      values.put(key, value);
    }

    @Override
    public void del(String... keys) {
      values.invalidateAll(List.of(keys));
    }
  }
}
