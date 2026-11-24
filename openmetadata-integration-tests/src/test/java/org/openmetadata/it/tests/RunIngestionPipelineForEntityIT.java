/*
 *  Copyright 2025 Collate
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
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.bootstrap.SharedEntities;
import org.openmetadata.it.factories.DatabaseSchemaTestFactory;
import org.openmetadata.it.factories.DatabaseServiceTestFactory;
import org.openmetadata.it.factories.TableTestFactory;
import org.openmetadata.it.factories.UserTestFactory;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.policies.CreatePolicy;
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.services.ingestionPipelines.RunIngestionPipelineForEntity;
import org.openmetadata.schema.api.teams.CreateRole;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.policies.Policy;
import org.openmetadata.schema.entity.policies.accessControl.Rule;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceMetadataPipeline;
import org.openmetadata.schema.metadataIngestion.DatabaseServiceProfilerPipeline;
import org.openmetadata.schema.metadataIngestion.FilterPattern;
import org.openmetadata.schema.metadataIngestion.Incremental;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;
import org.openmetadata.service.Entity;

/**
 * POST /v1/services/ingestionPipelines/run runs the enabled, deployed pipeline of a type that owns
 * an entity, scoped to that entity. Whether the shared IT server has a pipeline service client
 * depends on which suites ran first - the Kubernetes pipeline tests install one - so an accepted run
 * is asserted by its 200 response, not by what the client reports. How each pipeline type is
 * narrowed to the entity is covered by SourceConfigScopersTest, and how the scope reaches each
 * runner by RunOptionsTest, AirflowRESTClientTest, K8sPipelineClientTest and
 * MeteredPipelineServiceClientTest.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class RunIngestionPipelineForEntityIT {

  private record Fixture(DatabaseService service, Table table, TestCase testCase) {}

  @Test
  void aTestCaseWithoutADeployedSuitePipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> runTestCase(adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
    assertTrue(
        error.getMessage().contains(testCase.getFullyQualifiedName()),
        "The error should name the test case that has no pipeline: " + error.getMessage());
  }

  @Test
  void aTestCaseRunsItsSuitePipelineWithoutPersistingTheScope(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());

    assertEquals(200, runTestCase(adminClient(), testCase).getCode());
    assertNull(
        storedConfig(pipeline, TestSuitePipeline.class).getTestCases(),
        "Running one test case must not narrow the suite pipeline for later scheduled runs");
  }

  @Test
  void runningRequiresTriggerPermissionOnThePipeline(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    createTestSuitePipeline(ns, testCase.getTestSuite());
    // Without the user row the token resolves to 404 (user not found) instead of 403.
    UserTestFactory.getDataConsumer(ns);

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> runTestCase(SdkClients.dataConsumerClient(), testCase));

    assertEquals(403, error.getStatusCode());
  }

  @Test
  void runningRequiresViewPermissionOnTheTargetEntity(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    createTestSuitePipeline(ns, testCase.getTestSuite());

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> runTestCase(clientDeniedViewOnTestCases(ns), testCase));

    assertEquals(403, error.getStatusCode());
  }

  @Test
  void aDataStewardCanRunATestCaseWithTriggerButWithoutEditTests(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    createTestSuitePipeline(ns, testCase.getTestSuite());

    assertEquals(200, runTestCase(dataStewardClient(ns), testCase).getCode());
  }

  @Test
  void aTestCaseWithOnlyAnUndeployedPipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    createUndeployedTestSuitePipeline(ns, testCase.getTestSuite());

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> runTestCase(adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
  }

  @Test
  void aTestCaseWithOnlyADisabledPipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    patchPipeline(pipeline, "/enabled", false);

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> runTestCase(adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
  }

  @Test
  void aTestCaseRunsTheDeployedPipelineWhenItsSuiteAlsoHasAnUndeployedOne(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    createUndeployedTestSuitePipeline(ns, testCase.getTestSuite());
    createTestSuitePipeline(ns, testCase.getTestSuite());

    assertEquals(200, runTestCase(adminClient(), testCase).getCode());
  }

  /**
   * A run already in progress does not block another: it may belong to a different suite's
   * pipeline, be stuck, or predate the data change the user wants to re-check.
   */
  @Test
  void aTestCaseRunIsAcceptedWhileItsSuitePipelineIsRunning(TestNamespace ns) {
    TestCase testCase = createFixture(ns).testCase();
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    reportStatus(pipeline, PipelineStatusType.RUNNING);

    assertEquals(200, runTestCase(adminClient(), testCase).getCode());
  }

  @Test
  void anUnknownTestCaseIsNotFound() {
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () ->
                run(
                    adminClient(),
                    "<#E::testCase::no_such_service.db.sc.tb.no_such_test_case>",
                    PipelineType.TEST_SUITE));

    assertEquals(404, error.getStatusCode());
  }

  @Test
  void aTableRunsItsServiceProfilerPipelineWithoutPersistingTheScope(TestNamespace ns) {
    Fixture fixture = createFixture(ns);
    FilterPattern deployedTableFilter = new FilterPattern().withIncludes(List.of("orders.*"));
    IngestionPipeline pipeline =
        createServicePipeline(
            ns,
            fixture.service(),
            PipelineType.PROFILER,
            new DatabaseServiceProfilerPipeline().withTableFilterPattern(deployedTableFilter));

    assertEquals(200, runTable(fixture.table(), PipelineType.PROFILER).getCode());
    DatabaseServiceProfilerPipeline stored =
        storedConfig(pipeline, DatabaseServiceProfilerPipeline.class);
    assertEquals(deployedTableFilter.getIncludes(), stored.getTableFilterPattern().getIncludes());
    assertFalse(stored.getUseFqnForFiltering());
  }

  @Test
  void aTableWithoutAProfilerPipelineIsNotFound(TestNamespace ns) {
    Fixture fixture = createFixture(ns);

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> runTable(fixture.table(), PipelineType.PROFILER));

    assertEquals(404, error.getStatusCode());
    assertTrue(
        error.getMessage().contains(fixture.table().getFullyQualifiedName()), error.getMessage());
  }

  @Test
  void aTableRunsItsServiceMetadataPipeline(TestNamespace ns) {
    Fixture fixture = createFixture(ns);
    createServicePipeline(
        ns, fixture.service(), PipelineType.METADATA, new DatabaseServiceMetadataPipeline());

    assertEquals(200, runTable(fixture.table(), PipelineType.METADATA).getCode());
  }

  /**
   * An incremental pipeline starts each run from its last successful one, so a successful run of
   * one table would make the next scheduled run skip changes made to every other table before it.
   */
  @Test
  void aScopedMetadataRunOnAnIncrementalPipelineIsRejected(TestNamespace ns) {
    Fixture fixture = createFixture(ns);
    IngestionPipeline pipeline =
        createServicePipeline(
            ns,
            fixture.service(),
            PipelineType.METADATA,
            new DatabaseServiceMetadataPipeline()
                .withIncremental(new Incremental().withEnabled(true)));

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> runTable(fixture.table(), PipelineType.METADATA));

    assertEquals(400, error.getStatusCode());
    assertTrue(error.getMessage().contains(pipeline.getFullyQualifiedName()), error.getMessage());
  }

  /**
   * Usage and lineage come from query logs, which a table filter does not bound; a profiler has no
   * test case to run; and a link to a column is not an entity a pipeline can be scoped to.
   */
  @Test
  void pairingsNoPipelineCanRunScopedToAreRejected(TestNamespace ns) {
    Fixture fixture = createFixture(ns);
    String tableLink = entityLink("table", fixture.table().getFullyQualifiedName());

    assertBadRequest(testCaseLink(fixture.testCase()), PipelineType.PROFILER);
    assertBadRequest(tableLink, PipelineType.USAGE);
    assertBadRequest(tableLink, PipelineType.LINEAGE);
    assertBadRequest(tableLink, PipelineType.TEST_SUITE);
    assertBadRequest(
        "<#E::table::" + fixture.table().getFullyQualifiedName() + "::columns::id>",
        PipelineType.PROFILER);
  }

  private static void assertBadRequest(String entityLink, PipelineType pipelineType) {
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> run(adminClient(), entityLink, pipelineType));
    assertEquals(400, error.getStatusCode(), entityLink + " " + pipelineType);
  }

  private static PipelineServiceClientResponse runTestCase(
      OpenMetadataClient client, TestCase testCase) {
    return run(client, testCaseLink(testCase), PipelineType.TEST_SUITE);
  }

  private static PipelineServiceClientResponse runTable(Table table, PipelineType pipelineType) {
    return run(adminClient(), entityLink("table", table.getFullyQualifiedName()), pipelineType);
  }

  private static PipelineServiceClientResponse run(
      OpenMetadataClient client, String entityLink, PipelineType pipelineType) {
    RunIngestionPipelineForEntity request =
        new RunIngestionPipelineForEntity()
            .withEntityLink(entityLink)
            .withPipelineType(pipelineType);
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.POST, "/v1/services/ingestionPipelines/run", request);
    return JsonUtils.readValue(response, PipelineServiceClientResponse.class);
  }

  private static String testCaseLink(TestCase testCase) {
    return entityLink("testCase", testCase.getFullyQualifiedName());
  }

  private static String entityLink(String entityType, String fullyQualifiedName) {
    return "<#E::" + entityType + "::" + fullyQualifiedName + ">";
  }

  private static OpenMetadataClient adminClient() {
    return SdkClients.adminClient();
  }

  private static OpenMetadataClient dataStewardClient(TestNamespace ns) {
    String email = "steward_" + ns.uniqueShortId() + "@test.om.org";
    adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(email.substring(0, email.indexOf('@')))
                .withEmail(email)
                .withRoles(List.of(SharedEntities.get().DATA_STEWARD_ROLE.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  /**
   * A steward, so the caller keeps Trigger on the pipeline, plus a role denying every view of a test
   * case. A deny is used rather than a narrow allow because the roles a user already carries grant
   * an unconditioned ViewAll.
   */
  private static OpenMetadataClient clientDeniedViewOnTestCases(TestNamespace ns) {
    OpenMetadataClient admin = adminClient();
    Rule denyViewingTestCases =
        new Rule()
            .withName("denyViewingTestCases")
            .withDescription("Deny every view of a test case")
            .withEffect(Rule.Effect.DENY)
            .withOperations(List.of(MetadataOperation.VIEW_ALL, MetadataOperation.VIEW_BASIC))
            .withResources(List.of(Entity.TEST_CASE));
    Policy policy =
        admin
            .policies()
            .create(
                new CreatePolicy()
                    .withName("denyTestCaseViews_" + ns.uniqueShortId())
                    .withDescription("Deny every view of a test case")
                    .withRules(List.of(denyViewingTestCases)));
    Role role =
        admin
            .roles()
            .create(
                new CreateRole()
                    .withName("testCaseBlind_" + ns.uniqueShortId())
                    .withDescription("Carries the test case view deny")
                    .withPolicies(List.of(policy.getFullyQualifiedName())));
    String email = "blind_" + ns.uniqueShortId() + "@test.om.org";
    admin
        .users()
        .create(
            new CreateUser()
                .withName(email.substring(0, email.indexOf('@')))
                .withEmail(email)
                .withRoles(List.of(SharedEntities.get().DATA_STEWARD_ROLE.getId(), role.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static Fixture createFixture(TestNamespace ns) {
    OpenMetadataClient client = adminClient();
    // Short names: the basic test suite FQN nests service.db.schema.table and must fit 256 chars.
    String shortId = ns.uniqueShortId();
    DatabaseService service =
        DatabaseServiceTestFactory.createPostgresWithName("pg_" + shortId, ns);
    String schemaFqn =
        DatabaseSchemaTestFactory.createSimpleWithName("sc" + shortId, ns, service)
            .getFullyQualifiedName();
    Table table = TableTestFactory.createSimpleWithName("tb_" + shortId, ns, schemaFqn);
    TestCase testCase =
        TestCaseBuilder.create(client)
            .name("tc_" + shortId)
            .forTable(table)
            .testDefinition("tableRowCountToEqual")
            .parameter("value", "100")
            .create();
    return new Fixture(
        service, table, client.testCases().get(testCase.getId().toString(), "testSuite"));
  }

  // The IT server has no pipeline client to deploy with, so the flag a deploy would set is patched.
  private static IngestionPipeline createTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite) {
    return patchPipeline(createUndeployedTestSuitePipeline(ns, testSuite), "/deployed", true);
  }

  private static IngestionPipeline createUndeployedTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite) {
    return createPipeline(ns, testSuite, PipelineType.TEST_SUITE, new TestSuitePipeline());
  }

  private static IngestionPipeline createServicePipeline(
      TestNamespace ns, DatabaseService service, PipelineType pipelineType, Object sourceConfig) {
    IngestionPipeline pipeline =
        createPipeline(ns, service.getEntityReference(), pipelineType, sourceConfig);
    return patchPipeline(pipeline, "/deployed", true);
  }

  private static IngestionPipeline createPipeline(
      TestNamespace ns, EntityReference owner, PipelineType pipelineType, Object sourceConfig) {
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName("pl_" + ns.uniqueShortId())
            .withService(owner)
            .withPipelineType(pipelineType)
            .withSourceConfig(new SourceConfig().withConfig(sourceConfig))
            .withAirflowConfig(new AirflowConfig().withStartDate(new Date()));
    return adminClient().ingestionPipelines().create(request);
  }

  private static IngestionPipeline patchPipeline(
      IngestionPipeline pipeline, String path, boolean value) {
    ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "add").put("path", path).put("value", value);
    return adminClient().ingestionPipelines().patch(pipeline.getId(), patch);
  }

  private static void reportStatus(IngestionPipeline pipeline, PipelineStatusType state) {
    long now = System.currentTimeMillis();
    PipelineStatus status =
        new PipelineStatus()
            .withRunId(UUID.randomUUID().toString())
            .withPipelineState(state)
            .withStartDate(now)
            .withTimestamp(now);
    adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/services/ingestionPipelines/"
                + pipeline.getFullyQualifiedName()
                + "/pipelineStatus",
            status,
            PipelineStatus.class);
  }

  private static <T> T storedConfig(IngestionPipeline pipeline, Class<T> configClass) {
    IngestionPipeline stored = adminClient().ingestionPipelines().get(pipeline.getId().toString());
    return JsonUtils.convertValue(stored.getSourceConfig().getConfig(), configClass);
  }
}
