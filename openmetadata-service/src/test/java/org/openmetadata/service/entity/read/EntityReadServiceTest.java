package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.schema.utils.EntityInterfaceUtil.quoteName;

import jakarta.ws.rs.core.UriInfo;
import java.net.URI;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.Include;
import org.openmetadata.service.Entity;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.util.EntityUtil.Fields;
import org.openmetadata.service.util.EntityUtil.RelationIncludes;
import org.openmetadata.service.util.FreshReadScope;
import org.openmetadata.service.util.RequestEntityCache;

class EntityReadServiceTest {
  @AfterEach
  void clearReadState() {
    RequestEntityCache.clear();
    ReadBundleContext.clear();
  }

  @Test
  void idReadsHydrateBeforePublishingBothAliasesAndReturnIndependentDtos() {
    final Fixture fixture = new Fixture();
    final Table first = fixture.service.byId(fixture.id, fixture.query());
    assertEquals("stored:fields:inherited", first.getDescription());
    assertNull(first.getExtension());
    final Table byName = fixture.service.byName(fixture.name, fixture.query());
    assertEquals(first, byName);
    assertNotSame(first, byName);
    byName.setDescription("changed by caller");
    assertEquals(
        first.getDescription(), fixture.service.byId(fixture.id, fixture.query()).getDescription());
    assertEquals(1, fixture.reads.size());
    assertTrue(fixture.invalidations.isEmpty());
    assertNull(ReadBundleContext.getCurrent());
  }

  @Test
  void nameReadsPublishTheIdAliasAndNormalizeQuotedNamesBeforeLookup() {
    final Fixture fixture = new Fixture();
    fixture.quoteNames = true;
    fixture.name = "catalog.name";
    final Table first = fixture.service.byName(fixture.name, fixture.query());
    assertEquals(quoteName(fixture.name), fixture.reads.getFirst().key());
    assertEquals(first, fixture.service.byId(fixture.id, fixture.query()));
    assertEquals(first, fixture.service.byName(quoteName(fixture.name), fixture.query()));
    assertEquals(1, fixture.reads.size());
  }

  @Test
  void uncachedIdAndNameReadsInvalidateOnlyTheirOwnLocalAlias() {
    final Fixture fixture = new Fixture();
    fixture.fromCache = false;
    fixture.service.byId(fixture.id, fixture.query());
    fixture.service.byName(fixture.name, fixture.query());
    assertEquals(List.of("id:" + fixture.id), fixture.invalidations);
    RequestEntityCache.clear();
    fixture.service.byName(fixture.name, fixture.query());
    assertEquals(List.of("id:" + fixture.id, "name:" + fixture.name), fixture.invalidations);
    assertFalse(fixture.reads.getFirst().fromCache());
  }

  @Test
  void freshScopesKeepTheSeparateRequestProjectionAndExistingReuse() {
    final Fixture fixture = new Fixture();
    fixture.service.byId(fixture.id, fixture.query());
    try (var ignored = FreshReadScope.enter()) {
      fixture.service.byId(fixture.id, fixture.query());
      fixture.service.byName(fixture.name, fixture.query());
    }
    assertEquals(List.of(true, false), fixture.reads.stream().map(Read::fromCache).toList());
    assertEquals(List.of("id:" + fixture.id), fixture.invalidations);
    fixture.service.byName(fixture.name, fixture.query());
    assertEquals(2, fixture.reads.size());
  }

  @Test
  void fieldAndIncludeProjectionsDoNotReuseAnIncompatibleRequestEntry() {
    final Fixture fixture = new Fixture();
    fixture.service.byId(fixture.id, fixture.query());
    fixture.fields = new Fields(Set.of(Entity.FIELD_OWNERS), Entity.FIELD_OWNERS);
    fixture.service.byName(fixture.name, fixture.query());
    fixture.includes = RelationIncludes.fromInclude(ALL);
    fixture.service.byId(fixture.id, fixture.query());
    assertEquals(3, fixture.reads.size());
    assertEquals(ALL, fixture.reads.getLast().include());
    assertSame(fixture.includes, fixture.hydratedIncludes);
  }

  @Test
  void requestHitsRefreshHrefForTheCurrentTransportWithoutRehydrating() {
    final Fixture fixture = new Fixture();
    fixture.uriInfo = uri("http://first/");
    assertEquals(
        URI.create("http://first/" + fixture.id),
        fixture.service.byId(fixture.id, fixture.query()).getHref());
    fixture.uriInfo = uri("http://second/");
    assertEquals(
        URI.create("http://second/" + fixture.id),
        fixture.service.byName(fixture.name, fixture.query()).getHref());
    assertEquals(1, fixture.reads.size());
  }

  @ParameterizedTest
  @ValueSource(strings = {"bundle", "fields", "inherit", "clear", "href"})
  void failedReadsRestoreTheEnclosingBundleAndNeverPublishPartialResults(final String failedPhase) {
    final Fixture fixture = new Fixture();
    final ReadBundle enclosing = new ReadBundle();
    ReadBundleContext.push(enclosing);
    fixture.failure = failedPhase;
    assertSame(
        fixture.exception,
        assertThrows(
            IllegalStateException.class, () -> fixture.service.byId(fixture.id, fixture.query())));
    assertSame(enclosing, ReadBundleContext.getCurrent());
    fixture.failure = null;
    assertEquals(
        "stored:fields:inherited",
        fixture.service.byName(fixture.name, fixture.query()).getDescription());
    assertEquals(2, fixture.reads.size());
    assertSame(enclosing, ReadBundleContext.getCurrent());
  }

  @Test
  void missingEntitiesPreserveTheLookupExceptionWithoutLoadingAReadBundle() {
    final Fixture fixture = new Fixture();
    fixture.missing = true;
    assertThrows(
        EntityNotFoundException.class, () -> fixture.service.byId(fixture.id, fixture.query()));
    assertThrows(
        EntityNotFoundException.class, () -> fixture.service.byName(fixture.name, fixture.query()));
    assertEquals(0, fixture.bundleLoads);
    assertNull(ReadBundleContext.getCurrent());
  }

  private static UriInfo uri(final String value) {
    final UriInfo uri = mock(UriInfo.class);
    when(uri.getBaseUri()).thenReturn(URI.create(value));
    return uri;
  }

  private record Read(Object key, Include include, boolean fromCache) {}

  private static final class Fixture {
    private final UUID id = UUID.randomUUID();
    private String name = "table" + id;
    private final List<Read> reads = new ArrayList<>();
    private final List<String> invalidations = new ArrayList<>();
    private final ReadBundle bundle = new ReadBundle();
    private final IllegalStateException exception = new IllegalStateException("read failed");
    private final EntityReadService<Table> service;
    private Fields fields = Fields.EMPTY_FIELDS;
    private RelationIncludes includes = RelationIncludes.fromInclude(NON_DELETED);
    private RelationIncludes hydratedIncludes;
    private UriInfo uriInfo;
    private boolean fromCache = true;
    private boolean quoteNames;
    private boolean missing;
    private String failure;
    private int bundleLoads;

    private Fixture() {
      service =
          new EntityReadService<>(
              new EntityReadService.Schema<>(
                  Entity.TABLE, Table.class, name -> quoteNames ? quoteName(name) : name),
              new EntityReadService.Lookup<>(
                  this::lookup,
                  this::lookup,
                  id -> invalidations.add("id:" + id),
                  name -> invalidations.add("name:" + name)),
              new EntityReadService.Hydration<>(
                  (entity, fields, includes) -> ReadPlan.empty(),
                  this::loadBundle,
                  this::setFields,
                  this::inherit,
                  this::clear),
              this::withHref);
    }

    private EntityReadService.Query query() {
      return new EntityReadService.Query(uriInfo, fields, includes, fromCache);
    }

    private Table lookup(final Object key, final Include include, final boolean fromCache) {
      reads.add(new Read(key, include, fromCache));
      if (missing) {
        throw new EntityNotFoundException("Missing " + key);
      }
      return new Table()
          .withId(id)
          .withName(name)
          .withFullyQualifiedName(quoteNames ? quoteName(name) : name)
          .withDescription("stored")
          .withExtension("hidden");
    }

    private ReadBundle loadBundle(final Table entity, final ReadPlan plan) {
      fail("bundle");
      bundleLoads++;
      return bundle;
    }

    private void setFields(
        final Table entity, final Fields fields, final RelationIncludes includes) {
      fail("fields");
      assertSame(bundle, ReadBundleContext.getCurrent());
      hydratedIncludes = includes;
      entity.setDescription(entity.getDescription() + ":fields");
    }

    private void inherit(final Table entity, final Fields fields) {
      fail("inherit");
      assertSame(bundle, ReadBundleContext.getCurrent());
      entity.setDescription(entity.getDescription() + ":inherited");
    }

    private void clear(final Table entity, final Fields fields) {
      fail("clear");
      assertNotSame(bundle, ReadBundleContext.getCurrent());
      entity.setExtension(null);
    }

    private Table withHref(final UriInfo uri, final Table entity) {
      fail("href");
      return uri == null
          ? entity
          : entity.withHref(uri.getBaseUri().resolve(entity.getId().toString()));
    }

    private void fail(final String phase) {
      if (phase.equals(failure)) {
        throw exception;
      }
    }
  }
}
