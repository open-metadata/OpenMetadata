package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
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
import org.openmetadata.common.utils.CommonUtil;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.Dashboard;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
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
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.search.SearchClient;
import org.openmetadata.service.search.SearchRepository;
import org.openmetadata.service.util.ChildFieldResolver;

/**
 * Tests for LineageRepository.getChildrenNames per entity type.
 *
 * <p>Written as characterization pins against the pre-consolidation switch, then carried across the
 * migration to the registry unchanged, which is what proves the migration preserved behavior. Two
 * exceptions, both deliberate: pipelines now return task names rather than empty (the registry gives
 * them child coverage), and metric returns its own FQN, the behaviour that arrived with
 * metric-to-column lineage. Metric and dashboard are carve-outs, not registry types.
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

  static Table tableFixture() {
    return new Table()
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
  }

  static Topic topicFixture() {
    return new Topic()
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
  }

  static MlModel mlModelFixture() {
    return new MlModel()
        .withFullyQualifiedName("svc.model")
        .withMlFeatures(
            List.of(new MlFeature().withName("age").withFullyQualifiedName("svc.model.age")));
  }

  @Test
  void table_columnsWithStructChildren() throws Exception {
    Table table = tableFixture();
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
    Topic topic = topicFixture();
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
    MlModel model = mlModelFixture();
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
  void parity_registryChildrenMatchOldSwitch_tableTopicMlmodel() throws Exception {
    record Case(String type, EntityInterface entity) {}
    List<Case> cases =
        List.of(
            new Case(Entity.TABLE, tableFixture()),
            new Case(Entity.TOPIC, topicFixture()),
            new Case(Entity.MLMODEL, mlModelFixture()));
    for (Case testCase : cases) {
      EntityReference reference = ref(testCase.type());
      Set<String> oldResult;
      try (MockedStatic<Entity> mocked = mockedEntity()) {
        mocked
            .when(
                () ->
                    Entity.getEntity(
                        eq(testCase.type()), any(UUID.class), anyString(), any(Include.class)))
            .thenReturn(testCase.entity());
        oldResult = invokeGetChildrenNames(reference);
      }
      Set<String> viaRegistry =
          CommonUtil.getChildrenNames(
              ChildFieldResolver.childrenOf(testCase.entity(), testCase.type()),
              "getChildren",
              testCase.entity().getFullyQualifiedName());
      assertEquals(oldResult, viaRegistry, "parity failed for " + testCase.type());
    }
  }

  @Test
  void pipeline_taskNamesNowSupportedViaRegistry() throws Exception {
    // Was pipeline_currentlyUnsupported_returnsEmpty, which pinned the old gap. Pipelines are in
    // the registry now, so their task names surface like any other child collection. That is the
    // feature, and the assertion was flipped in the commit that caused it.
    Pipeline pipeline =
        new Pipeline()
            .withFullyQualifiedName("svc.pipe")
            .withTasks(
                List.of(new Task().withName("extract").withFullyQualifiedName("svc.pipe.extract")));
    EntityReference reference = ref(Entity.PIPELINE);
    try (MockedStatic<Entity> mocked = mockedEntity()) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(pipeline);
      assertEquals(Set.of("extract"), invokeGetChildrenNames(reference));
    }
  }

  @Test
  void metric_returnsItsOwnFqnAsTheSingleColumnEndpoint() throws Exception {
    // A metric has no child collection: it is the leaf a column feeds, so its own FQN is the only
    // valid column endpoint. That makes it a carve-out rather than a registry type, and it is what
    // lets a column point at a metric in lineage.
    try (MockedStatic<Entity> ignored = mockedEntity()) {
      EntityReference metric = ref(Entity.METRIC).withFullyQualifiedName("metricSvc.total_sales");
      assertEquals(Set.of("metricSvc.total_sales"), invokeGetChildrenNames(metric));
    }
  }

  @Test
  void metric_withNoFqn_returnsASetThatMatchesNoColumn() throws Exception {
    // A singleton rather than Set.of: a null FQN must not throw here, and the resulting set then
    // rejects every candidate column, which is the behaviour the lineage check wants.
    try (MockedStatic<Entity> ignored = mockedEntity()) {
      Set<String> names = invokeGetChildrenNames(ref(Entity.METRIC));
      assertEquals(1, names.size());
      assertFalse(names.contains("any.column"));
    }
  }
}
