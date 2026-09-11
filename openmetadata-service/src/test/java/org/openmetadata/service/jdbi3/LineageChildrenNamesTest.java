package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import java.lang.reflect.Method;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;

/**
 * Characterization tests pinning LineageRepository.getChildrenNames per entity type against the
 * pre-consolidation implementation. These assertions describe what the code does today, including
 * the gaps: the METRIC and PIPELINE arms return empty on purpose here, and Task 11 changes the
 * PIPELINE expectation in the commit that gives pipelines child coverage.
 */
class LineageChildrenNamesTest {

  /**
   * Opens a MockedStatic over Entity with the stubs LineageRepository's static initializer
   * (searchClient = Entity.getSearchRepository().getSearchClient()) and its no-arg constructor
   * (Entity.getCollectionDAO(), Entity.setLineageRepository) both need. Every test body runs inside
   * the returned resource, so the class is never initialized outside the stubbed window.
   */
  static MockedStatic<Entity> mockedEntity() {
    MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class);
    SearchRepository searchRepository = Mockito.mock(SearchRepository.class);
    Mockito.when(searchRepository.getSearchClient()).thenReturn(Mockito.mock(SearchClient.class));
    mocked.when(Entity::getSearchRepository).thenReturn(searchRepository);
    mocked.when(Entity::getCollectionDAO).thenReturn(Mockito.mock(CollectionDAO.class));
    return mocked;
  }

  @SuppressWarnings("unchecked")
  static Set<String> invokeGetChildrenNames(EntityReference reference) throws Exception {
    LineageRepository repository =
        Mockito.mock(LineageRepository.class, Mockito.CALLS_REAL_METHODS);
    Method method =
        LineageRepository.class.getDeclaredMethod("getChildrenNames", EntityReference.class);
    method.setAccessible(true);
    return (Set<String>) method.invoke(repository, reference);
  }

  static EntityReference ref(String type) {
    return new EntityReference().withType(type).withId(UUID.randomUUID());
  }

  @Test
  void table_columnsWithStructChildren() throws Exception {
    Table table =
        new Table()
            .withFullyQualifiedName("svc.db.sch.tbl")
            .withColumns(
                List.of(
                    new Column()
                        .withName("profile")
                        .withFullyQualifiedName("svc.db.sch.tbl.profile")
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("full_name")
                                    .withFullyQualifiedName("svc.db.sch.tbl.profile.full_name")))));
    EntityReference reference = ref(Entity.TABLE);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(table);
      assertEquals(Set.of("profile", "profile.full_name"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void topic_nestedSchemaFields() throws Exception {
    Topic topic =
        new Topic()
            .withFullyQualifiedName("svc.topic")
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("customer")
                                .withFullyQualifiedName("svc.topic.customer")
                                .withChildren(
                                    List.of(
                                        new Field()
                                            .withName("id")
                                            .withFullyQualifiedName("svc.topic.customer.id"))))));
    EntityReference reference = ref(Entity.TOPIC);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TOPIC), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(topic);
      assertEquals(Set.of("customer", "customer.id"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void topic_nullMessageSchema_returnsEmpty() throws Exception {
    Topic topic = new Topic().withFullyQualifiedName("svc.topic");
    EntityReference reference = ref(Entity.TOPIC);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TOPIC), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(topic);
      assertEquals(Set.of(), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void container_dataModelColumns() throws Exception {
    Container container =
        new Container()
            .withFullyQualifiedName("svc.cont")
            .withDataModel(
                new ContainerDataModel()
                    .withColumns(
                        List.of(
                            new Column()
                                .withName("payload")
                                .withFullyQualifiedName("svc.cont.payload"))));
    EntityReference reference = ref(Entity.CONTAINER);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.CONTAINER), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(container);
      assertEquals(Set.of("payload"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void container_nullDataModel_returnsEmpty() throws Exception {
    Container container = new Container().withFullyQualifiedName("svc.cont");
    EntityReference reference = ref(Entity.CONTAINER);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.CONTAINER), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(container);
      assertEquals(Set.of(), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void searchIndex_fields() throws Exception {
    SearchIndex searchIndex =
        new SearchIndex()
            .withFullyQualifiedName("svc.idx")
            .withFields(
                List.of(
                    new SearchIndexField()
                        .withName("title")
                        .withFullyQualifiedName("svc.idx.title")));
    EntityReference reference = ref(Entity.SEARCH_INDEX);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.SEARCH_INDEX), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(searchIndex);
      assertEquals(Set.of("title"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void apiEndpoint_requestAndResponseSchemasAreUnioned() throws Exception {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withFullyQualifiedName("svc.api.ep")
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("status")
                                .withFullyQualifiedName("svc.api.ep.status"))))
            .withRequestSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("payload")
                                .withFullyQualifiedName("svc.api.ep.payload"))));
    EntityReference reference = ref(Entity.API_ENDPOINT);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.API_ENDPOINT), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(endpoint);
      assertEquals(Set.of("status", "payload"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void dashboard_chartsStripParentPrefix() throws Exception {
    Dashboard dashboard =
        new Dashboard()
            .withFullyQualifiedName("svc.dash")
            .withCharts(List.of(new EntityReference().withFullyQualifiedName("svc.dash.chart1")));
    EntityReference reference = ref(Entity.DASHBOARD);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.DASHBOARD), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(dashboard);
      assertEquals(Set.of("chart1"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void mlmodel_featureNames() throws Exception {
    MlModel model =
        new MlModel()
            .withFullyQualifiedName("svc.model")
            .withMlFeatures(
                List.of(new MlFeature().withName("age").withFullyQualifiedName("svc.model.age")));
    EntityReference reference = ref(Entity.MLMODEL);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.MLMODEL), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(model);
      assertEquals(Set.of("age"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void pipeline_currentlyUnsupported_returnsEmpty() throws Exception {
    // Pins today's gap: the PIPELINE arm logs and returns empty. Task 11 deliberately changes
    // this to return task names (child coverage everywhere is the feature); the change happens
    // in that commit only. The MockedStatic is still required even though no getEntity stub is
    // needed: without it the static initializer blows up (see step 0).
    try (MockedStatic<Entity> ignored = mockedEntity()) {
      assertEquals(Set.of(), invokeGetChildrenNames(ref(Entity.PIPELINE)));
    }
  }

  @Test
  void metric_unsupported_returnsEmpty() throws Exception {
    try (MockedStatic<Entity> ignored = mockedEntity()) {
      assertEquals(Set.of(), invokeGetChildrenNames(ref(Entity.METRIC)));
    }
  }
}
