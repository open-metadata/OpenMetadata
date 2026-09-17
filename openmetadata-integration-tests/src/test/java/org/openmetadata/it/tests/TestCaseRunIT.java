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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.node.ArrayNode;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
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
import org.openmetadata.schema.api.services.ingestionPipelines.CreateIngestionPipeline;
import org.openmetadata.schema.api.teams.CreateUser;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.services.DatabaseService;
import org.openmetadata.schema.entity.services.ingestionPipelines.AirflowConfig;
import org.openmetadata.schema.entity.services.ingestionPipelines.IngestionPipeline;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineServiceClientResponse;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatus;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineStatusType;
import org.openmetadata.schema.entity.services.ingestionPipelines.PipelineType;
import org.openmetadata.schema.metadataIngestion.SourceConfig;
import org.openmetadata.schema.metadataIngestion.TestSuitePipeline;
import org.openmetadata.schema.tests.TestCase;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.exceptions.OpenMetadataException;
import org.openmetadata.sdk.fluent.builders.TestCaseBuilder;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * POST /v1/dataQuality/testCases/{id}/run resolves the test case's suite pipeline and triggers it
 * scoped to that one test case. The IT server runs with the pipeline service client disabled, so a
 * successful resolution ends at the "Pipeline Client Disabled" response; the scoping itself and the
 * Airflow trigger payload are covered by TestCaseRunScopeTest and AirflowRESTClientTest.
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TestCaseRunIT {

  private static final String PIPELINE_CLIENT_DISABLED = "Pipeline Client Disabled";

  @Test
  void runWithoutDeployedPipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
    assertTrue(
        error.getMessage().contains(testCase.getTestSuite().getFullyQualifiedName()),
        "The error should name the suite that has no pipeline: " + error.getMessage());
  }

  @Test
  void runResolvesTheSuitePipelineWithoutPersistingTheScope(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());

    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(SdkClients.adminClient(), testCase), PipelineServiceClientResponse.class);

    assertEquals(200, response.getCode());
    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
    assertNull(
        storedTestCaseScope(pipeline),
        "Running one test case must not narrow the suite pipeline for later scheduled runs");
  }

  @Test
  void runRequiresTriggerPermissionOnThePipeline(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    createTestSuitePipeline(ns, testCase.getTestSuite());
    // Without the user row the token resolves to 404 (user not found) instead of 403.
    UserTestFactory.getDataConsumer(ns);

    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class, () -> run(SdkClients.dataConsumerClient(), testCase));

    assertEquals(403, error.getStatusCode());
  }

  @Test
  void dataStewardCanRunWithTriggerButWithoutEditTests(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    createTestSuitePipeline(ns, testCase.getTestSuite());

    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(dataStewardClient(ns), testCase), PipelineServiceClientResponse.class);

    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
  }

  @Test
  void runWithOnlyAnUndeployedPipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    createUndeployedTestSuitePipeline(ns, testCase.getTestSuite());

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
  }

  @Test
  void runWithOnlyADisabledPipelineIsNotFound(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    patchPipeline(pipeline, "/enabled", false);

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));

    assertEquals(404, error.getStatusCode());
  }

  @Test
  void runPicksTheDeployedPipelineWhenTheSuiteAlsoHasAnUndeployedOne(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    createUndeployedTestSuitePipeline(ns, testCase.getTestSuite(), new AirflowConfig());
    createTestSuitePipeline(ns, testCase.getTestSuite());

    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(SdkClients.adminClient(), testCase), PipelineServiceClientResponse.class);

    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
  }

  @Test
  void runIsRejectedWhileAnEarlierRunIsStillQueued(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    reportStatus(
        pipeline,
        UUID.randomUUID().toString(),
        PipelineStatusType.QUEUED,
        System.currentTimeMillis());

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));

    assertEquals(409, error.getStatusCode());
  }

  /**
   * A running run counts only until it outlives the pipeline's own workflow timeout, so a pipeline
   * with a short timeout is not blocked by a run whose worker died minutes ago.
   */
  @Test
  void runIgnoresARunningRunOlderThanThePipelineWorkflowTimeout(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline =
        createTestSuitePipeline(
            ns, testCase.getTestSuite(), new AirflowConfig().withWorkflowTimeout(60));
    long fiveMinutesAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(5);
    reportStatus(
        pipeline, UUID.randomUUID().toString(), PipelineStatusType.RUNNING, fiveMinutesAgo);

    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(SdkClients.adminClient(), testCase), PipelineServiceClientResponse.class);

    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
  }

  @Test
  void runIsRejectedForARunningRunWithinTheDefaultTimeout(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    long fiveMinutesAgo = System.currentTimeMillis() - TimeUnit.MINUTES.toMillis(5);
    reportStatus(
        pipeline, UUID.randomUUID().toString(), PipelineStatusType.RUNNING, fiveMinutesAgo);

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));

    assertEquals(409, error.getStatusCode());
  }

  @Test
  void runIsRejectedWhileTheSuitePipelineRunsAndAllowedOnceItFinishes(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    String scheduledRunId = UUID.randomUUID().toString();
    long now = System.currentTimeMillis();
    reportStatus(pipeline, scheduledRunId, PipelineStatusType.RUNNING, now);

    OpenMetadataException error =
        assertThrows(OpenMetadataException.class, () -> run(SdkClients.adminClient(), testCase));
    assertEquals(409, error.getStatusCode());
    assertTrue(error.getMessage().contains(pipeline.getFullyQualifiedName()), error.getMessage());

    reportStatus(pipeline, scheduledRunId, PipelineStatusType.SUCCESS, now);
    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(SdkClients.adminClient(), testCase), PipelineServiceClientResponse.class);
    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
  }

  @Test
  void runIgnoresARunThatOutlivedItsTimeout(TestNamespace ns) {
    TestCase testCase = createTestCase(ns);
    IngestionPipeline pipeline = createTestSuitePipeline(ns, testCase.getTestSuite());
    long twoHoursAgo = System.currentTimeMillis() - TimeUnit.HOURS.toMillis(2);
    reportStatus(pipeline, UUID.randomUUID().toString(), PipelineStatusType.RUNNING, twoHoursAgo);

    PipelineServiceClientResponse response =
        JsonUtils.readValue(
            run(SdkClients.adminClient(), testCase), PipelineServiceClientResponse.class);

    assertEquals(PIPELINE_CLIENT_DISABLED, response.getReason());
  }

  @Test
  void runUnknownTestCaseIsNotFound() {
    OpenMetadataException error =
        assertThrows(
            OpenMetadataException.class,
            () -> run(SdkClients.adminClient(), new TestCase().withId(UUID.randomUUID())));

    assertEquals(404, error.getStatusCode());
  }

  private static String run(OpenMetadataClient client, TestCase testCase) {
    return client
        .getHttpClient()
        .executeForString(
            HttpMethod.POST, "/v1/dataQuality/testCases/" + testCase.getId() + "/run", null);
  }

  private static OpenMetadataClient dataStewardClient(TestNamespace ns) {
    String email = "steward_" + ns.uniqueShortId() + "@test.om.org";
    SdkClients.adminClient()
        .users()
        .create(
            new CreateUser()
                .withName(email.substring(0, email.indexOf('@')))
                .withEmail(email)
                .withRoles(List.of(SharedEntities.get().DATA_STEWARD_ROLE.getId())));
    return SdkClients.createClient(email, email, new String[] {});
  }

  private static TestCase createTestCase(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();
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
    return client.testCases().get(testCase.getId().toString(), "testSuite");
  }

  // The IT server has no pipeline client to deploy with, so the flag a deploy would set is patched.
  private static IngestionPipeline createTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite) {
    return createTestSuitePipeline(ns, testSuite, new AirflowConfig());
  }

  private static IngestionPipeline createTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite, AirflowConfig airflowConfig) {
    IngestionPipeline pipeline = createUndeployedTestSuitePipeline(ns, testSuite, airflowConfig);
    return patchPipeline(pipeline, "/deployed", true);
  }

  private static IngestionPipeline createUndeployedTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite) {
    return createUndeployedTestSuitePipeline(ns, testSuite, new AirflowConfig());
  }

  private static IngestionPipeline createUndeployedTestSuitePipeline(
      TestNamespace ns, EntityReference testSuite, AirflowConfig airflowConfig) {
    CreateIngestionPipeline request =
        new CreateIngestionPipeline()
            .withName("pl_" + ns.uniqueShortId())
            .withService(testSuite)
            .withPipelineType(PipelineType.TEST_SUITE)
            .withSourceConfig(new SourceConfig().withConfig(new TestSuitePipeline()))
            .withAirflowConfig(airflowConfig.withStartDate(new Date()));
    return SdkClients.adminClient().ingestionPipelines().create(request);
  }

  private static IngestionPipeline patchPipeline(
      IngestionPipeline pipeline, String path, boolean value) {
    ArrayNode patch = JsonUtils.getObjectMapper().createArrayNode();
    patch.addObject().put("op", "add").put("path", path).put("value", value);
    return SdkClients.adminClient().ingestionPipelines().patch(pipeline.getId(), patch);
  }

  private static void reportStatus(
      IngestionPipeline pipeline, String runId, PipelineStatusType state, long timestamp) {
    PipelineStatus status =
        new PipelineStatus()
            .withRunId(runId)
            .withPipelineState(state)
            .withStartDate(timestamp)
            .withTimestamp(timestamp);
    SdkClients.adminClient()
        .getHttpClient()
        .execute(
            HttpMethod.PUT,
            "/v1/services/ingestionPipelines/"
                + pipeline.getFullyQualifiedName()
                + "/pipelineStatus",
            status,
            PipelineStatus.class);
  }

  private static Object storedTestCaseScope(IngestionPipeline pipeline) {
    IngestionPipeline stored =
        SdkClients.adminClient().ingestionPipelines().get(pipeline.getId().toString());
    return JsonUtils.convertValue(stored.getSourceConfig().getConfig(), TestSuitePipeline.class)
        .getTestCases();
  }
}
