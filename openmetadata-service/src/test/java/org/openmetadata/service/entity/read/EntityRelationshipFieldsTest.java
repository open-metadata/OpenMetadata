package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotSame;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.openmetadata.schema.type.Include.ALL;
import static org.openmetadata.schema.type.Include.NON_DELETED;
import static org.openmetadata.service.Entity.DATA_CONTRACT;
import static org.openmetadata.service.Entity.DATA_PRODUCT;
import static org.openmetadata.service.Entity.DOMAIN;
import static org.openmetadata.service.Entity.FIELD_CHILDREN;
import static org.openmetadata.service.Entity.FIELD_DATA_CONTRACT;
import static org.openmetadata.service.Entity.FIELD_DATA_PRODUCTS;
import static org.openmetadata.service.Entity.FIELD_DOMAINS;
import static org.openmetadata.service.Entity.FIELD_EXPERTS;
import static org.openmetadata.service.Entity.FIELD_FOLLOWERS;
import static org.openmetadata.service.Entity.FIELD_OWNERS;
import static org.openmetadata.service.Entity.FIELD_REVIEWERS;
import static org.openmetadata.service.Entity.TABLE;
import static org.openmetadata.service.Entity.USER;

import com.google.common.cache.Cache;
import com.google.common.cache.CacheBuilder;
import java.time.Duration;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.invocation.InvocationOnMock;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.cache.CacheConfig;
import org.openmetadata.service.cache.CacheKeys;
import org.openmetadata.service.cache.CachedRelationshipDao;
import org.openmetadata.service.cache.EntityCacheBypass;
import org.openmetadata.service.cache.NoopCacheProvider;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipDAO;
import org.openmetadata.service.jdbi3.CoreRelationshipDAOs.EntityRelationshipRecord;

class EntityRelationshipFieldsTest {
  @Test
  void ownerAndDomainHitsPreserveRedisFieldsTtlAndIndependentReferences() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = fixture.seed(true, Relationship.OWNS, null, USER);
    final EntityReference domain = fixture.seed(true, Relationship.HAS, DOMAIN, DOMAIN);
    assertEquals(List.of(owner), fixture.fields.owners(fixture.table, NON_DELETED));
    assertEquals(List.of(domain), fixture.fields.domains(fixture.table, NON_DELETED));
    assertEquals(2, fixture.sqlReads);
    assertEquals(Duration.ofSeconds(fixture.config.entityTtlSeconds), fixture.provider.ttl);
    fixture.failSql = true;
    final EntityReference cachedOwner =
        fixture.fields.owners(fixture.table, NON_DELETED).getFirst();
    assertNotSame(owner, cachedOwner);
    cachedOwner.setDescription("mutated");
    assertEquals(owner, fixture.fields.owners(fixture.table, NON_DELETED).getFirst());
    assertEquals(List.of(domain), fixture.fields.domains(fixture.table, NON_DELETED));
    assertEquals(2, fixture.sqlReads);
  }

  @Test
  void broaderIncludesBypassNonDeletedCacheCoverage() {
    final Fixture fixture = new Fixture();
    fixture.seed(true, Relationship.OWNS, null, USER).setDeleted(true);
    fixture.seed(true, Relationship.HAS, DOMAIN, DOMAIN).setDeleted(true);
    assertTrue(fixture.fields.owners(fixture.table, NON_DELETED).isEmpty());
    assertNull(fixture.fields.domains(fixture.table, NON_DELETED));
    assertEquals(1, fixture.fields.owners(fixture.table, ALL).size());
    assertEquals(1, fixture.fields.domains(fixture.table, ALL).size());
    assertEquals(4, fixture.sqlReads);
    assertTrue(fixture.fields.owners(fixture.table, NON_DELETED).isEmpty());
  }

  @Test
  void cacheBypassDisabledCacheAndMalformedValuesRetainDatabaseFallback() {
    final Fixture fixture = new Fixture();
    fixture.seed(true, Relationship.OWNS, null, USER);
    fixture.fields.owners(fixture.table, NON_DELETED);
    try (var ignored = EntityCacheBypass.skip()) {
      fixture.fields.owners(fixture.table, NON_DELETED);
    }
    fixture.cacheEnabled = false;
    fixture.fields.owners(fixture.table, NON_DELETED);
    fixture.cacheEnabled = true;
    fixture.provider.values.invalidateAll();
    fixture.provider.hset(
        new CacheKeys("test").entity(TABLE, fixture.table.getId()),
        Map.of(FIELD_OWNERS, "not-json"),
        Duration.ofSeconds(1));
    fixture.fields.owners(fixture.table, NON_DELETED);
    assertEquals(4, fixture.sqlReads);
  }

  @Test
  void exactBundleCoveragePrecedesRedisAndSqlIncludingLoadedEmptyValues() {
    final Fixture fixture = new Fixture();
    fixture.bundle = new ReadBundle();
    for (String field :
        List.of(
            FIELD_OWNERS,
            FIELD_DOMAINS,
            FIELD_DATA_PRODUCTS,
            FIELD_DATA_CONTRACT,
            FIELD_FOLLOWERS,
            FIELD_CHILDREN,
            FIELD_REVIEWERS,
            FIELD_EXPERTS)) {
      fixture.bundle.putRelations(fixture.table.getId(), field, NON_DELETED, List.of());
    }
    fixture.failSql = true;
    assertTrue(fixture.fields.owners(fixture.table, NON_DELETED).isEmpty());
    assertTrue(fixture.fields.domains(fixture.table, NON_DELETED).isEmpty());
    assertTrue(fixture.fields.dataProducts(fixture.table, NON_DELETED).isEmpty());
    assertNull(fixture.fields.dataContract(fixture.table, NON_DELETED));
    assertTrue(fixture.fields.followers(fixture.table, NON_DELETED).isEmpty());
    assertTrue(fixture.fields.children(fixture.table, NON_DELETED).isEmpty());
    assertTrue(fixture.fields.reviewers(fixture.table, NON_DELETED).isEmpty());
    assertTrue(fixture.fields.experts(fixture.table, NON_DELETED).isEmpty());
    assertEquals(0, fixture.provider.reads);
    assertEquals(0, fixture.sqlReads);
  }

  @Test
  void includeMismatchUsesTheRequestedDatabaseProjection() {
    final Fixture fixture = new Fixture();
    final EntityReference actual = fixture.seed(true, Relationship.OWNS, null, USER);
    fixture.bundle = new ReadBundle();
    fixture.bundle.putRelations(fixture.table.getId(), FIELD_OWNERS, NON_DELETED, List.of());
    assertEquals(List.of(actual), fixture.fields.owners(fixture.table, ALL));
    assertEquals(List.of("owners:include_mismatch"), fixture.fallbacks);
    assertEquals(0, fixture.provider.reads);
  }

  @Test
  void unsupportedFieldsKeepTheirDistinctNullAndEmptyContracts() {
    final Fixture fixture = new Fixture(Set.of());
    fixture.failSql = true;
    assertTrue(fixture.fields.owners(fixture.table, NON_DELETED).isEmpty());
    assertNull(fixture.fields.owners(fixture.table.getEntityReference(), NON_DELETED));
    assertNull(fixture.fields.domains(fixture.table, NON_DELETED));
    assertNull(fixture.fields.dataProducts(fixture.table, NON_DELETED));
    assertNull(fixture.fields.dataContract(fixture.table, NON_DELETED));
    assertTrue(fixture.fields.followers(fixture.table, NON_DELETED).isEmpty());
    assertNull(fixture.fields.reviewers(fixture.table, NON_DELETED));
    assertNull(fixture.fields.experts(fixture.table, NON_DELETED));
    assertEquals(
        List.of("followers:no_bundle", "reviewers:no_bundle", "experts:no_bundle"),
        fixture.fallbacks);
  }

  @Test
  void bundleFirstFieldsStillUseLoadedValuesEvenWhenUnsupported() {
    final Fixture fixture = new Fixture(Set.of());
    fixture.bundle = new ReadBundle();
    final EntityReference loaded = new EntityReference().withId(UUID.randomUUID()).withType(USER);
    for (String field : List.of(FIELD_FOLLOWERS, FIELD_REVIEWERS, FIELD_EXPERTS)) {
      fixture.bundle.putRelations(fixture.table.getId(), field, ALL, List.of(loaded));
    }
    assertEquals(List.of(loaded), fixture.fields.followers(fixture.table, ALL));
    assertEquals(List.of(loaded), fixture.fields.reviewers(fixture.table, ALL));
    assertEquals(List.of(loaded), fixture.fields.experts(fixture.table, ALL));
  }

  @Test
  void nullableAndMissingIdsKeepFieldSpecificBehavior() {
    final Fixture fixture = new Fixture();
    assertTrue(fixture.fields.followers(null, NON_DELETED).isEmpty());
    assertNull(fixture.fields.domains(new Table(), NON_DELETED));
    assertThrows(
        NullPointerException.class, () -> fixture.fields.owners((Table) null, NON_DELETED));
    assertThrows(NullPointerException.class, () -> fixture.fields.domains(null, NON_DELETED));
  }

  @Test
  void fieldFallbacksRetainTheirRelationshipTypesDirectionsAndEmptyResults() {
    final Fixture fixture = new Fixture();
    final EntityReference follower = fixture.seed(true, Relationship.FOLLOWS, USER, USER);
    final EntityReference reviewer = fixture.seed(true, Relationship.REVIEWS, null, USER);
    final EntityReference expert = fixture.seed(false, Relationship.EXPERT, USER, USER);
    final EntityReference product =
        fixture.seed(true, Relationship.HAS, DATA_PRODUCT, DATA_PRODUCT);
    final EntityReference child = fixture.seed(false, Relationship.CONTAINS, TABLE, TABLE);
    final EntityReference contract =
        fixture.seed(false, Relationship.CONTAINS, DATA_CONTRACT, DATA_CONTRACT);
    assertEquals(List.of(follower), fixture.fields.followers(fixture.table, NON_DELETED));
    assertEquals(List.of(reviewer), fixture.fields.reviewers(fixture.table, NON_DELETED));
    assertEquals(List.of(expert), fixture.fields.experts(fixture.table, NON_DELETED));
    assertEquals(List.of(product), fixture.fields.dataProducts(fixture.table, NON_DELETED));
    assertEquals(List.of(child), fixture.fields.children(fixture.table, NON_DELETED));
    assertSame(contract, fixture.fields.dataContract(fixture.table, NON_DELETED));
    fixture.rows.clear();
    assertNull(fixture.fields.dataContract(fixture.table, NON_DELETED));
    assertNull(fixture.fields.domains(fixture.table, NON_DELETED));
    assertTrue(fixture.fields.dataProducts(fixture.table, NON_DELETED).isEmpty());
    assertNull(fixture.fields.owners(fixture.table.getEntityReference(), NON_DELETED));
  }

  @Test
  void referenceOwnersBypassBundlesAndRedisWhileContractBundlesKeepTheFirstResult() {
    final Fixture fixture = new Fixture();
    final EntityReference owner = fixture.seed(true, Relationship.OWNS, null, USER);
    fixture.bundle = new ReadBundle();
    fixture.bundle.putRelations(fixture.table.getId(), FIELD_OWNERS, ALL, List.of());
    fixture.bundle.putRelations(
        fixture.table.getId(),
        FIELD_DATA_CONTRACT,
        ALL,
        List.of(owner, new EntityReference().withId(UUID.randomUUID())));
    assertEquals(List.of(owner), fixture.fields.owners(fixture.table.getEntityReference(), ALL));
    assertSame(owner, fixture.fields.dataContract(fixture.table, ALL));
    assertEquals(0, fixture.provider.reads);
    assertEquals(1, fixture.sqlReads);
  }

  private record Query(boolean incoming, int relation, String relatedType) {}

  private static final class Fixture {
    private final Table table = new Table().withId(UUID.randomUUID());
    private final Map<Query, List<EntityRelationshipRecord>> rows = new HashMap<>();
    private final Map<UUID, EntityReference> references = new HashMap<>();
    private final List<String> fallbacks = new ArrayList<>();
    private final Provider provider = new Provider();
    private final CacheConfig config = new CacheConfig();
    private final CachedRelationshipDao cache =
        new CachedRelationshipDao(null, provider, new CacheKeys("test"), config);
    private final EntityRelationshipDAO dao = mock(EntityRelationshipDAO.class, this::readRows);
    private final EntityRelationshipFields fields;
    private ReadBundle bundle;
    private boolean cacheEnabled = true;
    private boolean failSql;
    private int sqlReads;

    private Fixture() {
      this(
          Set.of(
              FIELD_OWNERS,
              FIELD_DOMAINS,
              FIELD_DATA_PRODUCTS,
              FIELD_DATA_CONTRACT,
              FIELD_FOLLOWERS,
              FIELD_REVIEWERS,
              FIELD_EXPERTS));
    }

    private Fixture(final Set<String> supported) {
      final EntityRelationshipReader reader =
          new EntityRelationshipReader(
              TABLE,
              () -> dao,
              new EntityRelationshipReader.References(
                  (type, id, include) -> references.get(id), this::readReferences),
              () -> cache);
      fields =
          new EntityRelationshipFields(
              new EntityRelationshipFields.Schema(TABLE, supported),
              reader,
              new ReadBundleAccess(
                  TABLE, () -> bundle, (field, reason) -> fallbacks.add(field + ":" + reason)),
              () -> cacheEnabled ? cache : null);
    }

    private Object readRows(final InvocationOnMock invocation) {
      if (failSql) {
        throw new AssertionError("Unexpected SQL");
      }
      sqlReads++;
      assertEquals(table.getId(), invocation.getArgument(0));
      assertEquals(TABLE, invocation.getArgument(1));
      final Query query =
          new Query(
              invocation.getMethod().getName().equals("findFrom"),
              invocation.getArgument(2),
              invocation.getArguments().length == 4 ? invocation.getArgument(3) : null);
      return rows.getOrDefault(query, List.of());
    }

    private List<EntityReference> readReferences(
        final List<EntityRelationshipRecord> rows, final Include include) {
      return rows.stream()
          .map(row -> references.get(row.getId()))
          .filter(reference -> include == ALL || !Boolean.TRUE.equals(reference.getDeleted()))
          .toList();
    }

    private EntityReference seed(
        final boolean incoming,
        final Relationship relation,
        final String relatedType,
        final String referenceType) {
      final EntityReference reference =
          new EntityReference()
              .withId(UUID.randomUUID())
              .withType(referenceType)
              .withName(referenceType)
              .withDeleted(false);
      references.put(reference.getId(), reference);
      rows.put(
          new Query(incoming, relation.ordinal(), relatedType),
          List.of(
              EntityRelationshipRecord.builder()
                  .id(reference.getId())
                  .type(referenceType)
                  .build()));
      return reference;
    }
  }

  private static final class Provider extends NoopCacheProvider {
    private record Key(String entity, String field) {}

    private final Cache<Key, String> values = CacheBuilder.newBuilder().maximumSize(100).build();
    private Duration ttl;
    private int reads;

    @Override
    public Optional<String> hget(final String key, final String field) {
      reads++;
      return Optional.ofNullable(values.getIfPresent(new Key(key, field)));
    }

    @Override
    public void hset(final String key, final Map<String, String> fields, final Duration ttl) {
      this.ttl = ttl;
      fields.forEach((field, value) -> values.put(new Key(key, field), value));
    }
  }
}
