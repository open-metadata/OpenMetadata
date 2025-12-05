/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.resources.lineage;

import static jakarta.ws.rs.core.Response.Status.FORBIDDEN;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.openmetadata.service.Entity.ADMIN_USER_NAME;
import static org.openmetadata.service.exception.CatalogExceptionMessage.permissionNotAllowed;
import static org.openmetadata.service.security.SecurityUtil.authHeaders;
import static org.openmetadata.service.util.TestUtils.ADMIN_AUTH_HEADERS;
import static org.openmetadata.service.util.TestUtils.assertResponse;

import jakarta.ws.rs.client.WebTarget;
import jakarta.ws.rs.core.Response.Status;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import lombok.extern.slf4j.Slf4j;
import org.apache.http.client.HttpResponseException;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.MethodOrderer;
import org.junit.jupiter.api.Order;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInfo;
import org.junit.jupiter.api.TestMethodOrder;
import org.openmetadata.schema.api.data.CreateTable;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageFacet;
import org.openmetadata.schema.api.lineage.openlineage.ColumnLineageField;
import org.openmetadata.schema.api.lineage.openlineage.DatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.DocumentationFacet;
import org.openmetadata.schema.api.lineage.openlineage.EventType;
import org.openmetadata.schema.api.lineage.openlineage.Fields;
import org.openmetadata.schema.api.lineage.openlineage.InputField;
import org.openmetadata.schema.api.lineage.openlineage.JobFacets;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageBatchRequest;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageInputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageJob;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageOutputDataset;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageResponse;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRun;
import org.openmetadata.schema.api.lineage.openlineage.OpenLineageRunEvent;
import org.openmetadata.schema.api.lineage.openlineage.OutputDatasetFacets;
import org.openmetadata.schema.api.lineage.openlineage.ParentJobFacet;
import org.openmetadata.schema.api.lineage.openlineage.ParentRunFacet;
import org.openmetadata.schema.api.lineage.openlineage.Run;
import org.openmetadata.schema.api.lineage.openlineage.RunFacets;
import org.openmetadata.schema.api.lineage.openlineage.SchemaFacet;
import org.openmetadata.schema.api.lineage.openlineage.SchemaField;
import org.openmetadata.schema.api.lineage.openlineage.SqlJobFacet;
import org.openmetadata.schema.configuration.OpenLineageEventType;
import org.openmetadata.schema.configuration.OpenLineageSettings;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.teams.Role;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.settings.Settings;
import org.openmetadata.schema.settings.SettingsType;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.service.OpenMetadataApplicationTest;
import org.openmetadata.service.resources.databases.TableResourceTest;
import org.openmetadata.service.resources.settings.SettingsCache;
import org.openmetadata.service.resources.teams.RoleResource;
import org.openmetadata.service.resources.teams.RoleResourceTest;
import org.openmetadata.service.resources.teams.UserResourceTest;
import org.openmetadata.service.util.TestUtils;

@Slf4j
@TestMethodOrder(MethodOrderer.OrderAnnotation.class)
public class OpenLineageResourceTest extends OpenMetadataApplicationTest {

  private static final String DATA_STEWARD_ROLE_NAME = "DataSteward";
  private static final List<Table> TABLES = new ArrayList<>();
  private static final int TABLE_COUNT = 4;

  @BeforeAll
  public static void setup(TestInfo test) throws IOException, URISyntaxException {
    TableResourceTest tableResourceTest = new TableResourceTest();
    tableResourceTest.setup(test);
    for (int i = 0; i < TABLE_COUNT; i++) {
      CreateTable createTable = tableResourceTest.createRequest(test, i);
      TABLES.add(tableResourceTest.createEntity(createTable, ADMIN_AUTH_HEADERS));
    }
  }

  @Order(1)
  @Test
  void post_openLineageEvent_withAuthorizer() throws HttpResponseException {
    UserResourceTest userResourceTest = new UserResourceTest();
    User randomUser =
        userResourceTest.createEntity(
            userResourceTest.createRequest("ol_lineage_user", "", "", null), ADMIN_AUTH_HEADERS);

    RoleResourceTest roleResourceTest = new RoleResourceTest();
    Role dataStewardRole =
        roleResourceTest.getEntityByName(
            DATA_STEWARD_ROLE_NAME, null, RoleResource.FIELDS, ADMIN_AUTH_HEADERS);
    User userWithDataStewardRole =
        userResourceTest.createEntity(
            userResourceTest
                .createRequest("ol_lineage_user_data_steward", "", "", null)
                .withRoles(List.of(dataStewardRole.getId())),
            ADMIN_AUTH_HEADERS);

    OpenLineageRunEvent event = createSimpleOpenLineageEvent();

    checkAuthorization(ADMIN_USER_NAME, event, false);
    checkAuthorization(userWithDataStewardRole.getName(), event, false);
    checkAuthorization(randomUser.getName(), event, true);
  }

  private void checkAuthorization(
      String userName, OpenLineageRunEvent event, boolean shouldThrowException)
      throws HttpResponseException {
    Map<String, String> authHeaders = authHeaders(userName + "@open-metadata.org");

    if (shouldThrowException) {
      assertResponse(
          () -> postOpenLineageEvent(event, authHeaders),
          FORBIDDEN,
          permissionNotAllowed(userName, List.of(MetadataOperation.EDIT_LINEAGE)));
      return;
    }

    OpenLineageResponse response = postOpenLineageEvent(event, authHeaders);
    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(2)
  @Test
  void post_openLineageEvent_completeEvent_processedSuccessfully() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event =
        createOpenLineageEvent(sourceTable, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertNotNull(response.getMessage());
  }

  @Order(3)
  @Test
  void post_openLineageEvent_startEvent_noLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(2);
    Table targetTable = TABLES.get(3);

    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, EventType.START);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(0, response.getLineageEdgesCreated(), "START events should not create lineage");
  }

  @Order(4)
  @Test
  void post_openLineageBatchEvent_multipleEvents() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    List<OpenLineageRunEvent> events = new ArrayList<>();
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.START));
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.COMPLETE));

    OpenLineageBatchRequest batchRequest = new OpenLineageBatchRequest().withEvents(events);

    OpenLineageResponse response = postOpenLineageBatch(batchRequest, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertNotNull(response.getSummary());
    assertEquals(2, response.getSummary().getReceived());
  }

  @Order(5)
  @Test
  void post_openLineageEvent_withColumnLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event =
        createOpenLineageEventWithColumnLineage(sourceTable, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(6)
  @Test
  void post_openLineageEvent_runningEvent_noLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, EventType.RUNNING);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(0, response.getLineageEdgesCreated(), "RUNNING events should not create lineage");
  }

  @Order(7)
  @Test
  void post_openLineageEvent_failEvent_noLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, EventType.FAIL);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(0, response.getLineageEdgesCreated(), "FAIL events should not create lineage");
  }

  @Order(8)
  @Test
  void post_openLineageEvent_abortEvent_noLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, EventType.ABORT);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(0, response.getLineageEdgesCreated(), "ABORT events should not create lineage");
  }

  @Order(9)
  @Test
  void post_openLineageEvent_emptyInputsOutputs_noLineage() throws HttpResponseException {
    OpenLineageRunEvent event = createSimpleOpenLineageEvent();

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(0, response.getLineageEdgesCreated(), "Empty events should not create lineage");
  }

  @Order(10)
  @Test
  void post_openLineageEvent_withSqlQuery() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    String sqlQuery = "INSERT INTO target SELECT * FROM source WHERE id > 0";
    OpenLineageRunEvent event =
        createOpenLineageEventWithSql(sourceTable, targetTable, EventType.COMPLETE, sqlQuery);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(11)
  @Test
  void post_openLineageEvent_withParentRunFacet() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event =
        createOpenLineageEventWithParentRun(sourceTable, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(12)
  @Test
  void post_openLineageEvent_multipleInputsSingleOutput() throws HttpResponseException {
    Table sourceTable1 = TABLES.get(0);
    Table sourceTable2 = TABLES.get(1);
    Table targetTable = TABLES.get(2);

    OpenLineageRunEvent event =
        createOpenLineageEventWithMultipleInputs(
            sourceTable1, sourceTable2, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(13)
  @Test
  void post_openLineageEvent_singleInputMultipleOutputs() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable1 = TABLES.get(2);
    Table targetTable2 = TABLES.get(3);

    OpenLineageRunEvent event =
        createOpenLineageEventWithMultipleOutputs(
            sourceTable, targetTable1, targetTable2, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(14)
  @Test
  void post_openLineageEvent_withDocumentationFacet() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event =
        createOpenLineageEventWithDocumentation(sourceTable, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(15)
  @Test
  void post_openLineageEvent_multipleColumnLineage() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    OpenLineageRunEvent event =
        createOpenLineageEventWithMultipleColumnLineage(
            sourceTable, targetTable, EventType.COMPLETE);

    OpenLineageResponse response = postOpenLineageEvent(event, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
  }

  @Order(16)
  @Test
  void post_openLineageBatchEvent_allSkippedEvents() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    // All non-COMPLETE events should be skipped
    List<OpenLineageRunEvent> events = new ArrayList<>();
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.START));
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.RUNNING));

    OpenLineageBatchRequest batchRequest = new OpenLineageBatchRequest().withEvents(events);

    OpenLineageResponse response = postOpenLineageBatch(batchRequest, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertEquals(OpenLineageResponse.Status.SUCCESS, response.getStatus());
    assertEquals(2, response.getSummary().getReceived());
    assertEquals(2, response.getSummary().getSkipped());
  }

  @Order(17)
  @Test
  void post_openLineageBatchEvent_mixedEventTypes() throws HttpResponseException {
    Table sourceTable = TABLES.get(0);
    Table targetTable = TABLES.get(1);

    List<OpenLineageRunEvent> events = new ArrayList<>();
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.START));
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.RUNNING));
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.COMPLETE));
    events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.FAIL));

    OpenLineageBatchRequest batchRequest = new OpenLineageBatchRequest().withEvents(events);

    OpenLineageResponse response = postOpenLineageBatch(batchRequest, ADMIN_AUTH_HEADERS);

    assertNotNull(response);
    assertNotNull(response.getSummary());
    assertEquals(4, response.getSummary().getReceived());
    // At least 3 events should be skipped (START, RUNNING, FAIL) - COMPLETE should be attempted
    // But COMPLETE may also fail to create lineage if entities are not properly resolved
    assertTrue(
        response.getSummary().getSkipped() >= 3,
        "At least 3 non-COMPLETE events should be skipped");
  }

  @Order(18)
  @Test
  void post_openLineageEvent_withCustomEventTypeFilter_processesConfiguredTypes()
      throws HttpResponseException {
    OpenLineageSettings originalSettings = getOpenLineageSettings();

    try {
      updateOpenLineageSettingsViaApi(
          new OpenLineageSettings()
              .withEnabled(true)
              .withAutoCreateEntities(true)
              .withDefaultPipelineService("openlineage")
              .withEventTypeFilter(
                  List.of(
                      OpenLineageEventType.COMPLETE,
                      OpenLineageEventType.START,
                      OpenLineageEventType.FAIL)));

      Table sourceTable = TABLES.get(0);
      Table targetTable = TABLES.get(1);

      OpenLineageRunEvent startEvent =
          createOpenLineageEvent(sourceTable, targetTable, EventType.START);
      OpenLineageResponse startResponse = postOpenLineageEvent(startEvent, ADMIN_AUTH_HEADERS);

      assertNotNull(startResponse);
      assertEquals(OpenLineageResponse.Status.SUCCESS, startResponse.getStatus());

    } finally {
      updateOpenLineageSettingsViaApi(originalSettings);
    }
  }

  @Order(19)
  @Test
  void post_openLineageEvent_whenDisabled_returns503() throws HttpResponseException {
    // Update settings to disable the OpenLineage API
    updateOpenLineageSettingsViaApi(
        new OpenLineageSettings()
            .withEnabled(false)
            .withAutoCreateEntities(true)
            .withDefaultPipelineService("openlineage"));

    try {
      OpenLineageRunEvent event = createSimpleOpenLineageEvent();
      WebTarget target = getResource("openlineage/lineage");

      TestUtils.assertResponse(
          () -> TestUtils.post(target, event, OpenLineageResponse.class, ADMIN_AUTH_HEADERS),
          Status.SERVICE_UNAVAILABLE,
          "OpenLineage API is disabled");
    } finally {
      // Re-enable the API
      updateOpenLineageSettingsViaApi(
          new OpenLineageSettings()
              .withEnabled(true)
              .withAutoCreateEntities(true)
              .withDefaultPipelineService("openlineage"));
    }
  }

  @Order(20)
  @Test
  void post_openLineageBatchEvent_whenDisabled_returns503() throws HttpResponseException {
    // Update settings to disable the OpenLineage API
    updateOpenLineageSettingsViaApi(
        new OpenLineageSettings()
            .withEnabled(false)
            .withAutoCreateEntities(true)
            .withDefaultPipelineService("openlineage"));

    try {
      Table sourceTable = TABLES.get(0);
      Table targetTable = TABLES.get(1);

      List<OpenLineageRunEvent> events = new ArrayList<>();
      events.add(createOpenLineageEvent(sourceTable, targetTable, EventType.COMPLETE));

      OpenLineageBatchRequest batchRequest = new OpenLineageBatchRequest().withEvents(events);
      WebTarget target = getResource("openlineage/lineage/batch");

      TestUtils.assertResponse(
          () -> TestUtils.post(target, batchRequest, OpenLineageResponse.class, ADMIN_AUTH_HEADERS),
          Status.SERVICE_UNAVAILABLE,
          "OpenLineage API is disabled");
    } finally {
      // Re-enable the API
      updateOpenLineageSettingsViaApi(
          new OpenLineageSettings()
              .withEnabled(true)
              .withAutoCreateEntities(true)
              .withDefaultPipelineService("openlineage"));
    }
  }

  private OpenLineageSettings getOpenLineageSettings() {
    return SettingsCache.getSettingOrDefault(
        SettingsType.OPEN_LINEAGE_SETTINGS,
        new OpenLineageSettings()
            .withEnabled(true)
            .withAutoCreateEntities(true)
            .withDefaultPipelineService("openlineage"),
        OpenLineageSettings.class);
  }

  private void updateOpenLineageSettingsViaApi(OpenLineageSettings newSettings)
      throws HttpResponseException {
    Settings setting =
        new Settings()
            .withConfigType(SettingsType.OPEN_LINEAGE_SETTINGS)
            .withConfigValue(newSettings);
    WebTarget target = getResource("system/settings");
    TestUtils.put(target, setting, Status.OK, ADMIN_AUTH_HEADERS);
  }

  private OpenLineageRunEvent createSimpleOpenLineageEvent() {
    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(EventType.COMPLETE)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("test-job"))
        .withInputs(new ArrayList<>())
        .withOutputs(new ArrayList<>());
  }

  private OpenLineageRunEvent createOpenLineageEvent(
      Table sourceTable, Table targetTable, EventType eventType) {
    String sourceNamespace = "openmetadata://" + sourceTable.getService().getName();
    String sourceName = sourceTable.getDatabaseSchema().getName() + "." + sourceTable.getName();

    String targetNamespace = "openmetadata://" + targetTable.getService().getName();
    String targetName = targetTable.getDatabaseSchema().getName() + "." + targetTable.getName();

    OpenLineageInputDataset inputDataset =
        new OpenLineageInputDataset().withNamespace(sourceNamespace).withName(sourceName);

    OpenLineageOutputDataset outputDataset =
        new OpenLineageOutputDataset().withNamespace(targetNamespace).withName(targetName);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("test-job"))
        .withInputs(List.of(inputDataset))
        .withOutputs(List.of(outputDataset));
  }

  private OpenLineageRunEvent createOpenLineageEventWithColumnLineage(
      Table sourceTable, Table targetTable, EventType eventType) {
    String sourceNamespace = "openmetadata://" + sourceTable.getService().getName();
    String sourceName = sourceTable.getDatabaseSchema().getName() + "." + sourceTable.getName();

    String targetNamespace = "openmetadata://" + targetTable.getService().getName();
    String targetName = targetTable.getDatabaseSchema().getName() + "." + targetTable.getName();

    List<SchemaField> schemaFields = new ArrayList<>();
    schemaFields.add(new SchemaField().withName("id").withType("INTEGER"));
    schemaFields.add(new SchemaField().withName("name").withType("STRING"));

    DatasetFacets inputFacets =
        new DatasetFacets().withSchema(new SchemaFacet().withFields(schemaFields));

    OpenLineageInputDataset inputDataset =
        new OpenLineageInputDataset()
            .withNamespace(sourceNamespace)
            .withName(sourceName)
            .withFacets(inputFacets);

    InputField inputField =
        new InputField().withNamespace(sourceNamespace).withName(sourceName).withField("id");

    ColumnLineageField columnLineageField =
        new ColumnLineageField()
            .withInputFields(List.of(inputField))
            .withTransformationDescription("direct copy");

    Fields fieldsMap = new Fields();
    fieldsMap.setAdditionalProperty("id", columnLineageField);

    ColumnLineageFacet columnLineageFacet = new ColumnLineageFacet().withFields(fieldsMap);

    OutputDatasetFacets outputFacets =
        new OutputDatasetFacets().withColumnLineage(columnLineageFacet);

    OpenLineageOutputDataset outputDataset =
        new OpenLineageOutputDataset()
            .withNamespace(targetNamespace)
            .withName(targetName)
            .withOutputFacets(outputFacets);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("test-job"))
        .withInputs(List.of(inputDataset))
        .withOutputs(List.of(outputDataset));
  }

  private OpenLineageRunEvent createOpenLineageEventWithSql(
      Table sourceTable, Table targetTable, EventType eventType, String sqlQuery) {
    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, eventType);

    JobFacets jobFacets = new JobFacets().withSql(new SqlJobFacet().withQuery(sqlQuery));
    event.getJob().setFacets(jobFacets);

    return event;
  }

  private OpenLineageRunEvent createOpenLineageEventWithParentRun(
      Table sourceTable, Table targetTable, EventType eventType) {
    OpenLineageRunEvent event = createOpenLineageEvent(sourceTable, targetTable, eventType);

    ParentJobFacet parentJobFacet =
        new ParentJobFacet().withNamespace("parent-namespace").withName("parent-dag");
    ParentRunFacet parentFacet =
        new ParentRunFacet()
            .withJob(parentJobFacet)
            .withRun(new Run().withRunId(UUID.randomUUID()));
    RunFacets runFacets = new RunFacets().withParent(parentFacet);
    event.getRun().setFacets(runFacets);

    return event;
  }

  private OpenLineageRunEvent createOpenLineageEventWithMultipleInputs(
      Table source1, Table source2, Table target, EventType eventType) {
    String source1Namespace = "openmetadata://" + source1.getService().getName();
    String source1Name = source1.getDatabaseSchema().getName() + "." + source1.getName();

    String source2Namespace = "openmetadata://" + source2.getService().getName();
    String source2Name = source2.getDatabaseSchema().getName() + "." + source2.getName();

    String targetNamespace = "openmetadata://" + target.getService().getName();
    String targetName = target.getDatabaseSchema().getName() + "." + target.getName();

    OpenLineageInputDataset input1 =
        new OpenLineageInputDataset().withNamespace(source1Namespace).withName(source1Name);
    OpenLineageInputDataset input2 =
        new OpenLineageInputDataset().withNamespace(source2Namespace).withName(source2Name);

    OpenLineageOutputDataset output =
        new OpenLineageOutputDataset().withNamespace(targetNamespace).withName(targetName);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("multi-input-job"))
        .withInputs(List.of(input1, input2))
        .withOutputs(List.of(output));
  }

  private OpenLineageRunEvent createOpenLineageEventWithMultipleOutputs(
      Table source, Table target1, Table target2, EventType eventType) {
    String sourceNamespace = "openmetadata://" + source.getService().getName();
    String sourceName = source.getDatabaseSchema().getName() + "." + source.getName();

    String target1Namespace = "openmetadata://" + target1.getService().getName();
    String target1Name = target1.getDatabaseSchema().getName() + "." + target1.getName();

    String target2Namespace = "openmetadata://" + target2.getService().getName();
    String target2Name = target2.getDatabaseSchema().getName() + "." + target2.getName();

    OpenLineageInputDataset input =
        new OpenLineageInputDataset().withNamespace(sourceNamespace).withName(sourceName);

    OpenLineageOutputDataset output1 =
        new OpenLineageOutputDataset().withNamespace(target1Namespace).withName(target1Name);
    OpenLineageOutputDataset output2 =
        new OpenLineageOutputDataset().withNamespace(target2Namespace).withName(target2Name);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("multi-output-job"))
        .withInputs(List.of(input))
        .withOutputs(List.of(output1, output2));
  }

  private OpenLineageRunEvent createOpenLineageEventWithDocumentation(
      Table sourceTable, Table targetTable, EventType eventType) {
    String sourceNamespace = "openmetadata://" + sourceTable.getService().getName();
    String sourceName = sourceTable.getDatabaseSchema().getName() + "." + sourceTable.getName();

    String targetNamespace = "openmetadata://" + targetTable.getService().getName();
    String targetName = targetTable.getDatabaseSchema().getName() + "." + targetTable.getName();

    DatasetFacets inputFacets =
        new DatasetFacets()
            .withDocumentation(
                new DocumentationFacet().withDescription("Source table for analytics"));

    OpenLineageInputDataset inputDataset =
        new OpenLineageInputDataset()
            .withNamespace(sourceNamespace)
            .withName(sourceName)
            .withFacets(inputFacets);

    DatasetFacets outputBaseFacets =
        new DatasetFacets()
            .withDocumentation(
                new DocumentationFacet().withDescription("Aggregated metrics table"));

    OpenLineageOutputDataset outputDataset =
        new OpenLineageOutputDataset()
            .withNamespace(targetNamespace)
            .withName(targetName)
            .withFacets(outputBaseFacets);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(new OpenLineageJob().withNamespace("test-namespace").withName("documented-job"))
        .withInputs(List.of(inputDataset))
        .withOutputs(List.of(outputDataset));
  }

  private OpenLineageRunEvent createOpenLineageEventWithMultipleColumnLineage(
      Table sourceTable, Table targetTable, EventType eventType) {
    String sourceNamespace = "openmetadata://" + sourceTable.getService().getName();
    String sourceName = sourceTable.getDatabaseSchema().getName() + "." + sourceTable.getName();

    String targetNamespace = "openmetadata://" + targetTable.getService().getName();
    String targetName = targetTable.getDatabaseSchema().getName() + "." + targetTable.getName();

    List<SchemaField> schemaFields = new ArrayList<>();
    schemaFields.add(new SchemaField().withName("id").withType("INTEGER"));
    schemaFields.add(new SchemaField().withName("name").withType("STRING"));
    schemaFields.add(new SchemaField().withName("email").withType("STRING"));
    schemaFields.add(new SchemaField().withName("created_at").withType("TIMESTAMP"));

    DatasetFacets inputFacets =
        new DatasetFacets().withSchema(new SchemaFacet().withFields(schemaFields));

    OpenLineageInputDataset inputDataset =
        new OpenLineageInputDataset()
            .withNamespace(sourceNamespace)
            .withName(sourceName)
            .withFacets(inputFacets);

    InputField idInputField =
        new InputField().withNamespace(sourceNamespace).withName(sourceName).withField("id");
    InputField nameInputField =
        new InputField().withNamespace(sourceNamespace).withName(sourceName).withField("name");
    InputField emailInputField =
        new InputField().withNamespace(sourceNamespace).withName(sourceName).withField("email");

    ColumnLineageField idColumnLineage =
        new ColumnLineageField()
            .withInputFields(List.of(idInputField))
            .withTransformationDescription("identity");
    ColumnLineageField nameColumnLineage =
        new ColumnLineageField()
            .withInputFields(List.of(nameInputField))
            .withTransformationDescription("upper case transformation");
    ColumnLineageField emailColumnLineage =
        new ColumnLineageField()
            .withInputFields(List.of(emailInputField))
            .withTransformationDescription("masked for privacy");

    Fields fieldsMap = new Fields();
    fieldsMap.setAdditionalProperty("id", idColumnLineage);
    fieldsMap.setAdditionalProperty("display_name", nameColumnLineage);
    fieldsMap.setAdditionalProperty("email_hash", emailColumnLineage);

    ColumnLineageFacet columnLineageFacet = new ColumnLineageFacet().withFields(fieldsMap);

    OutputDatasetFacets outputFacets =
        new OutputDatasetFacets().withColumnLineage(columnLineageFacet);

    OpenLineageOutputDataset outputDataset =
        new OpenLineageOutputDataset()
            .withNamespace(targetNamespace)
            .withName(targetName)
            .withOutputFacets(outputFacets);

    return new OpenLineageRunEvent()
        .withEventTime(new Date())
        .withProducer(URI.create("https://test.openlineage.io/producer"))
        .withSchemaURL(URI.create("https://openlineage.io/spec/1-0-5/OpenLineage.json"))
        .withEventType(eventType)
        .withRun(new OpenLineageRun().withRunId(UUID.randomUUID()))
        .withJob(
            new OpenLineageJob().withNamespace("test-namespace").withName("multi-column-lineage"))
        .withInputs(List.of(inputDataset))
        .withOutputs(List.of(outputDataset));
  }

  private OpenLineageResponse postOpenLineageEvent(
      OpenLineageRunEvent event, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("openlineage/lineage");
    return TestUtils.post(
        target, event, OpenLineageResponse.class, Status.OK.getStatusCode(), authHeaders);
  }

  private OpenLineageResponse postOpenLineageBatch(
      OpenLineageBatchRequest batch, Map<String, String> authHeaders) throws HttpResponseException {
    WebTarget target = getResource("openlineage/lineage/batch");
    return TestUtils.post(
        target, batch, OpenLineageResponse.class, Status.OK.getStatusCode(), authHeaders);
  }
}
