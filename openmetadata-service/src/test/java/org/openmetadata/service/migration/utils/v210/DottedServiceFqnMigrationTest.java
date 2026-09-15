package org.openmetadata.service.migration.utils.v210;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Answers.RETURNS_DEEP_STUBS;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.util.Arrays;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.jdbi.v3.core.Handle;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Chart;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.services.DashboardService;
import org.openmetadata.schema.entity.services.MessagingService;
import org.openmetadata.schema.entity.services.MlModelService;
import org.openmetadata.schema.entity.services.PipelineService;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.CollectionDAO;
import org.openmetadata.service.util.FullyQualifiedName;

class DottedServiceFqnMigrationTest {

  @Test
  void repairsDashboardChartPipelineTopicAndMlModelUnderDottedServices() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.DashboardDAO dashboardDAO = mock(CollectionDAO.DashboardDAO.class);
    CollectionDAO.ChartDAO chartDAO = mock(CollectionDAO.ChartDAO.class);
    CollectionDAO.PipelineServiceDAO pipelineServiceDAO =
        mock(CollectionDAO.PipelineServiceDAO.class);
    CollectionDAO.PipelineDAO pipelineDAO = mock(CollectionDAO.PipelineDAO.class);
    CollectionDAO.MessagingServiceDAO messagingServiceDAO =
        mock(CollectionDAO.MessagingServiceDAO.class);
    CollectionDAO.TopicDAO topicDAO = mock(CollectionDAO.TopicDAO.class);
    CollectionDAO.MlModelServiceDAO mlModelServiceDAO = mock(CollectionDAO.MlModelServiceDAO.class);
    CollectionDAO.MlModelDAO mlModelDAO = mock(CollectionDAO.MlModelDAO.class);

    when(collectionDAO.relationshipDAO()).thenReturn(relationshipDAO);
    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.dashboardDAO()).thenReturn(dashboardDAO);
    when(collectionDAO.chartDAO()).thenReturn(chartDAO);
    when(collectionDAO.pipelineServiceDAO()).thenReturn(pipelineServiceDAO);
    when(collectionDAO.pipelineDAO()).thenReturn(pipelineDAO);
    when(collectionDAO.messagingServiceDAO()).thenReturn(messagingServiceDAO);
    when(collectionDAO.topicDAO()).thenReturn(topicDAO);
    when(collectionDAO.mlModelServiceDAO()).thenReturn(mlModelServiceDAO);
    when(collectionDAO.mlModelDAO()).thenReturn(mlModelDAO);

    UUID dashboardServiceId = UUID.randomUUID();
    UUID dashboardId = UUID.randomUUID();
    UUID chartId = UUID.randomUUID();
    UUID pipelineServiceId = UUID.randomUUID();
    UUID pipelineId = UUID.randomUUID();
    UUID messagingServiceId = UUID.randomUUID();
    UUID topicId = UUID.randomUUID();
    UUID mlModelServiceId = UUID.randomUUID();
    UUID mlModelId = UUID.randomUUID();

    stubServiceRows(handle, "dashboard_service_entity", dashboardServiceId);
    stubServiceRows(handle, "pipeline_service_entity", pipelineServiceId);
    stubServiceRows(handle, "messaging_service_entity", messagingServiceId);
    stubServiceRows(handle, "mlmodel_service_entity", mlModelServiceId);

    when(relationshipDAO.findTo(
            dashboardServiceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.DASHBOARD))
        .thenReturn(List.of(relationship(dashboardId, Entity.DASHBOARD)));
    when(relationshipDAO.findTo(
            dashboardServiceId,
            Entity.DASHBOARD_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.CHART))
        .thenReturn(List.of(relationship(chartId, Entity.CHART)));
    when(relationshipDAO.findTo(
            pipelineServiceId,
            Entity.PIPELINE_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.PIPELINE))
        .thenReturn(List.of(relationship(pipelineId, Entity.PIPELINE)));
    when(relationshipDAO.findTo(
            messagingServiceId,
            Entity.MESSAGING_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.TOPIC))
        .thenReturn(List.of(relationship(topicId, Entity.TOPIC)));
    when(relationshipDAO.findTo(
            mlModelServiceId,
            Entity.MLMODEL_SERVICE,
            Relationship.CONTAINS.ordinal(),
            Entity.MLMODEL))
        .thenReturn(List.of(relationship(mlModelId, Entity.MLMODEL)));

    String dashboardServiceFqn = "\"dash.service\"";
    String pipelineServiceFqn = "\"pipe.service\"";
    String messagingServiceFqn = "\"msg.service\"";
    String mlModelServiceFqn = "\"ml.service\"";

    DashboardService dashboardService =
        new DashboardService()
            .withId(dashboardServiceId)
            .withName("dash.service")
            .withFullyQualifiedName(dashboardServiceFqn);
    Dashboard dashboard =
        new Dashboard()
            .withId(dashboardId)
            .withName("sales")
            .withFullyQualifiedName("dash.service.sales");
    Chart chart =
        new Chart()
            .withId(chartId)
            .withName("revenue")
            .withFullyQualifiedName("dash.service.revenue");
    PipelineService pipelineService =
        new PipelineService()
            .withId(pipelineServiceId)
            .withName("pipe.service")
            .withFullyQualifiedName(pipelineServiceFqn);
    Pipeline pipeline =
        new Pipeline()
            .withId(pipelineId)
            .withName("etl")
            .withFullyQualifiedName("pipe.service.etl");
    MessagingService messagingService =
        new MessagingService()
            .withId(messagingServiceId)
            .withName("msg.service")
            .withFullyQualifiedName(messagingServiceFqn);
    Topic topic =
        new Topic().withId(topicId).withName("events").withFullyQualifiedName("msg.service.events");
    MlModelService mlModelService =
        new MlModelService()
            .withId(mlModelServiceId)
            .withName("ml.service")
            .withFullyQualifiedName(mlModelServiceFqn);
    MlModel mlModel =
        new MlModel()
            .withId(mlModelId)
            .withName("churn")
            .withFullyQualifiedName("ml.service.churn");

    when(dashboardServiceDAO.findEntityById(dashboardServiceId)).thenReturn(dashboardService);
    when(dashboardDAO.findEntityById(dashboardId)).thenReturn(dashboard);
    when(chartDAO.findEntityById(chartId)).thenReturn(chart);
    when(pipelineServiceDAO.findEntityById(pipelineServiceId)).thenReturn(pipelineService);
    when(pipelineDAO.findEntityById(pipelineId)).thenReturn(pipeline);
    when(messagingServiceDAO.findEntityById(messagingServiceId)).thenReturn(messagingService);
    when(topicDAO.findEntityById(topicId)).thenReturn(topic);
    when(mlModelServiceDAO.findEntityById(mlModelServiceId)).thenReturn(mlModelService);
    when(mlModelDAO.findEntityById(mlModelId)).thenReturn(mlModel);

    DottedServiceFqnMigration.repairDottedServiceChildFqns(handle, collectionDAO);

    // Observable outcome: each child now carries the canonical quoted-service FQN, and update()
    // (which rewrites the @BindFQN-hashed fqnHash) was invoked for it.
    assertEquals(
        FullyQualifiedName.add(dashboardServiceFqn, "sales"), dashboard.getFullyQualifiedName());
    assertEquals(
        FullyQualifiedName.add(dashboardServiceFqn, "revenue"), chart.getFullyQualifiedName());
    assertEquals(
        FullyQualifiedName.add(pipelineServiceFqn, "etl"), pipeline.getFullyQualifiedName());
    assertEquals(
        FullyQualifiedName.add(messagingServiceFqn, "events"), topic.getFullyQualifiedName());
    assertEquals(
        FullyQualifiedName.add(mlModelServiceFqn, "churn"), mlModel.getFullyQualifiedName());

    verify(dashboardDAO).update(dashboard);
    verify(chartDAO).update(chart);
    verify(pipelineDAO).update(pipeline);
    verify(topicDAO).update(topic);
    verify(mlModelDAO).update(mlModel);
  }

  @Test
  void returnsEarlyAndTouchesNothingWhenNoDottedServicesExist() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);

    stubServiceRows(handle, "dashboard_service_entity");
    stubServiceRows(handle, "pipeline_service_entity");
    stubServiceRows(handle, "messaging_service_entity");
    stubServiceRows(handle, "mlmodel_service_entity");

    DottedServiceFqnMigration.repairDottedServiceChildFqns(handle, collectionDAO);

    verifyNoInteractions(collectionDAO);
  }

  @Test
  void skipsServiceWhoseDottedNameHasUnquotedFqn() {
    Handle handle = mock(Handle.class, RETURNS_DEEP_STUBS);
    CollectionDAO collectionDAO = mock(CollectionDAO.class);
    CollectionDAO.EntityRelationshipDAO relationshipDAO =
        mock(CollectionDAO.EntityRelationshipDAO.class);
    CollectionDAO.DashboardServiceDAO dashboardServiceDAO =
        mock(CollectionDAO.DashboardServiceDAO.class);
    CollectionDAO.DashboardDAO dashboardDAO = mock(CollectionDAO.DashboardDAO.class);

    when(collectionDAO.dashboardServiceDAO()).thenReturn(dashboardServiceDAO);
    when(collectionDAO.dashboardDAO()).thenReturn(dashboardDAO);

    UUID serviceId = UUID.randomUUID();
    stubServiceRows(handle, "dashboard_service_entity", serviceId);
    stubServiceRows(handle, "pipeline_service_entity");
    stubServiceRows(handle, "messaging_service_entity");
    stubServiceRows(handle, "mlmodel_service_entity");

    // A dotted name whose stored FQN is NOT quoted cannot have produced the corruption -> skip it.
    DashboardService service =
        new DashboardService()
            .withId(serviceId)
            .withName("dash.service")
            .withFullyQualifiedName("dash.service");
    when(dashboardServiceDAO.findEntityById(serviceId)).thenReturn(service);

    DottedServiceFqnMigration.repairDottedServiceChildFqns(handle, collectionDAO);

    verify(relationshipDAO, never())
        .findTo(
            serviceId, Entity.DASHBOARD_SERVICE, Relationship.CONTAINS.ordinal(), Entity.DASHBOARD);
    verify(dashboardDAO, never()).update(any());
  }

  private static void stubServiceRows(Handle handle, String tableName, UUID... ids) {
    String query = String.format("SELECT id FROM %s WHERE name LIKE '%%.%%'", tableName);
    List<Map<String, Object>> rows =
        Arrays.stream(ids)
            .map(
                id -> {
                  Map<String, Object> row = new HashMap<>();
                  row.put("id", id.toString());
                  return row;
                })
            .toList();
    when(handle.createQuery(query).mapToMap().list()).thenReturn(rows);
  }

  private static CollectionDAO.EntityRelationshipRecord relationship(UUID id, String type) {
    return CollectionDAO.EntityRelationshipRecord.builder().id(id).type(type).json("{}").build();
  }
}
