package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.MethodSource;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.factories.TopicTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.search.DocumentParity;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.lineage.AddLineage;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.EntitiesEdge;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.LineageDetails;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.indexes.ColumnSearchIndex;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Asserts that the document live indexing writes and the document a reindex rebuilds are the same
 * document.
 *
 * <p>Nothing else in either repo checks this. Live indexing mutates documents with hand-written
 * painless ({@code SearchRepository.getScriptWithParams}, the cascade scripts); reindex rebuilds
 * them with the declarative projector ({@code SearchIndex.buildSearchIndexDoc}). Those are two
 * independent definitions of the same document and nothing forces them to agree — the javadoc on
 * {@code SearchClient.TAG_RESEPARATION_SCRIPT} says so outright, asking authors to remember to
 * paste a painless snippet so the two paths keep producing the same tag separation.
 *
 * <p>The comparison is deliberately whole-document. Existing guards such as {@code
 * ReindexDocSurvivalIT} assert a handful of named fields and therefore cannot see drift in a field
 * nobody thought to check, which is exactly how the known divergences below survived.
 *
 * <h2>Why this does not simply fail on every difference</h2>
 *
 * There are already-known divergences (catalogued during the indexing-architecture audit). Landing
 * a permanently-red test would break the build for everyone and get muted within a week, so known
 * gaps are tolerated by {@link #KNOWN_DIVERGENCES} and reported; anything else fails. That locks in
 * today's parity and blocks <em>new</em> drift. Each fix deletes its entry, and the entry is the
 * fix's regression test.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class LiveVsReindexParityIT {

  private static final Logger LOG = LoggerFactory.getLogger(LiveVsReindexParityIT.class);

  private static final String TIER_FQN = "Tier.Tier1";
  private static final String DESCRIPTION = "live vs reindex parity fixture";

  /** Scope prefix for a divergence that affects every entity type rather than a specific one. */
  private static final String WILDCARD_SCOPE = "*:";

  /**
   * Document paths where live indexing and reindex are known to disagree. Tolerated, logged, and
   * expected to shrink — never to grow. Add an entry only with an explanation; a tolerated
   * divergence without one is an unexplained bug, and {@link #knownDivergencesAreDocumented}
   * enforces that.
   *
   * <p>Every entry below was found by this test against a live cluster — none was visible to a
   * static reading of the two write paths, which is the argument for the test existing. Each one
   * changes value on affected documents the moment a reindex runs.
   *
   * <p>Keys are {@code entityType:docPath}; {@code *:docPath} marks a divergence that is systemic
   * rather than entity-specific. Scoping matters — a single unscoped {@code descriptionSources}
   * entry silently masked the same divergence on {@code topic} and {@code user} until the keys were
   * qualified.
   */
  private static final Map<String, String> KNOWN_DIVERGENCES =
      Map.ofEntries(
          Map.entry(
              "*:descriptionSources.Ingested",
              "SYSTEMIC: live indexing attributes the description to Ingested, reindex to Manual. "
                  + "Observed on every entity type carrying a description (table, glossaryTerm, "
                  + "topic, user) — the two paths disagree on description provenance for the same "
                  + "unchanged description"),
          Map.entry(
              "*:descriptionSources.Manual",
              "counterpart of *:descriptionSources.Ingested; same single disagreement"),
          Map.entry(
              "*:usageSummary",
              "reindex materialises a zeroed usageSummary skeleton, live indexing omits the field. "
                  + "Unlike votes this cannot be defaulted in the projector — the skeleton carries "
                  + "a computed date that a live build has no way to reproduce"),
          Map.entry(
              "*:votes",
              "reindex writes {upVotes:0,downVotes:0}, live omits the field. NEEDS A DECISION, not "
                  + "a patch: PopulateCommonFieldsTest.testVotes_nullVotes explicitly asserts the "
                  + "live behaviour (no votes key when votes is null), so converging on the reindex "
                  + "side contradicts a deliberate contract; converging on the live side means a "
                  + "live update can no longer clear a vote count back to zero. Surfaces only on an "
                  + "entity never updated after creation — the update path does hydrate votes"));

  // tableWithLineage:lineageSqlQueries and tableWithLineage:upstreamLineage used to live here
  // (catalogued divergence #8). They were removed when LineageIndex.applyLineageFields was fixed to
  // deduplicate edge SQL the way the live ADD_UPDATE_LINEAGE script does. The upstreamLineage entry
  // was the deliberately broad one, so lineage drift is now visible again rather than tolerated.

  // tableColumn:tier.labelType and tableColumn:classificationTags used to live here. They were
  // removed when ColumnSearchIndex.applyInheritedTier was fixed to mark an inherited tier DERIVED
  // and record its FQN in classificationTags. Their absence is that fix's regression test — if the
  // fix regresses, the column case fails again rather than silently drifting.

  private static final Duration PROPAGATION_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private static ServerHandle server;
  private static SearchClient search;
  private static TestNamespace ns;
  private static IndexAliasInspector inspector;

  private static String tableIndex;
  private static String tableId;
  private static String tableColumnFqn;
  private static EntityReference owner;
  private static Glossary glossary;

  /** One seeded entity, with the document live indexing produced for it. */
  private record ParityCase(String label, String index, String id, JsonNode liveDoc) {
    @Override
    public String toString() {
      return label;
    }
  }

  private static final List<ParityCase> CASES = new ArrayList<>();

  @BeforeAll
  static void seedCaptureLiveThenReindex() {
    server = OssTestServer.defaultHandle();
    SdkClients.useFluentApis(SdkClients.adminClient());
    search = new SearchClient(server);
    ns = new TestNamespace("LiveVsReindexParity");
    ns.setMethodId("shared");
    inspector = new IndexAliasInspector(server);

    tableIndex = inspector.indexNameFor(Entity.TABLE);
    tableId = seedTable();

    // Each entry captures what live indexing wrote BEFORE the reindex overwrites it. Adding an
    // entity type is one line — the point is that coverage grows without new plumbing.
    capture("table", Entity.TABLE, tableId);
    capture("glossaryTerm", Entity.GLOSSARY_TERM, seedGlossaryTerm());
    capture("topic", Entity.TOPIC, seedTopic());
    capture("user", Entity.USER, seedUser());
    // The seeded table carries a Tier tag, so its column documents exercise the catalogued
    // divergences #4 and #6 — table-level tags propagated into column tags[], and the dedicated
    // tier field that only a rebuild recomputes.
    capture("tableColumn", Entity.TABLE_COLUMN, ColumnSearchIndex.generateColumnId(tableColumnFqn));
    // A separate table pair, so the plain `table` case stays lineage-free. Exercises catalogued
    // divergence #8: the live ADD_UPDATE_LINEAGE script dedups SQL into lineageSqlQueries, while
    // the rebuild has no counterpart wired up — SearchIndex.populateLineageData has no callers.
    capture("tableWithLineage", Entity.TABLE, seedLineage());
    capture("renamedChildTerm", Entity.GLOSSARY_TERM, seedRenamedParentTerm());
    capture("softDeletedAncestorColumn", Entity.TABLE_COLUMN, seedSoftDeletedAncestor());

    ReindexHelpers.recreateAllAndWait(server, REINDEX_TIMEOUT);
  }

  @AfterAll
  static void cleanup() {
    if (ns != null) {
      NamespaceCleanup.deleteRoots(ns.trackedRoots());
    }
    CASES.clear();
  }

  static List<ParityCase> cases() {
    return CASES;
  }

  @ParameterizedTest(name = "{0}")
  @MethodSource("cases")
  @DisplayName("a reindexed document matches the one live indexing wrote")
  void documentSurvivesReindexUnchanged(final ParityCase parityCase) {
    assertParity(parityCase.index(), parityCase.id(), parityCase.liveDoc(), parityCase.label());
  }

  /**
   * Snapshots what live indexing wrote, for comparison against the rebuild.
   *
   * <p>{@link #awaitIndexed} only waits for the document to <i>exist</i>. Presence is not a settled
   * state: where a fixture writes more than once, the first write can satisfy it and the snapshot
   * then describes an entity state the rebuild will never reproduce, which surfaces as a divergence
   * in whichever field moved. Each {@code seed*} helper is therefore responsible for waiting on a
   * value that only its final write produces before its id reaches this method — see {@link
   * #seedTable}, which pins the column documents to the version its update produced.
   */
  private static void capture(final String label, final String entityType, final String id) {
    final String index = inspector.indexNameFor(entityType);
    final JsonNode liveDoc = awaitIndexed(index, id).deepCopy();
    CASES.add(new ParityCase(label, index, id, liveDoc));
  }

  /**
   * Parity is agreement, not correctness — both paths can agree on a wrong value, and the diff
   * cannot see that. This asserts the value itself for the one case where it is independently
   * known: a column beneath a soft-deleted schema must be flagged deleted on both paths.
   */
  @Test
  @DisplayName("a column under a soft-deleted ancestor is flagged deleted, not merely consistent")
  void softDeletedAncestorFlagsColumnDocument() {
    final ParityCase softDeleted =
        CASES.stream()
            .filter(parityCase -> "softDeletedAncestorColumn".equals(parityCase.label()))
            .findFirst()
            .orElseThrow();

    assertThat(softDeleted.liveDoc().path("deleted").asBoolean())
        .as("live indexing must flag the column document when its schema is soft-deleted")
        .isTrue();
    assertThat(awaitIndexed(softDeleted.index(), softDeleted.id()).path("deleted").asBoolean())
        .as("a rebuild must flag it too")
        .isTrue();
  }

  /**
   * Tier is lifted out of {@code tags[]} into a dedicated field by {@code ParseTags} on the reindex
   * path and by {@code TAG_RESEPARATION_SCRIPT} on the live path — two implementations of one rule.
   * Pinned separately because it is the specific pair those javadocs warn about.
   */
  @Test
  @DisplayName("tag separation agrees across both paths")
  void tagSeparationAgrees() {
    final JsonNode rebuilt = awaitIndexed(tableIndex, tableId);

    assertThat(rebuilt.path("tier").path("tagFQN").asText())
        .as("reindex must reproduce the lifted tier field")
        .isEqualTo(TIER_FQN);
    assertThat(rebuilt.path("tags").toString())
        .as("Tier must not leak back into tags[] on either path")
        .doesNotContain(TIER_FQN);
  }

  private static void assertParity(
      final String index, final String id, final JsonNode liveDoc, final String label) {
    assertThat(liveDoc.isMissingNode())
        .as("live indexing must have produced a %s document to compare against", label)
        .isFalse();

    final JsonNode rebuiltDoc = awaitIndexed(index, id);
    final List<DocumentParity.Difference> differences =
        DocumentParity.diffIgnoring(liveDoc, rebuiltDoc, tolerabledPathsFor(label));

    reportTolerated(liveDoc, rebuiltDoc, label);

    assertThat(differences)
        .as(
            "%s document must be identical whether written by live indexing or rebuilt by reindex; "
                + "an unexpected difference means the two write paths have drifted",
            label)
        .isEmpty();
  }

  /**
   * Tolerated paths are scoped to the entity type that exhibits them, so a divergence accepted on
   * column documents does not silently excuse the same path on tables. Scoping caught {@code
   * descriptionSources} being masked on {@code topic} and {@code user} by a table-level entry.
   *
   * <p>{@code *} scopes a divergence that is genuinely systemic rather than entity-specific.
   */
  private static Set<String> tolerabledPathsFor(final String label) {
    return KNOWN_DIVERGENCES.keySet().stream()
        .filter(key -> key.startsWith(label + ":") || key.startsWith(WILDCARD_SCOPE))
        .map(key -> key.substring(key.indexOf(':') + 1))
        .collect(java.util.stream.Collectors.toSet());
  }

  private static void reportTolerated(
      final JsonNode liveDoc, final JsonNode rebuiltDoc, final String label) {
    for (final DocumentParity.Difference difference : DocumentParity.diff(liveDoc, rebuiltDoc)) {
      final String finding =
          KNOWN_DIVERGENCES.getOrDefault(
              label + ":" + difference.path(),
              KNOWN_DIVERGENCES.get(WILDCARD_SCOPE + difference.path()));
      if (finding != null) {
        LOG.warn("Tolerated {} divergence [{}]: {}", label, finding, difference);
      }
    }
  }

  private static JsonNode awaitIndexed(final String index, final String id) {
    Awaitility.await("document " + id + " present in " + index + " after reindex")
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () ->
                assertThat(DocumentParity.fetchSource(search, index, id).isMissingNode())
                    .isFalse());
    return DocumentParity.fetchSource(search, index, id);
  }

  /**
   * Carries a tier and an owner, so its column documents exercise two different propagation
   * descriptors — {@code TAG_LABEL_LIST} and {@code ENTITY_REFERENCE_LIST}. Both reach the column
   * index through the live cascade and are recomputed by a rebuild, which is precisely the
   * convergence this class exists to assert.
   */
  private static String seedTable() {
    final Table table = ShortStackFactory.table(ns);
    final String id = table.getId().toString();
    table.setDescription(DESCRIPTION);
    table.setTags(
        List.of(
            new TagLabel()
                .withTagFQN(TIER_FQN)
                .withSource(TagLabel.TagSource.CLASSIFICATION)
                .withLabelType(TagLabel.LabelType.MANUAL)));
    table.setOwners(List.of(ownerRef()));
    final Table updated = SdkClients.adminClient().tables().update(id, table);
    tableColumnFqn = updated.getColumns().getFirst().getFullyQualifiedName();
    awaitField(inspector.indexNameFor(Entity.TABLE), id, "description", DESCRIPTION);
    // The column documents are written by a separate sync pass from the table's own document, and
    // each carries the *parent table's* version (ColumnSearchIndex). This table is created and then
    // updated, so awaiting presence alone lets capture() snapshot a column built from the
    // pre-update table: the captured document reads version 0.1 while the rebuild reads 0.2, and
    // the
    // diff reports a divergence that has nothing to do with the two paths disagreeing. Waiting for
    // the version the update produced pins the column documents to the same entity state the
    // rebuild will read.
    awaitField(
        inspector.indexNameFor(Entity.TABLE_COLUMN),
        ColumnSearchIndex.generateColumnId(tableColumnFqn),
        "version",
        String.valueOf(updated.getVersion()));
    return id;
  }

  /**
   * Soft-deletes a schema and returns the id of a column document beneath it.
   *
   * <p>Turns the reachability warning in the mapping validator into a measured fact. The generic
   * soft-delete cascade resolves its targets from the ancestor's `childAliases`, which list `table`
   * but not `tableColumn`, and the subtree soft-delete is a batched write that dispatches no
   * per-table event — so nothing flags the column documents. A reindex rebuilds them from rows that
   * are correctly marked deleted, which is exactly the divergence this comparison surfaces.
   *
   * <p>Uses its own service, database and schema so the soft delete cannot disturb other cases.
   */
  private static String seedSoftDeletedAncestor() {
    final Table table = ShortStackFactory.table(ns);
    final String columnId =
        ColumnSearchIndex.generateColumnId(table.getColumns().getFirst().getFullyQualifiedName());
    awaitIndexed(inspector.indexNameFor(Entity.TABLE_COLUMN), columnId);

    SdkClients.adminClient()
        .databaseSchemas()
        .delete(
            table.getDatabaseSchema().getId().toString(),
            Map.of("hardDelete", "false", "recursive", "true"));

    // The table itself is reachable from the schema's childAliases, so its own document flips.
    awaitField(inspector.indexNameFor(Entity.TABLE), table.getId().toString(), "deleted", "true");
    // The column documents are flagged by a separate cascade
    // (SearchRepository.softDeleteOrRestoreDescendantColumns) that lands after the table's own
    // flip,
    // so the table's flag is not a settled signal for them. Awaiting only that let capture()
    // snapshot
    // a column still reading deleted=false, which fails both this case's parity and the value
    // assertion in softDeletedAncestorFlagsColumnDocument.
    awaitField(inspector.indexNameFor(Entity.TABLE_COLUMN), columnId, "deleted", "true");
    return columnId;
  }

  /** One glossary for every term fixture — its name derives from the namespace, so it is unique. */
  private static Glossary sharedGlossary() {
    if (glossary == null) {
      glossary = ns.trackRoot(Entity.GLOSSARY, GlossaryTestFactory.createSimple(ns));
    }
    return glossary;
  }

  private static String seedGlossaryTerm() {
    final Glossary glossary = sharedGlossary();
    final GlossaryTerm term =
        GlossaryTermTestFactory.createWithDisplayName(ns, glossary, "parity", "Parity");
    final String id = term.getId().toString();
    term.setDescription(DESCRIPTION);
    SdkClients.adminClient().glossaryTerms().update(id, term);
    awaitField(inspector.indexNameFor(Entity.GLOSSARY_TERM), id, "description", DESCRIPTION);
    return id;
  }

  /** A service-backed asset on a different service type from {@link #seedTable()}. */
  private static String seedTopic() {
    final Topic topic = TopicTestFactory.createSimple(ns);
    final String id = topic.getId().toString();
    topic.setDescription(DESCRIPTION);
    SdkClients.adminClient().topics().update(id, topic);
    awaitField(inspector.indexNameFor(Entity.TOPIC), id, "description", DESCRIPTION);
    return id;
  }

  /**
   * Creates an upstream table and a lineage edge carrying a SQL query, returning the id of the
   * downstream table whose document holds {@code upstreamLineage}.
   */
  private static String seedLineage() {
    final Table upstream = ShortStackFactory.table(ns);
    final Table downstream = ShortStackFactory.table(ns);
    final AddLineage edge =
        new AddLineage()
            .withEdge(
                new EntitiesEdge()
                    .withFromEntity(upstream.getEntityReference())
                    .withToEntity(downstream.getEntityReference())
                    .withLineageDetails(
                        new LineageDetails()
                            .withSqlQuery(
                                "SELECT * FROM " + upstream.getFullyQualifiedName() + " -- parity")
                            .withSource(LineageDetails.Source.MANUAL)));
    SdkClients.adminClient().lineage().addLineage(edge);

    final String downstreamId = downstream.getId().toString();
    awaitNonEmpty(inspector.indexNameFor(Entity.TABLE), downstreamId, "upstreamLineage");
    return downstreamId;
  }

  /**
   * Renames a parent glossary term and returns the id of its child, whose own document must follow.
   *
   * <p>A nested rename moves descendant FQNs with a bulk {@code glossaryTermDAO.updateFqn} that
   * dispatches no per-entity event, so without an explicit pass the child's document keeps the
   * pre-rename {@code fullyQualifiedName} until the next reindex — while the reindex rebuilds it
   * correctly. That is the exact shape this comparison catches, and it is the regression test for
   * {@code GlossaryTermRepository.reindexNestedTerms}.
   */
  private static String seedRenamedParentTerm() {
    final Glossary glossary = sharedGlossary();
    final GlossaryTerm parent = GlossaryTermTestFactory.createWithName(ns, glossary, "parent");
    final GlossaryTerm child = GlossaryTermTestFactory.createChild(ns, glossary, parent, "child");
    final String childId = child.getId().toString();
    final String glossaryTermIndex = inspector.indexNameFor(Entity.GLOSSARY_TERM);
    awaitField(glossaryTermIndex, childId, "name", child.getName());

    parent.setName(ns.prefix("parentrenamed"));
    SdkClients.adminClient().glossaryTerms().update(parent.getId().toString(), parent);

    // The child's own document must pick up the moved prefix from the live cascade, not merely at
    // the next reindex.
    awaitFieldContains(glossaryTermIndex, childId, "fullyQualifiedName", "parentrenamed");
    return childId;
  }

  /** The owner cascaded onto the table's column documents; created once, before the table. */
  private static EntityReference ownerRef() {
    if (owner == null) {
      owner = UserTestFactory.createUser(ns, "owner").getEntityReference();
    }
    return owner;
  }

  /** No service, no tags, no lineage — exercises a document shape unlike the data assets. */
  private static String seedUser() {
    final User user = UserTestFactory.createUser(ns, "parity");
    final String id = user.getId().toString();
    user.setDescription(DESCRIPTION);
    SdkClients.adminClient().users().update(id, user);
    awaitField(inspector.indexNameFor(Entity.USER), id, "description", DESCRIPTION);
    return id;
  }

  private static void awaitFieldContains(
      final String index, final String id, final String field, final String expectedFragment) {
    Awaitility.await("live indexing moved " + field + " for " + id)
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () ->
                assertThat(DocumentParity.fetchSource(search, index, id).path(field).asText())
                    .contains(expectedFragment));
  }

  private static void awaitNonEmpty(final String index, final String id, final String field) {
    Awaitility.await("live indexing populated " + field + " for " + id)
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () ->
                assertThat(DocumentParity.fetchSource(search, index, id).path(field).isEmpty())
                    .isFalse());
  }

  private static void awaitField(
      final String index, final String id, final String field, final String expected) {
    Awaitility.await("live indexing wrote " + field + " for " + id)
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () ->
                assertThat(DocumentParity.fetchSource(search, index, id).path(field).asText())
                    .isEqualTo(expected));
  }

  /** Guards the allowlist against silently growing; see {@link #KNOWN_DIVERGENCES}. */
  @Test
  @DisplayName("every tolerated divergence cites the finding that explains it")
  void knownDivergencesAreDocumented() {
    final Set<String> undocumented =
        KNOWN_DIVERGENCES.entrySet().stream()
            .filter(entry -> entry.getValue() == null || entry.getValue().isBlank())
            .map(Map.Entry::getKey)
            .collect(java.util.stream.Collectors.toSet());

    assertThat(undocumented)
        .as("a tolerated divergence without a finding reference is an unexplained bug")
        .isEmpty();
  }
}
