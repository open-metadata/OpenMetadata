/*
 *  Copyright 2024 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file
 *  except in compliance with the License. You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software distributed under the License
 *  is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and limitations under
 *  the License.
 */
package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.END_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils.START_TIMESTAMP_KEY;
import static org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.DataAssetsWorkflow.ENTITY_TYPE_FIELDS_KEY;
import static org.openmetadata.service.workflows.searchIndex.ReindexingUtil.ENTITY_TYPE_KEY;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.DatabaseTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.fluent.Tables;
import org.openmetadata.service.Entity;
import org.openmetadata.service.apps.bundles.insights.utils.TimestampUtils;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.DataInsightsEntityEnricherProcessor;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentContext;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentPipeline;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentStep;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.EnrichmentTarget;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.StepFailure;
import org.openmetadata.service.apps.bundles.insights.workflows.dataAssets.processors.enricher.VersionShape;
import org.openmetadata.service.jdbi3.EntityRepository;
import org.openmetadata.service.util.EntityUtil;

/**
 * Behavior-level assertions for the Data Insights entity enricher. Complements {@link
 * EnricherBulkVsHistoryPathEquivalenceIT} (which only proves that two loading paths agree with
 * each other) by pinning <em>what the enricher actually produces</em> for known input shapes.
 *
 * <p>Together with the unit-level {@code EnrichmentPipelineTest}, this guards against the failure
 * mode where the enricher silently drops entities from the DI index when one step throws on a
 * historical version's bare references. The {@code EnrichmentPipelineTest} covers the isolation
 * contract synthetically; this IT covers it end-to-end on real entities.
 *
 * <p>Test scope, in priority order:
 *
 * <ol>
 *   <li>Pin known snapshot field values for a canonical table — guards against silent shape drift.
 *   <li>Verify graceful degradation when an owner cannot be resolved.
 *   <li>Verify the step-failure-isolation contract end-to-end on a real entity.
 * </ol>
 */
@ExtendWith(TestNamespaceExtension.class)
class DataInsightsEnricherBehaviorIT {

  private static DataInsightsEntityEnricherProcessor enricher;

  /** Common+table fields from {@code dataInsights/config.json}. Mirrors what the real workflow
   *  passes via {@code ENTITY_TYPE_FIELDS_KEY}; mismatching this list would mean the IT tests an
   *  enrichment scope that differs from production. */
  private static final List<String> TABLE_FIELDS =
      List.of(
          "id",
          "description",
          "displayName",
          "name",
          "deleted",
          "version",
          "owners",
          "tags",
          "extension",
          "votes",
          "fullyQualifiedName",
          "domains",
          "dataProducts",
          "certification",
          "classificationTags",
          "glossaryTags",
          "tableType",
          "columns",
          "databaseSchema",
          "tableConstraint",
          "database",
          "service",
          "serviceType");

  @BeforeAll
  static void setupAll() {
    SdkClients.adminClient();
    enricher = new DataInsightsEntityEnricherProcessor(0);
  }

  private SharedEntities shared() {
    return SharedEntities.get();
  }

  // ────────────────────────────── Test 1: snapshot content ──────────────────────────────

  /**
   * Canonical "fully-populated table" — pin the snapshot keys and load-bearing values. If the
   * enricher quietly stops emitting (or starts mis-emitting) any of these fields, this test
   * fails. The current {@link EnricherBulkVsHistoryPathEquivalenceIT} cross-compares two
   * loading paths but never asserts anything about what's <em>in</em> the snapshot, so a uniform
   * shape regression would slip past it.
   */
  @Test
  void tableEntity_canonicalScenario_snapshotPinsKnownFields(TestNamespace ns) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    TagLabel tier =
        new TagLabel()
            .withTagFQN("Tier.Tier2")
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_content"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("DI canonical test table")
            .withDisplayName("DI canonical")
            .withColumns(
                List.of(
                    new Column().withName("id").withDataType(ColumnDataType.BIGINT),
                    new Column()
                        .withName("email")
                        .withDataType(ColumnDataType.VARCHAR)
                        .withDataLength(255)
                        .withDescription("only this column has a description"),
                    new Column().withName("score").withDataType(ColumnDataType.DOUBLE)))
            .withTags(List.of(shared().PERSONAL_DATA_TAG_LABEL, tier))
            .execute();

    // Assign USER1 (member of shared_team1) so processTeam has something to resolve.
    table =
        Tables.find(table.getId().toString())
            .fetch()
            .withOwners(List.of(shared().USER1_REF))
            .save()
            .get();

    Map<String, Object> snapshot = enrichOneDay(table);

    // Identity step + day fanout. Note: startTimestamp/endTimestamp are intentionally removed by
    // generateDailyEntitySnapshots and replaced with @timestamp (one per day). Assert on
    // @timestamp, not the per-version-window keys.
    assertEquals("table", snapshot.get("entityType"), "entityType is set");
    assertNotNull(snapshot.get("@timestamp"), "per-day @timestamp is set");
    assertInstanceOf(Long.class, snapshot.get("@timestamp"), "@timestamp is a long (millis)");
    assertEquals(table.getFullyQualifiedName(), snapshot.get("fullyQualifiedName"));

    // Description stats step
    assertEquals(1, snapshot.get("hasDescription"), "table has description → 1");
    assertEquals(3, snapshot.get("numberOfColumns"));
    assertEquals(1, snapshot.get("numberOfColumnsWithDescription"));
    assertEquals(0, snapshot.get("hasColumnDescription"), "not every column has a description → 0");

    // Team step — owner USER1 → team shared_team1
    assertEquals("shared_team1", snapshot.get("team"));

    // Tier step — extracted from the Tier.Tier2 tag
    assertEquals("Tier.Tier2", snapshot.get("tier"));

    // Tag/Tier sources — both tags are classification-sourced
    assertInstanceOf(Map.class, snapshot.get("tagSources"), "tagSources is a map");
    assertInstanceOf(Map.class, snapshot.get("tierSources"), "tierSources is a map");

    // Description sources (a map)
    assertInstanceOf(Map.class, snapshot.get("descriptionSources"));

    // Projected entity fields — verify retainAll didn't strip these
    assertEquals(table.getName(), snapshot.get("name"));
    assertEquals(table.getDescription(), snapshot.get("description"));
    assertNotNull(snapshot.get("tags"));
    assertTrue(((Collection<?>) snapshot.get("tags")).size() >= 2, "tags array preserved");
    assertNotNull(snapshot.get("columns"));
    assertEquals(3, ((Collection<?>) snapshot.get("columns")).size());
  }

  // ──────────── Test 1b: source-split tag projection (issue #29355) ────────────

  /**
   * Reproduction of issue #29355: a DI chart filtering on {@code classificationTags} or {@code
   * glossaryTags} returned 0 because those derived fields were never projected onto the snapshot.
   * Tag a table with one classification tag and one glossary term, enrich, and assert the snapshot
   * carries each FQN in its source-matched bucket — and that neither leaks into the other (matching
   * the live index's {@code ParseTags} source split).
   */
  @Test
  void tableEntity_classificationAndGlossaryTags_projectedToSourceSplitFields(TestNamespace ns) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_tagsplit"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("source-split tag projection")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .withTags(List.of(shared().PERSONAL_DATA_TAG_LABEL, shared().GLOSSARY1_TERM1_LABEL))
            .execute();

    Map<String, Object> snapshot = enrichOneDay(table);

    String classificationFqn = shared().PERSONAL_DATA_TAG_LABEL.getTagFQN();
    String glossaryFqn = shared().GLOSSARY1_TERM1_LABEL.getTagFQN();

    assertInstanceOf(Collection.class, snapshot.get("classificationTags"));
    assertInstanceOf(Collection.class, snapshot.get("glossaryTags"));
    Collection<?> classificationTags = (Collection<?>) snapshot.get("classificationTags");
    Collection<?> glossaryTags = (Collection<?>) snapshot.get("glossaryTags");

    assertTrue(
        classificationTags.contains(classificationFqn),
        "classification tag FQN projected into classificationTags");
    assertFalse(
        classificationTags.contains(glossaryFqn),
        "glossary term must not leak into classificationTags");
    assertTrue(glossaryTags.contains(glossaryFqn), "glossary term FQN projected into glossaryTags");
    assertFalse(
        glossaryTags.contains(classificationFqn),
        "classification tag must not leak into glossaryTags");
  }

  /**
   * A table with no tags must not spuriously populate the source-split fields. The snapshot may
   * either omit the keys or carry empty collections, but it must contain no FQNs.
   */
  @Test
  void tableEntity_noTags_sourceSplitFieldsEmptyOrAbsent(TestNamespace ns) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_notags"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("no tags")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .execute();

    Map<String, Object> snapshot = enrichOneDay(table);

    Object classificationTags = snapshot.get("classificationTags");
    Object glossaryTags = snapshot.get("glossaryTags");
    assertTrue(
        classificationTags == null || ((Collection<?>) classificationTags).isEmpty(),
        "no tags → no classification FQNs");
    assertTrue(
        glossaryTags == null || ((Collection<?>) glossaryTags).isEmpty(),
        "no tags → no glossary FQNs");
  }

  // ────────────────────────────── Test 2: missing owner ──────────────────────────────

  /**
   * Owner-less entity. The {@code team} key should be absent from the snapshot — the team step
   * has nothing to emit. Verifies the step's <em>additive</em> contract: no-op steps add no keys
   * and never null-poison the doc.
   */
  @Test
  void tableEntity_noOwner_snapshotOmitsTeamField(TestNamespace ns) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_noowner"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("no owner")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .execute();

    Map<String, Object> snapshot = enrichOneDay(table);

    assertFalse(snapshot.containsKey("team"), "no owner → no team key on snapshot");
    assertNull(snapshot.get("team"), "team explicitly null/missing");
    // The rest of the snapshot is still well-formed
    assertEquals("table", snapshot.get("entityType"));
    assertEquals(1, snapshot.get("hasDescription"));
  }

  // ───────────────────── Test 3: owner that cannot be resolved ─────────────────────

  /**
   * Owner-deleted regression. When the enricher hits an owner ref it cannot resolve (e.g. a
   * hard-deleted user), the snapshot must still be emitted with the {@code team} key gracefully
   * absent — never aborting the entity's enrichment. Creates an owner, attaches it,
   * hard-deletes the user, then enriches and asserts the snapshot is preserved.
   */
  @Test
  void tableEntity_ownerHardDeletedBeforeEnrichment_snapshotStillEmits_teamFieldAbsent(
      TestNamespace ns) {
    User ephemeralOwner =
        SdkClients.adminClient()
            .users()
            .create(
                new CreateUser()
                    .withName(ns.shortPrefix("ephemeral"))
                    .withEmail(ns.shortPrefix("ephemeral") + "@test.openmetadata.org"));

    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_orphan"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("owner about to be hard-deleted")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .execute();
    table =
        Tables.find(table.getId().toString())
            .fetch()
            .withOwners(List.of(ephemeralOwner.getEntityReference()))
            .save()
            .get();

    // Hard delete the owner — the table's owners array still points to the now-gone user id.
    SdkClients.adminClient()
        .users()
        .delete(
            ephemeralOwner.getId().toString(), Map.of("hardDelete", "true", "recursive", "true"));

    // Refresh: the SDK returns the table with the dangling owner reference still recorded.
    Table refreshed = Tables.find(table.getId().toString()).fetch().get();

    Map<String, Object> snapshot = enrichOneDay(refreshed);

    // The entity is still in the snapshot — no NPE escaped to drop it.
    assertEquals("table", snapshot.get("entityType"));
    assertEquals(refreshed.getFullyQualifiedName(), snapshot.get("fullyQualifiedName"));

    // The team field is absent because the owner could not be resolved.
    assertFalse(
        snapshot.containsKey("team"),
        "owner unresolvable → no team key, but the snapshot is still emitted");
  }

  // ───────────── Test 4: end-to-end step-failure isolation on a real entity ─────────────

  /**
   * End-to-end proof that one step throwing does not lose the entity's snapshot — exercised
   * on a real entity instead of a synthetic mock as in {@code EnrichmentPipelineTest}. The test
   * builds its own pipeline with a guaranteed-failing step alongside two trivial steps; running
   * it against a real table verifies the contract holds when steps interact with real
   * deserialized entity state.
   */
  @Test
  void stepFailureIsolation_onRealTableEntity_siblingStepsStillContribute(TestNamespace ns) {
    DatabaseService svc = DatabaseServiceTestFactory.create(ns, "Postgres");
    Database db = DatabaseTestFactory.create(ns, svc.getFullyQualifiedName());
    DatabaseSchema schema = DatabaseSchemaTestFactory.create(ns, db.getFullyQualifiedName());

    Table table =
        Tables.create()
            .name(ns.shortPrefix("tbl_fail"))
            .inSchema(schema.getFullyQualifiedName())
            .withDescription("step-failure isolation")
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.BIGINT)))
            .execute();

    EnrichmentPipeline customPipeline =
        new EnrichmentPipeline(
            List.of(
                lambdaStep("first", t -> t.entityMap().put("firstStepKey", "first")),
                lambdaStep(
                    "boom",
                    t -> {
                      throw new RuntimeException("simulated failure on real entity");
                    }),
                lambdaStep("last", t -> t.entityMap().put("lastStepKey", "last"))));

    Map<String, Object> entityMap = JsonUtils.getMap(table);
    EnrichmentContext context = new EnrichmentContext("table", TABLE_FIELDS, 0L, 86_400_000L);
    EnrichmentTarget target =
        new EnrichmentTarget(
            table, entityMap, Map.of(), 0L, 86_400_000L, context, VersionShape.LATEST_HYDRATED);

    List<StepFailure> failures = customPipeline.run(target);

    assertEquals(1, failures.size(), "exactly one step failed");
    assertEquals("boom", failures.get(0).stepName());
    assertEquals(table.getFullyQualifiedName(), failures.get(0).entityFqn());

    // Sibling steps' contributions present despite the failure in the middle step.
    assertEquals("first", entityMap.get("firstStepKey"));
    assertEquals("last", entityMap.get("lastStepKey"));

    // Pipeline stats record the failure correctly.
    Map<String, ?> stats = customPipeline.snapshotStats();
    assertNotNull(stats.get("first"));
    assertNotNull(stats.get("boom"));
    assertNotNull(stats.get("last"));
  }

  // ───────────────────────────── helpers ─────────────────────────────

  /**
   * Loads the entity via the {@link EntityRepository} (matching production's keyset-batch path,
   * the same way {@link EnricherBulkVsHistoryPathEquivalenceIT} does), then enriches it. The
   * window is end-of-today through start-of-yesterday — day-aligned, as the production workflow
   * uses, so the version-walk timestamps fall inside the window predictably.
   */
  @SuppressWarnings("unchecked")
  private Map<String, Object> enrichOneDay(Table table) {
    EntityRepository<Table> repo = (EntityRepository<Table>) Entity.getEntityRepository("table");
    EntityUtil.Fields allFields = repo.getFields("*");
    Table loaded = repo.findByName(table.getFullyQualifiedName(), Include.NON_DELETED, false);
    repo.setFieldsInBulk(allFields, List.of(loaded));

    long now = System.currentTimeMillis();
    long endTs = TimestampUtils.getEndOfDayTimestamp(now);
    long startTs = TimestampUtils.getStartOfDayTimestamp(TimestampUtils.subtractDays(now, 1));

    Map<String, Object> ctx = new HashMap<>();
    ctx.put(ENTITY_TYPE_KEY, "table");
    ctx.put(START_TIMESTAMP_KEY, startTs);
    ctx.put(END_TIMESTAMP_KEY, endTs);
    ctx.put(ENTITY_TYPE_FIELDS_KEY, new ArrayList<>(TABLE_FIELDS));

    try {
      List<Map<String, Object>> snapshots = enricher.enrichSingle(loaded, ctx);
      assertFalse(snapshots.isEmpty(), "enricher must emit at least one snapshot");
      return snapshots.get(0);
    } catch (Exception e) {
      throw new AssertionError(
          "enricher.enrichSingle threw — this is the failure mode the redesign prevents", e);
    }
  }

  private static EnrichmentStep lambdaStep(String name, Consumer<EnrichmentTarget> body) {
    return new EnrichmentStep() {
      @Override
      public String name() {
        return name;
      }

      @Override
      public void apply(EnrichmentTarget target) {
        body.accept(target);
      }
    };
  }
}
