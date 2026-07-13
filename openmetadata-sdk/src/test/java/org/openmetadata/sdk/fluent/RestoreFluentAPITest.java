/*
 *  Copyright 2026 Collate
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
package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mock;
import org.mockito.MockitoAnnotations;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.Database;
import org.openmetadata.schema.entity.data.DatabaseSchema;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.domains.Domain;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.models.AsyncJobResponse;
import org.openmetadata.sdk.services.dataassets.DashboardService;
import org.openmetadata.sdk.services.dataassets.MlModelService;
import org.openmetadata.sdk.services.dataassets.PipelineService;
import org.openmetadata.sdk.services.dataassets.TableService;
import org.openmetadata.sdk.services.dataassets.TopicService;
import org.openmetadata.sdk.services.databases.DatabaseSchemaService;
import org.openmetadata.sdk.services.databases.DatabaseService;
import org.openmetadata.sdk.services.domains.DomainService;
import org.openmetadata.sdk.services.glossary.GlossaryService;
import org.openmetadata.sdk.services.storages.ContainerService;

/**
 * Verifies the fluent restore builders added for issue #4003. {@code .restore().execute()}
 * routes to the synchronous SDK call; chaining {@code .async()} switches to the server-side
 * async path and returns an {@link AsyncJobResponse}.
 */
class RestoreFluentAPITest {

  @Mock private OpenMetadataClient mockClient;
  @Mock private TableService mockTables;
  @Mock private DatabaseService mockDatabases;
  @Mock private DatabaseSchemaService mockSchemas;
  @Mock private DashboardService mockDashboards;
  @Mock private PipelineService mockPipelines;
  @Mock private TopicService mockTopics;
  @Mock private MlModelService mockMlModels;
  @Mock private ContainerService mockContainers;
  @Mock private GlossaryService mockGlossaries;
  @Mock private DomainService mockDomains;

  @BeforeEach
  void setUp() {
    MockitoAnnotations.openMocks(this);
    when(mockClient.tables()).thenReturn(mockTables);
    when(mockClient.databases()).thenReturn(mockDatabases);
    when(mockClient.databaseSchemas()).thenReturn(mockSchemas);
    when(mockClient.dashboards()).thenReturn(mockDashboards);
    when(mockClient.pipelines()).thenReturn(mockPipelines);
    when(mockClient.topics()).thenReturn(mockTopics);
    when(mockClient.mlModels()).thenReturn(mockMlModels);
    when(mockClient.containers()).thenReturn(mockContainers);
    when(mockClient.glossaries()).thenReturn(mockGlossaries);
    when(mockClient.domains()).thenReturn(mockDomains);
    Tables.setDefaultClient(mockClient);
    Databases.setDefaultClient(mockClient);
    DatabaseSchemas.setDefaultClient(mockClient);
    Dashboards.setDefaultClient(mockClient);
    Pipelines.setDefaultClient(mockClient);
    Topics.setDefaultClient(mockClient);
    MlModels.setDefaultClient(mockClient);
    Containers.setDefaultClient(mockClient);
    Glossaries.setDefaultClient(mockClient);
    Domains.setDefaultClient(mockClient);
  }

  @Test
  void tablesFluent_syncRestore_callsRestore() throws Exception {
    String id = UUID.randomUUID().toString();
    Table restored = new Table().withId(UUID.fromString(id)).withName("t");
    when(mockTables.restore(id)).thenReturn(restored);

    Table result = Tables.find(id).restore().execute();

    assertSame(restored, result);
    verify(mockTables).restore(id);
    verify(mockTables, never()).restoreServerAsync(eq(id));
  }

  @Test
  void tablesFluent_asyncRestore_callsRestoreServerAsync() throws Exception {
    String id = UUID.randomUUID().toString();
    AsyncJobResponse expected = new AsyncJobResponse("job-1", "Restore initiated successfully.");
    when(mockTables.restoreServerAsync(id)).thenReturn(expected);

    AsyncJobResponse result = Tables.find(id).restore().async().execute();

    assertNotNull(result);
    assertEquals("job-1", result.getJobId());
    assertEquals("Restore initiated successfully.", result.getMessage());
    verify(mockTables).restoreServerAsync(id);
    verify(mockTables, never()).restore(eq(id));
  }

  @Test
  void databasesFluent_syncRestore_callsRestore() throws Exception {
    String id = UUID.randomUUID().toString();
    Database restored = new Database().withId(UUID.fromString(id)).withName("db");
    when(mockDatabases.restore(id)).thenReturn(restored);

    Database result = Databases.find(id).restore().execute();

    assertSame(restored, result);
    verify(mockDatabases).restore(id);
    verify(mockDatabases, never()).restoreServerAsync(eq(id));
  }

  @Test
  void databasesFluent_asyncRestore_callsRestoreServerAsync() throws Exception {
    String id = UUID.randomUUID().toString();
    AsyncJobResponse expected = new AsyncJobResponse("job-2", "Restore initiated successfully.");
    when(mockDatabases.restoreServerAsync(id)).thenReturn(expected);

    AsyncJobResponse result = Databases.find(id).restore().async().execute();

    assertNotNull(result);
    assertEquals("job-2", result.getJobId());
    verify(mockDatabases).restoreServerAsync(id);
    verify(mockDatabases, never()).restore(eq(id));
  }

  // ----------------------------------------------------------------------------------------
  // Coverage that the new generic EntityRestorer wiring works for every data-asset fluent.
  // Tables / Databases above are unchanged; below verifies the broader rollout reaches the
  // correct service per fluent — one sync + one async assertion per type to lock the
  // wiring without exhaustively testing every type (they all go through the same
  // EntityRestorer<T> helper, so a representative sample is enough to catch a typo in any
  // single fluent's wire-up).
  // ----------------------------------------------------------------------------------------

  @Test
  void databaseSchemasFluent_restore_routesThroughSchemaService() throws Exception {
    String id = UUID.randomUUID().toString();
    DatabaseSchema restored = new DatabaseSchema().withId(UUID.fromString(id)).withName("s");
    when(mockSchemas.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-schema", "ok");
    when(mockSchemas.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, DatabaseSchemas.find(id).restore().execute());
    assertEquals("job-schema", DatabaseSchemas.find(id).restore().async().execute().getJobId());
    verify(mockSchemas).restore(id);
    verify(mockSchemas).restoreServerAsync(id);
  }

  @Test
  void dashboardsFluent_restore_routesThroughDashboardService() throws Exception {
    String id = UUID.randomUUID().toString();
    Dashboard restored = new Dashboard().withId(UUID.fromString(id)).withName("d");
    when(mockDashboards.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-dash", "ok");
    when(mockDashboards.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Dashboards.find(id).restore().execute());
    assertEquals("job-dash", Dashboards.find(id).restore().async().execute().getJobId());
    verify(mockDashboards).restore(id);
    verify(mockDashboards).restoreServerAsync(id);
  }

  @Test
  void pipelinesFluent_restore_routesThroughPipelineService() throws Exception {
    String id = UUID.randomUUID().toString();
    Pipeline restored = new Pipeline().withId(UUID.fromString(id)).withName("p");
    when(mockPipelines.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-pipe", "ok");
    when(mockPipelines.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Pipelines.find(id).restore().execute());
    assertEquals("job-pipe", Pipelines.find(id).restore().async().execute().getJobId());
    verify(mockPipelines).restore(id);
    verify(mockPipelines).restoreServerAsync(id);
  }

  @Test
  void topicsFluent_restore_routesThroughTopicService() throws Exception {
    String id = UUID.randomUUID().toString();
    Topic restored = new Topic().withId(UUID.fromString(id)).withName("t");
    when(mockTopics.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-topic", "ok");
    when(mockTopics.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Topics.find(id).restore().execute());
    assertEquals("job-topic", Topics.find(id).restore().async().execute().getJobId());
    verify(mockTopics).restore(id);
    verify(mockTopics).restoreServerAsync(id);
  }

  @Test
  void mlModelsFluent_restore_routesThroughMlModelService() throws Exception {
    String id = UUID.randomUUID().toString();
    MlModel restored = new MlModel().withId(UUID.fromString(id)).withName("m");
    when(mockMlModels.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-ml", "ok");
    when(mockMlModels.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, MlModels.find(id).restore().execute());
    assertEquals("job-ml", MlModels.find(id).restore().async().execute().getJobId());
    verify(mockMlModels).restore(id);
    verify(mockMlModels).restoreServerAsync(id);
  }

  @Test
  void containersFluent_restore_routesThroughContainerService() throws Exception {
    String id = UUID.randomUUID().toString();
    Container restored = new Container().withId(UUID.fromString(id)).withName("c");
    when(mockContainers.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-cont", "ok");
    when(mockContainers.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Containers.find(id).restore().execute());
    assertEquals("job-cont", Containers.find(id).restore().async().execute().getJobId());
    verify(mockContainers).restore(id);
    verify(mockContainers).restoreServerAsync(id);
  }

  @Test
  void glossariesFluent_restore_routesThroughGlossaryService() throws Exception {
    String id = UUID.randomUUID().toString();
    Glossary restored = new Glossary().withId(UUID.fromString(id)).withName("g");
    when(mockGlossaries.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-gloss", "ok");
    when(mockGlossaries.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Glossaries.find(id).restore().execute());
    assertEquals("job-gloss", Glossaries.find(id).restore().async().execute().getJobId());
    verify(mockGlossaries).restore(id);
    verify(mockGlossaries).restoreServerAsync(id);
  }

  @Test
  void domainsFluent_restore_routesThroughDomainService() throws Exception {
    String id = UUID.randomUUID().toString();
    Domain restored = new Domain().withId(UUID.fromString(id)).withName("dom");
    when(mockDomains.restore(id)).thenReturn(restored);
    AsyncJobResponse async = new AsyncJobResponse("job-dom", "ok");
    when(mockDomains.restoreServerAsync(id)).thenReturn(async);

    assertSame(restored, Domains.find(id).restore().execute());
    assertEquals("job-dom", Domains.find(id).restore().async().execute().getJobId());
    verify(mockDomains).restore(id);
    verify(mockDomains).restoreServerAsync(id);
  }
}
