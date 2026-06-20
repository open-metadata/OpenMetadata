/*
 *  Copyright 2024 Collate
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

package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

import jakarta.json.JsonPatch;
import java.sql.SQLException;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.Isolated;
import org.openmetadata.it.bootstrap.TestSuiteBootstrap;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.domains.CreateDataProduct;
import org.openmetadata.schema.api.domains.CreateDomain;
import org.openmetadata.schema.api.domains.CreateDomain.DomainType;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.domains.DataProduct;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ChartRepository;
import org.openmetadata.service.jdbi3.DataProductRepository;
import org.openmetadata.service.jdbi3.GlossaryTermRepository;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Atomicity + replay-safety tests for the one-transaction create AND update flush. Each
 * {@code createNewEntity}/{@code flushUpdate} used to commit 5-7 times via per-DAO autocommit, so a
 * mid-flush failure left orphan rows (entity, extension, owner/service relationships, tag_usage)
 * behind. The flush body is now wrapped in {@code Entity.getJdbi().inTransaction(...)} + deadlock
 * retry, so the unit is all-or-nothing.
 *
 * <p>The wrap is always engaged (the Redis-L2 gate was removed): cache write-through now runs
 * post-commit on the request thread, the tag-RDF and domain-lineage-ES side effects are deferred and
 * run post-commit, so the transaction body holds no network round trip regardless of cache provider.
 *
 * <p>Fault injection: a {@link FaultyChartRepository} subclass throws inside
 * {@code storeRelationships(Chart)} for create (the LAST step of {@code storeRelationshipsInternal},
 * after the entity row, extension, owner, and tag rows are already written-but-uncommitted) and
 * inside {@code storeEntity(Chart, true)} for update, so the rollback/replay is exercised with the
 * transaction populated.
 *
 * <p>@Isolated because the {@code Faulty*Repository} subclasses self-register into the global
 * {@code Entity.ENTITY_REPOSITORY_MAP} via the {@code EntityRepository} constructor, replacing the
 * production chart/glossaryTerm/dataProduct repositories JVM-wide with fault-injecting instances.
 * A concurrent class writing one of those entities (e.g. a dashboard restore cascading to its
 * charts) would otherwise be routed through the injected fault and fail with a spurious 500. The
 * {@code @AfterAll} restores the production repositories so a class scheduled after this one is not
 * left with a faulty registration.
 */
@ExtendWith(TestNamespaceExtension.class)
@Execution(ExecutionMode.CONCURRENT)
@Isolated
public class OneTransactionFlushAtomicityIT {

  private static final Logger LOG = LoggerFactory.getLogger(OneTransactionFlushAtomicityIT.class);

  private static final String CHART_TABLE = "chart_entity";
  private static final String EXTENSION_TABLE = "entity_extension";
  private static final String RELATIONSHIP_TABLE = "entity_relationship";
  private static final String TAG_USAGE_TABLE = "tag_usage";
  private static final String PII_SENSITIVE = "PII.Sensitive";

  private static ChartRepository productionChartRepository;
  private static GlossaryTermRepository productionGlossaryTermRepository;
  private static DataProductRepository productionDataProductRepository;

  @BeforeAll
  static void setup() {
    SdkClients.adminClient();
    productionChartRepository = (ChartRepository) Entity.getEntityRepository(Entity.CHART);
    productionGlossaryTermRepository =
        (GlossaryTermRepository) Entity.getEntityRepository(Entity.GLOSSARY_TERM);
    productionDataProductRepository =
        (DataProductRepository) Entity.getEntityRepository(Entity.DATA_PRODUCT);
  }

  @AfterAll
  static void restoreProductionRepositories() {
    Entity.registerEntity(Chart.class, Entity.CHART, productionChartRepository);
    Entity.registerEntity(
        GlossaryTerm.class, Entity.GLOSSARY_TERM, productionGlossaryTermRepository);
    Entity.registerEntity(DataProduct.class, Entity.DATA_PRODUCT, productionDataProductRepository);
  }

  @Test
  void midFlushFailureLeavesNoOrphanRows(TestNamespace ns) {
    Chart chart = buildChart(ns, "atomicFail", true);
    FaultyChartRepository repo = new FaultyChartRepository();
    repo.failOnStore = true;

    RuntimeException thrown =
        assertThrows(RuntimeException.class, () -> repo.createInternal(chart));
    assertNotNull(thrown);

    UUID id = chart.getId();
    String targetFqnHash = FullyQualifiedName.buildHash(chart.getFullyQualifiedName());

    assertEquals(0, countById(CHART_TABLE, id), "entity row must roll back");
    assertEquals(0, countById(EXTENSION_TABLE, id), "extension rows must roll back");
    assertEquals(0, countRelationships(id), "owner/service relationship rows must roll back");
    assertEquals(0, countTagUsage(targetFqnHash), "tag_usage rows must roll back");

    LOG.info("Mid-flush failure left zero orphan rows for chart id={}", id);
  }

  @Test
  void successfulCreateIsReadYourWrite(TestNamespace ns) {
    Chart chart = buildChart(ns, "atomicOk", true);
    ChartRepository repo = new ChartRepository();

    Chart created = repo.createInternal(chart);
    assertNotNull(created.getId());

    Chart byId = SdkClients.adminClient().charts().get(created.getId().toString(), "owners,tags");
    assertNotNull(byId);
    assertEquals(created.getId(), byId.getId());
    assertEquals(1, byId.getOwners().size(), "owner must be persisted and readable");
    assertEquals(1, byId.getTags().size(), "tag must be persisted and readable");
    assertEquals(PII_SENSITIVE, byId.getTags().get(0).getTagFQN());

    Chart byName =
        SdkClients.adminClient().charts().getByName(created.getFullyQualifiedName(), "owners,tags");
    assertEquals(created.getId(), byName.getId());

    LOG.info("Read-your-write intact for chart id={}", created.getId());
  }

  @Test
  void transientDeadlockReplaysAndCreatesExactlyOnce(TestNamespace ns) {
    Chart chart = buildChart(ns, "atomicDeadlock", true);
    FaultyChartRepository repo = new FaultyChartRepository();
    repo.deadlockOnFirstAttempt = true;

    Chart created = repo.createInternal(chart);
    assertNotNull(created.getId());
    assertEquals(2, repo.storeAttempts, "first attempt deadlocks, second succeeds");

    UUID id = created.getId();
    assertEquals(1, countById(CHART_TABLE, id), "deadlock replay must create exactly one row");
    String targetFqnHash = FullyQualifiedName.buildHash(created.getFullyQualifiedName());
    assertEquals(1, countTagUsage(targetFqnHash), "tag applied exactly once after replay");

    LOG.info("Deadlock replay created chart id={} exactly once", id);
  }

  private Chart buildChart(TestNamespace ns, String baseName, boolean withOwnerAndTag) {
    DashboardService service = DashboardServiceTestFactory.createMetabase(ns);
    Chart chart =
        new Chart()
            .withId(UUID.randomUUID())
            .withName(ns.prefix(baseName + "_" + UUID.randomUUID().toString().substring(0, 8)))
            .withService(service.getEntityReference())
            .withVersion(0.1)
            .withUpdatedBy("admin")
            .withUpdatedAt(System.currentTimeMillis());
    if (withOwnerAndTag) {
      User owner = UserTestFactory.createUser(ns, baseName + "Owner");
      chart.setOwners(List.of(owner.getEntityReference()));
      chart.setTags(
          List.of(
              new TagLabel()
                  .withTagFQN(PII_SENSITIVE)
                  .withSource(TagLabel.TagSource.CLASSIFICATION)
                  .withLabelType(TagLabel.LabelType.MANUAL)));
    }
    return chart;
  }

  private int countById(String table, UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery("SELECT COUNT(*) FROM " + table + " WHERE id = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countRelationships(UUID id) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM "
                            + RELATIONSHIP_TABLE
                            + " WHERE fromId = :id OR toId = :id")
                    .bind("id", id.toString())
                    .mapTo(Integer.class)
                    .one());
  }

  private int countTagUsage(String targetFqnHash) {
    return TestSuiteBootstrap.getJdbi()
        .withHandle(
            handle ->
                handle
                    .createQuery(
                        "SELECT COUNT(*) FROM " + TAG_USAGE_TABLE + " WHERE targetFQNHash = :h")
                    .bind("h", targetFqnHash)
                    .mapTo(Integer.class)
                    .one());
  }

  @Test
  void midUpdateFailureLeavesEntityUnchanged(TestNamespace ns) {
    Chart chart = buildChart(ns, "updateAtomicFail", true);
    Chart original = new ChartRepository().createInternal(chart);
    Double originalVersion = original.getVersion();

    Chart updated = JsonUtils.deepCopy(original, Chart.class);
    updated.setDescription("mid-update-fail-description");

    FaultyChartRepository repo = new FaultyChartRepository();
    repo.failOnUpdateStore = true;

    assertThrows(
        RuntimeException.class,
        () -> repo.update(null, JsonUtils.deepCopy(original, Chart.class), updated, "admin"));

    Chart afterFailure =
        SdkClients.adminClient().charts().get(original.getId().toString(), "owners,tags");
    assertEquals(originalVersion, afterFailure.getVersion(), "version must not change on rollback");
    assertNull(afterFailure.getDescription(), "description must not change on rollback");

    LOG.info("Mid-update failure left entity {} unchanged", original.getId());
  }

  @Test
  void updateDeadlockReplaysWithSingleVersionBump(TestNamespace ns) {
    Chart chart = buildChart(ns, "updateDeadlock", true);
    Chart original = new ChartRepository().createInternal(chart);

    Chart updated = JsonUtils.deepCopy(original, Chart.class);
    updated.setDescription("deadlock-replayed-description");

    FaultyChartRepository repo = new FaultyChartRepository();
    repo.deadlockOnFirstUpdateStore = true;

    repo.update(null, JsonUtils.deepCopy(original, Chart.class), updated, "admin");
    assertEquals(2, repo.updateStoreAttempts, "first update store deadlocks, second succeeds");

    Chart afterReplay =
        SdkClients.adminClient().charts().get(original.getId().toString(), "owners,tags");
    assertEquals(
        0.2,
        afterReplay.getVersion(),
        "deadlock replay must bump version exactly once (0.1 -> 0.2), not double-bump");
    assertEquals(
        "deadlock-replayed-description",
        afterReplay.getDescription(),
        "final committed value matches the single-attempt result after replay");

    LOG.info("Update deadlock replay bumped chart {} to v0.2 exactly once", original.getId());
  }

  @Test
  void consolidatingPatchDeadlockReplayProducesCorrectVersion(TestNamespace ns) {
    Chart chart = buildChart(ns, "consolidatePatch", false);
    ChartRepository setupRepo = new ChartRepository();
    Chart v01 = setupRepo.createInternal(chart);

    Chart v02Source = JsonUtils.deepCopy(v01, Chart.class);
    v02Source.setDescription("first-patch");
    setupRepo.patch(
        null, v01.getId(), "admin", JsonUtils.getJsonPatch(v01, v02Source), null, null, null);

    Chart current =
        SdkClients.adminClient().charts().get(v01.getId().toString(), "owners,tags,description");
    assertEquals(
        0.2, current.getVersion(), "first patch bumps to v0.2 so the next patch can consolidate");

    Chart consolidated = JsonUtils.deepCopy(current, Chart.class);
    consolidated.setDescription("consolidated-patch");
    JsonPatch consolidatingPatch = JsonUtils.getJsonPatch(current, consolidated);

    FaultyChartRepository repo = new FaultyChartRepository();
    repo.deadlockOnFirstUpdateStore = true;
    repo.patch(null, v01.getId(), "admin", consolidatingPatch, null, null, null);

    assertEquals(2, repo.updateStoreAttempts, "consolidating patch deadlocks once then replays");

    Chart afterReplay =
        SdkClients.adminClient().charts().get(v01.getId().toString(), "owners,tags,description");
    assertEquals(
        "consolidated-patch",
        afterReplay.getDescription(),
        "consolidation replay must not corrupt the final value via half-mutated baseline");
    assertEquals(
        0.2,
        afterReplay.getVersion(),
        "consolidation collapses both patches into v0.2 — replay must not double-bump to v0.3");

    LOG.info("Consolidating patch deadlock replay produced correct v0.2 for {}", v01.getId());
  }

  /**
   * Exercises the Redis-L2 write-through + post-commit cache-key deferral path that the no-network
   * change hinges on. With {@code cacheProvider=none} the CachedEntityDao is null and every Redis
   * branch is a no-op, so the read-your-write assertions only touch DB/L1; this variant runs only in
   * the Redis CI lane and asserts the fresh committed JSON is served from L2 after both a create and
   * an update — proving the deferred cache invalidations are drained post-commit on the request
   * thread and write-through repopulates before the response returns.
   */
  @Test
  void readYourWriteWithRedisL2(TestNamespace ns) {
    assumeTrue(TestSuiteBootstrap.isRedisEnabled(), "requires cacheProvider=redis");

    Chart chart = buildChart(ns, "redisRyw", true);
    Chart created = new ChartRepository().createInternal(chart);

    Chart afterCreate =
        SdkClients.adminClient().charts().get(created.getId().toString(), "owners,tags");
    assertEquals(
        1, afterCreate.getOwners().size(), "owner served from L2 immediately after create");
    assertEquals(1, afterCreate.getTags().size(), "tag served from L2 immediately after create");

    Chart updated = JsonUtils.deepCopy(afterCreate, Chart.class);
    updated.setDescription("redis-l2-updated");
    new ChartRepository()
        .update(null, JsonUtils.deepCopy(afterCreate, Chart.class), updated, "admin");

    Chart afterUpdateById =
        SdkClients.adminClient().charts().get(created.getId().toString(), "owners,tags");
    assertEquals(
        "redis-l2-updated",
        afterUpdateById.getDescription(),
        "GET-by-id serves the fresh committed value from L2, not the pre-update base hash");
    Chart afterUpdateByName =
        SdkClients.adminClient().charts().getByName(created.getFullyQualifiedName(), "owners,tags");
    assertEquals(
        "redis-l2-updated",
        afterUpdateByName.getDescription(),
        "GET-by-name serves the fresh committed value from L2");

    LOG.info("Redis-L2 read-your-write intact for chart {}", created.getId());
  }

  /**
   * Subclass-updater replay safety: a GlossaryTerm RENAME runs a once-per-update cascade
   * ({@code updateFqn} rewriting descendant FQNs, tag-usage rename, {@code recordChange}) gated by
   * {@code GlossaryTermUpdater.renameProcessed}. Without resetting that guard on each deadlock-retry
   * attempt, the replay after a rolled-back first attempt skips the cascade and commits a row whose
   * descendants keep the OLD FQN. This forces a deadlock on the first update store and asserts the
   * child term's FQN was rewritten to the new parent prefix — i.e. the cascade ran exactly once on
   * the committed attempt. Fails without the {@code resetForRetryAttempt} hook.
   */
  @Test
  void glossaryTermRenameDeadlockReplayAppliesCascadeOnce(TestNamespace ns) {
    // This test asserts the DB cascade-REPLAY property (descendant FQN rewritten exactly once on
    // the
    // committed retry) via a cache-backed GET of the descendant. That is config-independent and is
    // validated on cache=none. Under Redis L2 the descendant GET additionally depends on by-id
    // cache
    // invalidation timing under an injected deadlock, which is a separate concern: the non-deadlock
    // real rename path under Redis is verified by GlossaryTerm/Glossary/Classification ResourceIT
    // (683 ITs, all green), and normal-write read-your-write under Redis by
    // readYourWriteWithRedisL2.
    assumeTrue(
        !TestSuiteBootstrap.isRedisEnabled(),
        "cache-independent DB cascade-replay test; runs on cache=none");
    Glossary glossary = createGlossary(ns);
    GlossaryTerm parent = createGlossaryTerm(ns, glossary.getFullyQualifiedName(), null, "parent");
    GlossaryTerm child =
        createGlossaryTerm(
            ns, glossary.getFullyQualifiedName(), parent.getFullyQualifiedName(), "child");

    GlossaryTerm original =
        SdkClients.adminClient().glossaryTerms().get(parent.getId().toString(), "children");
    String newName = original.getName() + "Renamed";
    GlossaryTerm updated = JsonUtils.deepCopy(original, GlossaryTerm.class);
    updated.setName(newName);

    FaultyGlossaryTermRepository repo = new FaultyGlossaryTermRepository();
    repo.deadlockOnFirstUpdateStore = true;
    repo.update(null, JsonUtils.deepCopy(original, GlossaryTerm.class), updated, "admin");
    assertEquals(2, repo.updateStoreAttempts, "first rename store deadlocks, second succeeds");

    GlossaryTerm renamedParent =
        SdkClients.adminClient().glossaryTerms().get(parent.getId().toString());
    assertEquals(newName, renamedParent.getName(), "parent name committed after replay");
    assertEquals(0.2, renamedParent.getVersion(), "rename bumps version exactly once after replay");

    GlossaryTerm renamedChild =
        SdkClients.adminClient().glossaryTerms().get(child.getId().toString());
    assertTrue(
        renamedChild.getFullyQualifiedName().contains(newName),
        "child FQN must be rewritten to the new parent prefix — the rename cascade ran on the "
            + "committed replay (was: "
            + renamedChild.getFullyQualifiedName()
            + ")");

    LOG.info("GlossaryTerm rename deadlock replay applied cascade once for {}", parent.getId());
  }

  /**
   * Subclass-updater replay safety: a DataProduct DOMAIN CHANGE runs a once-per-update cascade
   * gated by {@code DataProductUpdater.domainChangeProcessed} (plus captured-domain state). Without
   * resetting those guards on each retry attempt, the replay after a rolled-back first attempt skips
   * the domain-change cascade/recordChange. This forces a deadlock on the first update store and
   * asserts the committed data product carries the NEW domain with the version bumped exactly once.
   * Fails without the {@code resetForRetryAttempt} hook.
   */
  @Test
  void dataProductDomainChangeDeadlockReplayAppliesOnce(TestNamespace ns) {
    Domain domainA = createDomain(ns, "domainA");
    Domain domainB = createDomain(ns, "domainB");
    DataProduct product = createDataProduct(ns, domainA.getFullyQualifiedName(), "product");

    DataProduct original =
        SdkClients.adminClient().dataProducts().get(product.getId().toString(), "domains");
    DataProduct updated = JsonUtils.deepCopy(original, DataProduct.class);
    updated.setDomains(List.of(domainRef(domainB)));

    FaultyDataProductRepository repo = new FaultyDataProductRepository();
    repo.deadlockOnFirstUpdateStore = true;
    repo.update(null, JsonUtils.deepCopy(original, DataProduct.class), updated, "admin");
    assertEquals(
        2, repo.updateStoreAttempts, "first domain-change store deadlocks, second succeeds");

    DataProduct afterReplay =
        SdkClients.adminClient().dataProducts().get(product.getId().toString(), "domains");
    assertEquals(
        1,
        afterReplay.getDomains().size(),
        "data product belongs to exactly one domain after replay");
    assertEquals(
        domainB.getId(),
        afterReplay.getDomains().get(0).getId(),
        "domain change committed to the new domain on the replay, not skipped");
    assertEquals(
        0.2, afterReplay.getVersion(), "domain change bumps version exactly once after replay");

    LOG.info("DataProduct domain change deadlock replay applied once for {}", product.getId());
  }

  private Glossary createGlossary(TestNamespace ns) {
    return SdkClients.adminClient()
        .glossaries()
        .create(
            new org.openmetadata.schema.api.data.CreateGlossary()
                .withName(ns.shortPrefix("g_" + UUID.randomUUID().toString().substring(0, 8)))
                .withDescription("replay-test glossary"));
  }

  private GlossaryTerm createGlossaryTerm(
      TestNamespace ns, String glossaryFqn, String parentFqn, String baseName) {
    org.openmetadata.schema.api.data.CreateGlossaryTerm request =
        new org.openmetadata.schema.api.data.CreateGlossaryTerm()
            .withName(ns.shortPrefix(baseName + "_" + UUID.randomUUID().toString().substring(0, 8)))
            .withGlossary(glossaryFqn)
            .withDescription("replay-test term");
    if (parentFqn != null) {
      request.withParent(parentFqn);
    }
    return SdkClients.adminClient().glossaryTerms().create(request);
  }

  private Domain createDomain(TestNamespace ns, String baseName) {
    return SdkClients.adminClient()
        .domains()
        .create(
            new CreateDomain()
                .withName(ns.prefix(baseName + "_" + UUID.randomUUID().toString().substring(0, 8)))
                .withDescription("replay-test domain")
                .withDomainType(DomainType.AGGREGATE));
  }

  private DataProduct createDataProduct(TestNamespace ns, String domainFqn, String baseName) {
    return SdkClients.adminClient()
        .dataProducts()
        .create(
            new CreateDataProduct()
                .withName(ns.prefix(baseName + "_" + UUID.randomUUID().toString().substring(0, 8)))
                .withDescription("replay-test data product")
                .withDomains(List.of(domainFqn)));
  }

  private EntityReference domainRef(Domain domain) {
    return new EntityReference().withId(domain.getId()).withType("domain");
  }

  /**
   * Test repository that injects a fault in {@code storeRelationships} — the final DB write of the
   * create flush — so the entity row, extension, owners, and tags are already staged in the open
   * transaction when the exception fires. For the update path it injects in {@code storeEntity(_,
   * true)} so the version-bumped row is staged when the failure/deadlock fires. A plain-new
   * repository shares the global {@code Entity.getCollectionDAO()} and JDBI handle, so it writes to
   * the same database the assertions read.
   */
  private static class FaultyChartRepository extends ChartRepository {
    private boolean failOnStore;
    private boolean deadlockOnFirstAttempt;
    private boolean failOnUpdateStore;
    private boolean deadlockOnFirstUpdateStore;
    private int storeAttempts;
    private int updateStoreAttempts;

    @Override
    public void storeRelationships(Chart chart) {
      storeAttempts++;
      if (failOnStore) {
        throw new IllegalStateException("Injected mid-flush failure for atomicity test");
      }
      if (deadlockOnFirstAttempt && storeAttempts == 1) {
        throw new RuntimeException(
            "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
      }
      super.storeRelationships(chart);
    }

    @Override
    public void storeEntity(Chart chart, boolean update) {
      if (update) {
        updateStoreAttempts++;
        if (failOnUpdateStore) {
          throw new IllegalStateException("Injected mid-update failure for atomicity test");
        }
        if (deadlockOnFirstUpdateStore && updateStoreAttempts == 1) {
          super.storeEntity(chart, true);
          throw new RuntimeException(
              "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
        }
      }
      super.storeEntity(chart, update);
    }
  }

  /**
   * GlossaryTerm variant that deadlocks the first update store so the rename cascade (run earlier in
   * {@code updateInternal}, before {@code storeEntity}) rolls back and replays — exercising the
   * subclass run-once guard reset.
   */
  private static class FaultyGlossaryTermRepository extends GlossaryTermRepository {
    private boolean deadlockOnFirstUpdateStore;
    private int updateStoreAttempts;

    @Override
    public void storeEntity(GlossaryTerm entity, boolean update) {
      if (update) {
        updateStoreAttempts++;
        if (deadlockOnFirstUpdateStore && updateStoreAttempts == 1) {
          super.storeEntity(entity, true);
          throw new RuntimeException(
              "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
        }
      }
      super.storeEntity(entity, update);
    }
  }

  /**
   * DataProduct variant that deadlocks the first update store so the domain-change cascade (run
   * earlier in {@code updateInternal}, before {@code storeEntity}) rolls back and replays —
   * exercising the subclass run-once guard reset.
   */
  private static class FaultyDataProductRepository extends DataProductRepository {
    private boolean deadlockOnFirstUpdateStore;
    private int updateStoreAttempts;

    @Override
    public void storeEntity(DataProduct entity, boolean update) {
      if (update) {
        updateStoreAttempts++;
        if (deadlockOnFirstUpdateStore && updateStoreAttempts == 1) {
          super.storeEntity(entity, true);
          throw new RuntimeException(
              "Injected deadlock", new SQLException("Deadlock", "40001", 1213));
        }
      }
      super.storeEntity(entity, update);
    }
  }
}
