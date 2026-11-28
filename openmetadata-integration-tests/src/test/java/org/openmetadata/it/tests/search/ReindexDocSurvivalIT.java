package org.openmetadata.it.tests.search;

import static org.assertj.core.api.Assertions.assertThat;

import com.fasterxml.jackson.databind.JsonNode;
import java.time.Duration;
import java.util.List;
import java.util.function.Function;
import org.awaitility.Awaitility;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.junit.jupiter.api.parallel.ResourceAccessMode;
import org.junit.jupiter.api.parallel.ResourceLock;
import org.openmetadata.it.factories.DashboardServiceTestFactory;
import org.openmetadata.it.factories.GlossaryTermTestFactory;
import org.openmetadata.it.factories.GlossaryTestFactory;
import org.openmetadata.it.factories.ShortStackFactory;
import org.openmetadata.it.search.IndexAliasInspector;
import org.openmetadata.it.search.ReindexHelpers;
import org.openmetadata.it.search.SearchClient;
import org.openmetadata.it.server.ServerHandle;
import org.openmetadata.it.util.NamespaceCleanup;
import org.openmetadata.it.util.OssTestServer;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.schema.api.classification.CreateClassification;
import org.openmetadata.schema.api.classification.CreateTag;
import org.openmetadata.schema.api.data.CreateDashboardDataModel;
import org.openmetadata.schema.api.data.UpdateColumn;
import org.openmetadata.schema.api.teams.CreateTeam;
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.classification.Tag;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.DataModelType;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * Consolidated regression gate for the four "doc survives a full recreate reindex" guards that
 * previously lived as one-test-per-class UIITs ({@code GlossaryRenameSearchUIIT},
 * {@code ClassificationRenameSearchUIIT}, {@code TestCaseResultReindexUIIT},
 * {@code TestCaseTierRebuildUIIT}). Each of those triggered its own full {@code recreateAllAndWait},
 * so on a shared/static cluster (where one recreate is ~10-12 min) they cost ~4x that serially.
 *
 * <p>The reindex is a global, singleton, expensive operation — there's no reason to run it per test.
 * This class seeds and mutates every fixture up front, runs the recreate reindex <b>once</b> in
 * {@code @BeforeAll}, then asserts each independent invariant in its own {@code @Test}: one reindex,
 * full fidelity (real recreate + alias swap + selective-field fetch), per-scenario reporting.
 *
 * <p>These are backend index assertions (via {@link SearchClient}) with no browser interaction, so
 * they belong in the {@code search-it} suite rather than the Playwright {@code ui-it} suite.
 */
@Execution(ExecutionMode.SAME_THREAD)
@ResourceLock(value = "SEARCH_INDEX_APP", mode = ResourceAccessMode.READ_WRITE)
class ReindexDocSurvivalIT {

  private static final String ORIGINAL_DISPLAY_NAME = "CLV";
  // New name starts with the old one — the condition that triggered the double find-replace
  // (#28725).
  private static final String RENAMED_DISPLAY_NAME = "CLV Renamed";
  private static final String TIER_FQN = "Tier.Tier1";
  private static final String EXPECTED_STATUS = "Failed";

  private static final Duration PROPAGATION_TIMEOUT = ReindexHelpers.searchPropagationTimeout();
  private static final Duration REINDEX_TIMEOUT = ReindexHelpers.reindexTimeout();
  private static final Duration POLL_INTERVAL = Duration.ofSeconds(2);

  private static ServerHandle server;
  private static SearchClient search;
  private static TestNamespace ns;

  private static String glossaryTermIndex;
  private static String classificationIndex;
  private static String testCaseIndex;
  private static String dashboardDataModelIndex;
  private static String glossaryTermId;
  private static String classificationId;
  private static String resultTestCaseId;
  private static String tierTestCaseId;
  private static String ddmDataModelId;
  private static String ddmColumnTagFqn;
  private static String ddmColumnRefPropName;
  private static String ddmRefTeamId;

  @BeforeAll
  static void seedMutateAndReindex() throws Exception {
    server = OssTestServer.defaultHandle();
    SdkClients.useFluentApis(SdkClients.adminClient());
    search = new SearchClient(server);
    ns = new TestNamespace("ReindexDocSurvival");
    ns.setMethodId("shared");

    final IndexAliasInspector inspector = new IndexAliasInspector(server);
    glossaryTermIndex = inspector.indexNameFor(Entity.GLOSSARY_TERM);
    classificationIndex = inspector.indexNameFor(Entity.CLASSIFICATION);
    testCaseIndex = inspector.indexNameFor(Entity.TEST_CASE);
    dashboardDataModelIndex = inspector.indexNameFor(Entity.DASHBOARD_DATA_MODEL);

    seedGlossaryRename();
    seedClassificationRename();
    seedTestCaseResult();
    seedTestCaseTier();
    seedDashboardDataModelColumns();

    ReindexHelpers.recreateAllAndWait(server, REINDEX_TIMEOUT);
  }

  @AfterAll
  static void cleanup() {
    if (ns != null) {
      NamespaceCleanup.deleteRoots(ns.trackedRoots());
    }
  }

  @Test
  void glossaryTermRenameSurvivesReindexWithoutDoubleApply() {
    awaitIndexedField(
        glossaryTermIndex,
        glossaryTermId,
        "displayName",
        src -> src.path("displayName").asText(),
        RENAMED_DISPLAY_NAME,
        "glossaryTerm displayName == '" + RENAMED_DISPLAY_NAME + "' after recreate reindex");
  }

  @Test
  void classificationRenameSurvivesReindexWithoutDoubleApply() {
    awaitIndexedField(
        classificationIndex,
        classificationId,
        "displayName",
        src -> src.path("displayName").asText(),
        RENAMED_DISPLAY_NAME,
        "classification displayName == '" + RENAMED_DISPLAY_NAME + "' after recreate reindex");
  }

  @Test
  void testCaseResultStatusSurvivesRecreateReindex() {
    awaitIndexedField(
        testCaseIndex,
        resultTestCaseId,
        "testCaseResult",
        src -> src.path("testCaseResult").path("testCaseStatus").asText(),
        EXPECTED_STATUS,
        "recreate reindex must keep testCaseResult.testCaseStatus");
  }

  @Test
  void testCaseTierSurvivesRecreateReindex() {
    awaitIndexedField(
        testCaseIndex,
        tierTestCaseId,
        "tier",
        src -> src.path("tier").path("tagFQN").asText(),
        TIER_FQN,
        "recreate reindex must not strip Tier from the TestCase doc");
  }

  /**
   * Regression for DashboardDataModelIndex.getRequiredReindexFields() omitting "columns": after a
   * recreate reindex, column-level tags merged into doc-level {@code tags[]} via {@code
   * mergeChildTags} must still be present. {@code DashboardDataModelRepository.fetchAndSetColumnTags}
   * only re-reads {@code tag_usage} / recomputes derived tags / applies glossary-term inheritance
   * when "columns" is in the field set; without it the reindex-built doc serves stale or empty
   * column tags in the Explore tag facet.
   */
  @Test
  void dashboardDataModelColumnTagSurvivesRecreateReindex() {
    awaitIndexedPredicate(
        dashboardDataModelIndex,
        ddmDataModelId,
        "tags",
        src -> {
          for (JsonNode tag : src.path("tags")) {
            if (ddmColumnTagFqn.equals(tag.path("tagFQN").asText())) {
              return true;
            }
          }
          return false;
        },
        "recreate reindex must keep the dashboardDataModel column classification tag '"
            + ddmColumnTagFqn
            + "' in _source.tags[].tagFQN");
  }

  /**
   * Regression for DashboardDataModelIndex.getRequiredReindexFields() omitting "columns": after a
   * recreate reindex, a reference-typed (entityReferenceList) column custom property must still be
   * present in {@code columns[].customPropertiesTyped[]} with its {@code refId} populated.
   * Reference values live only in {@code custom_property_reference} and are merged back into {@code
   * columns[].extension} only by {@code DashboardDataModelRepository.applyColumnReferences}, which
   * is "columns"-gated; {@code SearchIndexUtils.transformColumnExtensions} then builds {@code
   * customPropertiesTyped} from that extension. Without "columns" in the reindex field set the
   * reference custom property is dropped from the doc entirely.
   */
  @Test
  void dashboardDataModelColumnReferenceCustomPropertySurvivesRecreateReindex() {
    awaitIndexedPredicate(
        dashboardDataModelIndex,
        ddmDataModelId,
        "columns",
        src -> {
          for (JsonNode column : src.path("columns")) {
            for (JsonNode cp : column.path("customPropertiesTyped")) {
              if (ddmColumnRefPropName.equals(cp.path("name").asText())
                  && ddmRefTeamId.equals(cp.path("refId").asText())
                  && "team".equals(cp.path("refType").asText())) {
                return true;
              }
            }
          }
          return false;
        },
        "recreate reindex must keep the dashboardDataModel column reference custom property '"
            + ddmColumnRefPropName
            + "' (refId="
            + ddmRefTeamId
            + ") in _source.columns[].customPropertiesTyped[]");
  }

  private static void seedGlossaryRename() {
    final Glossary glossary = ns.trackRoot(Entity.GLOSSARY, GlossaryTestFactory.createSimple(ns));
    final GlossaryTerm term =
        GlossaryTermTestFactory.createWithDisplayName(ns, glossary, "clv", ORIGINAL_DISPLAY_NAME);
    glossaryTermId = term.getId().toString();
    awaitDisplayName(
        glossaryTermIndex, glossaryTermId, ORIGINAL_DISPLAY_NAME, "glossaryTerm seeded");
    term.setDisplayName(RENAMED_DISPLAY_NAME);
    SdkClients.adminClient().glossaryTerms().update(glossaryTermId, term);
    awaitDisplayName(glossaryTermIndex, glossaryTermId, RENAMED_DISPLAY_NAME, "glossaryTerm live");
  }

  private static void seedClassificationRename() {
    final CreateClassification request =
        new CreateClassification()
            .withName(ns.prefix("clv"))
            .withDisplayName(ORIGINAL_DISPLAY_NAME)
            .withDescription("rename guard");
    final Classification classification =
        ns.trackRoot(
            Entity.CLASSIFICATION, SdkClients.adminClient().classifications().create(request));
    classificationId = classification.getId().toString();
    awaitDisplayName(
        classificationIndex, classificationId, ORIGINAL_DISPLAY_NAME, "classification seeded");
    classification.setDisplayName(RENAMED_DISPLAY_NAME);
    SdkClients.adminClient().classifications().update(classificationId, classification);
    awaitDisplayName(
        classificationIndex, classificationId, RENAMED_DISPLAY_NAME, "classification live");
  }

  private static void seedTestCaseResult() {
    final Table table = ShortStackFactory.table(ns);
    final TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("tcresult"))
            .description("status-after-reindex guard")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
    resultTestCaseId = testCase.getId().toString();
    final CreateTestCaseResult result =
        new CreateTestCaseResult()
            .withTimestamp(System.currentTimeMillis())
            .withTestCaseStatus(TestCaseStatus.Failed)
            .withResult("seeded failure for reindex guard");
    SdkClients.adminClient().testCaseResults().create(testCase.getFullyQualifiedName(), result);
  }

  private static void seedTestCaseTier() {
    final Table table = ShortStackFactory.table(ns);
    final TestCase testCase =
        TestCaseBuilder.create(SdkClients.adminClient())
            .name(ns.prefix("tctier"))
            .description("tier-after-rebuild guard")
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
    tierTestCaseId = testCase.getId().toString();
    final TagLabel tier =
        new TagLabel()
            .withTagFQN(TIER_FQN)
            .withSource(TagLabel.TagSource.CLASSIFICATION)
            .withLabelType(TagLabel.LabelType.MANUAL);
    testCase.setTags(List.of(tier));
    SdkClients.adminClient().testCases().update(tierTestCaseId, testCase);
  }

  /**
   * Seeds a DashboardDataModel whose single column carries both a classification tag and a
   * reference-list custom property, then awaits the live-indexed doc (pre-reindex baseline) so the
   * post-reindex assertions are a clean before/after comparison of the recreate path. The custom
   * property is added to the {@code dashboardDataModelColumn} type restricted to {@code team}; the
   * column's extension holds a single {@code team} reference (its value lives only in {@code
   * custom_property_reference}, which is what makes the reindex regression meaningful).
   */
  private static void seedDashboardDataModelColumns() throws Exception {
    final OpenMetadataClient client = SdkClients.adminClient();
    final String propName = ns.prefix("ddmTeamRefs");
    final Team team =
        client
            .teams()
            .create(
                new CreateTeam()
                    .withName(ns.prefix("refTeam"))
                    .withTeamType(CreateTeam.TeamType.GROUP));
    ddmRefTeamId = team.getId().toString();

    // Add an entityReferenceList custom property restricted to "team" on the
    // dashboardDataModelColumn type, so the column extension below validates.
    final Type entityReferenceListType = getTypeByName(client, "entityReferenceList");
    addColumnCustomProperty(
        client, "dashboardDataModelColumn", propName, entityReferenceListType, "team");
    ddmColumnRefPropName = propName;

    // Classification + tag applied to the column.
    final Classification classification = createClassification(client, ns, "DdmReindexCol");
    final Tag tag = createTag(client, classification, "ColumnTag");
    ddmColumnTagFqn = tag.getFullyQualifiedName();

    final DashboardService service =
        ns.trackRoot(Entity.DASHBOARD_SERVICE, DashboardServiceTestFactory.createLooker(ns));
    final java.util.Map<String, Object> teamRef =
        java.util.Map.of(
            "id", team.getId().toString(),
            "type", "team",
            "name", team.getName(),
            "fullyQualifiedName", team.getFullyQualifiedName());
    final Column metric =
        new Column()
            .withName("metric1")
            .withDataType(ColumnDataType.BIGINT)
            .withExtension(java.util.Map.of(propName, List.of(teamRef)));
    final DashboardDataModel dataModel =
        client
            .dashboardDataModels()
            .create(
                new CreateDashboardDataModel()
                    .withName(ns.prefix("reindexDdm"))
                    .withService(service.getFullyQualifiedName())
                    .withDataModelType(DataModelType.LookMlView)
                    .withColumns(List.of(metric)));
    ddmDataModelId = dataModel.getId().toString();

    // Apply the classification tag to the column via the column-update PUT.
    final UpdateColumn tagUpdate = new UpdateColumn();
    tagUpdate.setTags(
        List.of(
            new TagLabel()
                .withTagFQN(tag.getFullyQualifiedName())
                .withSource(TagLabel.TagSource.CLASSIFICATION)));
    updateColumn(
        client,
        dataModel.getColumns().get(0).getFullyQualifiedName(),
        "dashboardDataModel",
        tagUpdate);

    // Baseline: live indexing must already have the column tag and the reference custom property.
    // If this fails, the seed shape is wrong (not a reindex regression).
    awaitIndexedPredicate(
        dashboardDataModelIndex,
        ddmDataModelId,
        "tags",
        src -> {
          for (JsonNode t : src.path("tags")) {
            if (ddmColumnTagFqn.equals(t.path("tagFQN").asText())) {
              return true;
            }
          }
          return false;
        },
        "BEFORE reindex: dashboardDataModel column tag must be live-indexed into _source.tags[]");
    awaitIndexedPredicate(
        dashboardDataModelIndex,
        ddmDataModelId,
        "columns",
        src -> {
          for (JsonNode column : src.path("columns")) {
            for (JsonNode cp : column.path("customPropertiesTyped")) {
              if (propName.equals(cp.path("name").asText())
                  && team.getId().toString().equals(cp.path("refId").asText())) {
                return true;
              }
            }
          }
          return false;
        },
        "BEFORE reindex: dashboardDataModel column reference custom property must be live-indexed"
            + " into _source.columns[].customPropertiesTyped[]");
  }

  private static void awaitDisplayName(
      final String index, final String id, final String expected, final String label) {
    awaitIndexedField(
        index, id, "displayName", src -> src.path("displayName").asText(), expected, label);
  }

  private static void awaitIndexedField(
      final String index,
      final String id,
      final String sourceField,
      final Function<JsonNode, String> extract,
      final String expected,
      final String description) {
    Awaitility.await(description)
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(() -> assertIndexedField(index, id, sourceField, extract, expected));
  }

  private static void assertIndexedField(
      final String index,
      final String id,
      final String sourceField,
      final Function<JsonNode, String> extract,
      final String expected) {
    final String query =
        "{\"query\":{\"term\":{\"id.keyword\":\""
            + id
            + "\"}},\"_source\":[\""
            + sourceField
            + "\"]}";
    final JsonNode hits = search.search(index, query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for %s", id).isEqualTo(1);
    assertThat(extract.apply(hits.get(0).path("_source"))).isEqualTo(expected);
  }

  /**
   * Awaits a boolean predicate over the {@code _source} of the single doc matching {@code id}, with
   * a {@code _source} projection of {@code sourceField}. Used for list/object invariants (e.g.
   * "tags[] contains FQN", "columns[].customPropertiesTyped[] contains ref entry") that the
   * equality-based {@link #awaitIndexedField} can't express.
   */
  private static void awaitIndexedPredicate(
      final String index,
      final String id,
      final String sourceField,
      final java.util.function.Predicate<JsonNode> predicate,
      final String description) {
    Awaitility.await(description)
        .atMost(PROPAGATION_TIMEOUT)
        .pollInterval(POLL_INTERVAL)
        .pollDelay(Duration.ZERO)
        .ignoreNoExceptions()
        .untilAsserted(
            () -> {
              final String query =
                  "{\"query\":{\"term\":{\"id.keyword\":\""
                      + id
                      + "\"}},\"_source\":[\""
                      + sourceField
                      + "\"]}";
              final JsonNode hits = search.search(index, query).path("hits").path("hits");
              assertThat(hits.size()).as("exactly one indexed doc for %s", id).isEqualTo(1);
              assertThat(predicate.test(hits.get(0).path("_source"))).as(description).isTrue();
            });
  }

  private static Type getTypeByName(final OpenMetadataClient client, final String name)
      throws Exception {
    final String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return new com.fasterxml.jackson.databind.ObjectMapper().readValue(response, Type.class);
  }

  private static void addColumnCustomProperty(
      final OpenMetadataClient client,
      final String columnTypeName,
      final String propertyName,
      final Type propertyType,
      final String restrictedEntityType)
      throws Exception {
    final String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET,
                "/v1/metadata/types/name/" + columnTypeName + "?fields=customProperties",
                null);
    final Type columnType =
        new com.fasterxml.jackson.databind.ObjectMapper().readValue(response, Type.class);
    final org.openmetadata.schema.entity.type.CustomProperty customProperty =
        new org.openmetadata.schema.entity.type.CustomProperty()
            .withName(propertyName)
            .withDescription(
                "ReindexDocSurvivalIT reference column custom property: " + propertyName)
            .withPropertyType(propertyType.getEntityReference());
    final CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(List.of(restrictedEntityType));
    customProperty.withCustomPropertyConfig(config);
    client
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/metadata/types/" + columnType.getId().toString(),
            customProperty,
            Type.class);
  }

  private static Classification createClassification(
      final OpenMetadataClient client, final TestNamespace ns, final String classificationName) {
    return client
        .classifications()
        .create(
            new CreateClassification()
                .withName(ns.prefix(classificationName))
                .withDescription("ReindexDocSurvivalIT classification for " + classificationName));
  }

  private static Tag createTag(
      final OpenMetadataClient client, final Classification classification, final String tagName) {
    return client
        .tags()
        .create(
            new CreateTag()
                .withName(tagName)
                .withDescription("ReindexDocSurvivalIT tag: " + tagName)
                .withClassification(classification.getFullyQualifiedName()));
  }

  private static Column updateColumn(
      final OpenMetadataClient client,
      final String columnFqn,
      final String entityType,
      final UpdateColumn update)
      throws Exception {
    final String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.PUT,
                "/v1/columns/name/" + encodeURIComponent(columnFqn) + "?entityType=" + entityType,
                update);
    return new com.fasterxml.jackson.databind.ObjectMapper().readValue(response, Column.class);
  }

  private static String encodeURIComponent(final String value) throws Exception {
    return java.net.URLEncoder.encode(value, "UTF-8").replace("+", "%20");
  }
}
