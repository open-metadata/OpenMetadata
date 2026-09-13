package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.entity.read.EntityRelationshipReader.Selection;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.exception.EntityRelationshipNotFoundException;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipObject;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;
import org.openmetadata.service.util.EntityUtil;

class EntityRelationshipReaderTest {
  @Test
  void incomingAndOutgoingQueriesKeepDirectionAndIncludeFiltering() {
    final Fixture fixture = new Fixture();
    final EntityReference incoming = fixture.reference("incoming", false);
    final EntityReference outgoing = fixture.reference("outgoing", true);
    fixture.incoming(List.of(fixture.record(incoming)));
    fixture.outgoing(List.of(fixture.record(outgoing)));
    assertEquals(List.of(incoming), fixture.reader.from(fixture.selection, NON_DELETED));
    assertTrue(fixture.reader.to(fixture.selection, NON_DELETED).isEmpty());
    assertEquals(List.of(outgoing), fixture.reader.to(fixture.selection, ALL));
  }

  @Test
  void typedQueriesRetainTheirRelatedTypeFilter() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.reference("parent", false);
    final Selection typed =
        new Selection(fixture.id, "table", Relationship.CONTAINS, "databaseSchema");
    when(fixture.dao.findFrom(
            fixture.id, "table", Relationship.CONTAINS.ordinal(), "databaseSchema"))
        .thenReturn(List.of(fixture.record(parent)));
    assertEquals(List.of(parent), fixture.reader.from(typed, ALL));
    assertTrue(fixture.reader.from(fixture.selection, ALL).isEmpty());
    when(fixture.dao.findTo(fixture.id, "table", Relationship.CONTAINS.ordinal(), "databaseSchema"))
        .thenReturn(List.of(fixture.record(parent)));
    assertSame(parent, fixture.reader.singleTo(typed, true));
  }

  @Test
  void batchQueriesRetainTheirOwnerAndRelatedTypeArguments() {
    final Fixture fixture = new Fixture();
    final List<String> ids = List.of(fixture.id.toString());
    final EntityRelationshipObject incoming =
        EntityRelationshipObject.builder()
            .fromId(UUID.randomUUID().toString())
            .toId(fixture.id.toString())
            .fromEntity("databaseSchema")
            .toEntity("table")
            .relation(Relationship.CONTAINS.ordinal())
            .build();
    final EntityRelationshipObject outgoing =
        EntityRelationshipObject.builder()
            .fromId(fixture.id.toString())
            .toId(UUID.randomUUID().toString())
            .fromEntity("table")
            .toEntity("testSuite")
            .relation(Relationship.CONTAINS.ordinal())
            .build();
    when(fixture.dao.findFromBatch(ids, Relationship.CONTAINS.ordinal(), "table", "databaseSchema"))
        .thenReturn(List.of(incoming));
    when(fixture.dao.findToBatch(ids, Relationship.CONTAINS.ordinal(), "table", "testSuite"))
        .thenReturn(List.of(outgoing));
    assertEquals(
        List.of(incoming),
        fixture.reader.fromRecordsBatch(
            Set.copyOf(ids), "table", Relationship.CONTAINS, "databaseSchema"));
    assertEquals(
        List.of(outgoing),
        fixture.reader.toRecordsBatch(
            Set.copyOf(ids), "table", Relationship.CONTAINS, "testSuite"));
  }

  @Test
  void bidirectionalResultsKeepDuplicatesAndDeterministicNameOrdering() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference("a", false);
    final EntityReference last = fixture.reference("z", false);
    fixture.incoming(List.of(fixture.record(last), fixture.record(first)));
    fixture.outgoing(List.of(fixture.record(first)));
    assertEquals(List.of(first, first, last), fixture.reader.both(fixture.selection));
  }

  @Test
  void nullableReferenceListsRetainNullForAbsentOrFilteredRelationships() {
    final Fixture fixture = new Fixture();
    assertNull(fixture.reader.fromOrNull(fixture.selection, ALL));
    final EntityReference deleted = fixture.reference("deleted", true);
    fixture.incoming(List.of(fixture.record(deleted)));
    assertNull(fixture.reader.fromOrNull(fixture.selection, NON_DELETED));
    assertEquals(List.of(deleted), fixture.reader.fromOrNull(fixture.selection, ALL));
  }

  @Test
  void optionalMissingRelationshipsReturnNullButRequiredOnesFail() {
    final Fixture fixture = new Fixture();
    assertNull(fixture.reader.singleFrom(fixture.selection, false, false));
    assertNull(fixture.reader.singleTo(fixture.selection, false));
    assertThrows(
        EntityRelationshipNotFoundException.class,
        () -> fixture.reader.singleFrom(fixture.selection, true, false));
    assertThrows(
        EntityRelationshipNotFoundException.class,
        () -> fixture.reader.singleTo(fixture.selection, true));
  }

  @Test
  void duplicateParentRowsRetainTheFirstReference() {
    final Fixture fixture = new Fixture();
    final EntityReference first = fixture.reference("z-first", false);
    final EntityReference second = fixture.reference("a-second", false);
    fixture.incoming(List.of(fixture.record(first), fixture.record(second)));
    assertSame(first, fixture.reader.singleFrom(fixture.selection, true, false));
  }

  @Test
  void orphanedReferenceRowsRemainToleratedEvenWhenTheRelationshipIsRequired() {
    final Fixture fixture = new Fixture();
    final EntityRelationshipRecord missing =
        fixture.record(new EntityReference().withId(UUID.randomUUID()).withType("databaseSchema"));
    fixture.incoming(List.of(missing));
    fixture.outgoing(List.of(missing));
    assertNull(fixture.reader.singleFrom(fixture.selection, true, false));
    assertNull(fixture.reader.singleFrom(fixture.selection, true, true));
    assertNull(fixture.reader.singleTo(fixture.selection, true));
  }

  @Test
  void containerCacheHitsAvoidBothTheRelationshipAndReferenceLookups() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.reference("parent", false);
    fixture.incoming(List.of(fixture.record(parent)));
    assertSame(parent, fixture.reader.singleFrom(fixture.selection, true, true));
    fixture.references.clear();
    fixture.failDatabase();
    assertEquals(parent, fixture.reader.singleFrom(fixture.selection, true, true));
    assertEquals(Duration.ofSeconds(fixture.config.relationshipTtlSeconds), fixture.provider.ttl);
  }

  @Test
  void uncachedAndTypedParentQueriesIgnoreAnExistingContainerCacheEntry() {
    final Fixture fixture = new Fixture();
    final EntityReference old = fixture.reference("old", false);
    final EntityReference current = fixture.reference("current", false);
    fixture.cache.putContainer("table", fixture.id, Relationship.CONTAINS.ordinal(), old);
    fixture.incoming(List.of(fixture.record(current)));
    assertSame(current, fixture.reader.singleFrom(fixture.selection, false, false));
    final Selection typed =
        new Selection(fixture.id, "table", Relationship.CONTAINS, "databaseSchema");
    when(fixture.dao.findFrom(
            fixture.id, "table", Relationship.CONTAINS.ordinal(), "databaseSchema"))
        .thenReturn(List.of(fixture.record(current)));
    assertSame(current, fixture.reader.singleFrom(typed, false, true));
    assertEquals(
        old, fixture.cache.getContainer("table", fixture.id, Relationship.CONTAINS.ordinal()));
  }

  @Test
  void nonContainmentRelationsDoNotConsultTheContainerCacheProvider() {
    final Fixture fixture = new Fixture();
    final EntityReference current = fixture.reference("current", false);
    final Selection owns = new Selection(fixture.id, "table", Relationship.OWNS, null);
    when(fixture.dao.findFrom(fixture.id, "table", Relationship.OWNS.ordinal()))
        .thenReturn(List.of(fixture.record(current)));
    fixture.rejectCacheLookup = true;
    assertSame(current, fixture.reader.singleFrom(owns, false, true));
  }

  @Test
  void cacheBypassReadsCurrentRowsWithoutChangingTheWarmEntry() {
    final Fixture fixture = new Fixture();
    final EntityReference old = fixture.reference("old", false);
    final EntityReference current = fixture.reference("current", false);
    fixture.cache.putContainer("table", fixture.id, Relationship.CONTAINS.ordinal(), old);
    fixture.incoming(List.of(fixture.record(current)));
    try (var ignored = EntityCacheBypass.skip()) {
      assertSame(current, fixture.reader.singleFrom(fixture.selection, false, true));
    }
    assertEquals(
        old, fixture.cache.getContainer("table", fixture.id, Relationship.CONTAINS.ordinal()));
  }

  @Test
  void disabledAndInvalidContainerCachesFallBackToTheCurrentParent() {
    final Fixture fixture = new Fixture();
    final EntityReference current = fixture.reference("current", false);
    fixture.incoming(List.of(fixture.record(current)));
    fixture.cacheEnabled = false;
    assertSame(current, fixture.reader.singleFrom(fixture.selection, false, true));
    fixture.cacheEnabled = true;
    fixture.provider.values.put(
        fixture.keys.containerRef("table", fixture.id, Relationship.CONTAINS.ordinal()),
        "invalid-json");
    assertSame(current, fixture.reader.singleFrom(fixture.selection, false, true));
    assertEquals(
        current, fixture.cache.getContainer("table", fixture.id, Relationship.CONTAINS.ordinal()));
  }

  @Test
  void singleOutgoingReferencesIncludeSoftDeletedEntities() {
    final Fixture fixture = new Fixture();
    final EntityReference deleted = fixture.reference("deleted", true);
    fixture.outgoing(List.of(fixture.record(deleted)));
    assertSame(deleted, fixture.reader.singleTo(fixture.selection, true));
  }

  @Test
  void boundContainerReadsKeepTheUncachedTolerantPolicy() {
    final Fixture fixture = new Fixture();
    final EntityReference parent = fixture.reference("parent", false);
    fixture.rejectCacheLookup = true;
    fixture.incoming(List.of(fixture.record(parent)));
    assertSame(parent, fixture.reader.container(fixture.id, null));
    fixture.incoming(List.of());
    assertNull(fixture.reader.container(fixture.id, null));
  }

  @Test
  void boundSingleIncomingReadsKeepTypeRequiredAndIncludeRules() {
    final Fixture fixture = new Fixture();
    final EntityReference deleted = fixture.reference("deleted", true);
    fixture.rejectCacheLookup = true;
    fixture.incoming(List.of(fixture.record(deleted)));
    assertSame(deleted, fixture.reader.singleFrom(fixture.id, Relationship.CONTAINS, null, true));
    fixture.incoming(List.of());
    assertThrows(
        EntityRelationshipNotFoundException.class,
        () -> fixture.reader.singleFrom(fixture.id, Relationship.CONTAINS, null, true));
  }

  @Test
  void boundIncomingListsKeepNullAndDeletedReferenceFiltering() {
    final Fixture fixture = new Fixture();
    final EntityReference deleted = fixture.reference("deleted", true);
    fixture.incoming(List.of(fixture.record(deleted)));
    assertNull(fixture.reader.fromOrNull(fixture.id, Relationship.CONTAINS, null, NON_DELETED));
    assertEquals(
        List.of(deleted), fixture.reader.fromOrNull(fixture.id, Relationship.CONTAINS, null, ALL));
  }

  @Test
  void boundSingleOutgoingReadsKeepTheTypeFilterAndDeletedReferences() {
    final Fixture fixture = new Fixture();
    final EntityReference deleted = fixture.reference("deleted", true);
    when(fixture.dao.findTo(fixture.id, "table", Relationship.CONTAINS.ordinal(), "databaseSchema"))
        .thenReturn(List.of(fixture.record(deleted)));
    assertSame(
        deleted,
        fixture.reader.singleTo(fixture.id, Relationship.CONTAINS, "databaseSchema", true));
  }

  private static final class Fixture {
    private final UUID id = UUID.randomUUID();
    private final Selection selection = new Selection(id, "table", Relationship.CONTAINS, null);
    private final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class);
    private final Map<UUID, EntityReference> references = new HashMap<>();
    private final Provider provider = new Provider();
    private final CacheConfig config = new CacheConfig();
    private final CacheKeys keys = new CacheKeys("test");
    private final CachedRelationshipDao cache =
        new CachedRelationshipDao(null, provider, keys, config);
    private boolean cacheEnabled = true;
    private boolean rejectCacheLookup;
    private final EntityRelationshipReader reader =
        new EntityRelationshipReader(
            "table",
            () -> dao,
            new EntityRelationshipReader.References(this::reference, this::references),
            this::cache);

    private CachedRelationshipDao cache() {
      if (rejectCacheLookup) {
        throw new AssertionError("A mutable relationship must not use the container cache");
      }
      return cacheEnabled ? cache : null;
    }

    private EntityReference reference(final String name, final boolean deleted) {
      final EntityReference reference =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType("databaseSchema")
              .withName(name)
              .withDeleted(deleted);
      references.put(reference.getId(), reference);
      return reference;
    }

    private EntityReference reference(final String type, final UUID id, final Include include) {
      final EntityReference reference = references.get(id);
      if (reference == null) {
        throw new EntityNotFoundException("Missing " + type + " " + id);
      }
      return reference;
    }

    private List<EntityReference> references(
        final List<EntityRelationshipRecord> rows, final Include include) {
      return rows.stream()
          .map(row -> references.get(row.getId()))
          .filter(reference -> include == ALL || !Boolean.TRUE.equals(reference.getDeleted()))
          .sorted(EntityUtil.compareEntityReference)
          .toList();
    }

    private EntityRelationshipRecord record(final EntityReference reference) {
      return EntityRelationshipRecord.builder()
          .id(reference.getId())
          .type(reference.getType())
          .build();
    }

    private void incoming(final List<EntityRelationshipRecord> rows) {
      when(dao.findFrom(id, "table", Relationship.CONTAINS.ordinal())).thenReturn(rows);
    }

    private void outgoing(final List<EntityRelationshipRecord> rows) {
      when(dao.findTo(id, "table", Relationship.CONTAINS.ordinal())).thenReturn(rows);
    }

    private void failDatabase() {
      when(dao.findFrom(id, "table", Relationship.CONTAINS.ordinal()))
          .thenThrow(new IllegalStateException("Database unavailable"));
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private final Cache<String, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private Duration ttl;

    @Override
    public Optional<String> get(final String key) {
      return Optional.ofNullable(values.getIfPresent(key));
    }

    @Override
    public void set(final String key, final String value, final Duration ttl) {
      this.ttl = ttl;
      values.put(key, value);
    }

    @Override
    public void del(final String... keys) {
      values.invalidateAll(List.of(keys));
    }
  }
}
