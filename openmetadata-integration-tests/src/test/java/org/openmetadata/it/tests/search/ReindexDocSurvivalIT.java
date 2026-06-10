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
import org.openmetadata.schema.api.tests.CreateTestCaseResult;
import org.openmetadata.schema.entity.classification.Classification;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.GlossaryTerm;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.tests.type.TestCaseStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
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
  private static String glossaryTermId;
  private static String classificationId;
  private static String resultTestCaseId;
  private static String tierTestCaseId;

  @BeforeAll
  static void seedMutateAndReindex() {
    server = OssTestServer.defaultHandle();
    SdkClients.useFluentApis(SdkClients.adminClient());
    search = new SearchClient(server);
    ns = new TestNamespace("ReindexDocSurvival");
    ns.setMethodId("shared");

    final IndexAliasInspector inspector = new IndexAliasInspector(server);
    glossaryTermIndex = inspector.indexNameFor(Entity.GLOSSARY_TERM);
    classificationIndex = inspector.indexNameFor(Entity.CLASSIFICATION);
    testCaseIndex = inspector.indexNameFor(Entity.TEST_CASE);

    seedGlossaryRename();
    seedClassificationRename();
    seedTestCaseResult();
    seedTestCaseTier();

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
    final JsonNode hits = search.post("/" + index + "/_search", query).path("hits").path("hits");
    assertThat(hits.size()).as("exactly one indexed doc for %s", id).isEqualTo(1);
    assertThat(extract.apply(hits.get(0).path("_source"))).isEqualTo(expected);
  }
}
