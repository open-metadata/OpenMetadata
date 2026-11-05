package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.jdbi3.ContainerRepository;

class ChildFieldResolverTest {

  @Test
  void registry_coversExactlyTheNineTypes() {
    assertEquals(
        Set.of(
            Entity.TABLE,
            Entity.DASHBOARD_DATA_MODEL,
            Entity.TOPIC,
            Entity.CONTAINER,
            Entity.MLMODEL,
            Entity.PIPELINE,
            Entity.SEARCH_INDEX,
            Entity.API_ENDPOINT,
            Entity.WORKSHEET),
        ChildFieldResolver.supportedEntityTypes());
  }

  @Test
  void supports_chartIsNotSupported() {
    // Charts are a real entity with their own RBAC; explicitly outside /v1/columns.
    assertFalse(ChildFieldResolver.supports(Entity.CHART));
  }

  @Test
  void specFor_unknownTypeThrowsListingSupported() {
    IllegalArgumentException error =
        assertThrows(IllegalArgumentException.class, () -> ChildFieldResolver.specFor("chart"));
    assertTrue(error.getMessage().contains("table"));
  }

  @Test
  void specFor_nullTypeThrows() {
    assertThrows(IllegalArgumentException.class, () -> ChildFieldResolver.specFor(null));
  }

  @Test
  void childrenOf_tableColumns() {
    Table table = new Table().withColumns(List.of(new Column().withName("id")));
    List<FieldInterface> children = ChildFieldResolver.childrenOf(table, Entity.TABLE);
    assertEquals(1, children.size());
    assertEquals("id", children.get(0).getName());
  }

  @Test
  void childrenOf_topicNestedContainerPath() {
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema().withSchemaFields(List.of(new Field().withName("customer"))));
    assertEquals(1, ChildFieldResolver.childrenOf(topic, Entity.TOPIC).size());
  }

  @Test
  void childrenOf_apiEndpointConcatenatesBothSchemas() {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("in"))))
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("out"))));
    List<FieldInterface> children = ChildFieldResolver.childrenOf(endpoint, Entity.API_ENDPOINT);
    assertEquals(List.of("in", "out"), children.stream().map(FieldInterface::getName).toList());
  }

  @Test
  void childrenOf_nullContainerYieldsEmptyList() {
    assertEquals(List.of(), ChildFieldResolver.childrenOf(new Topic(), Entity.TOPIC));
    assertEquals(List.of(), ChildFieldResolver.childrenOf(new Container(), Entity.CONTAINER));
    assertEquals(List.of(), ChildFieldResolver.childrenOf(new MlModel(), Entity.MLMODEL));
  }

  @Test
  void childrenOf_pipelineTasksAndMlFeaturesAreTyped() {
    Pipeline pipeline = new Pipeline().withTasks(List.of(new Task().withName("t1")));
    assertTrue(ChildFieldResolver.childrenOf(pipeline, Entity.PIPELINE).get(0) instanceof Task);
    MlModel model = new MlModel().withMlFeatures(List.of(new MlFeature().withName("f1")));
    assertTrue(ChildFieldResolver.childrenOf(model, Entity.MLMODEL).get(0) instanceof MlFeature);
  }

  @Test
  void locate_byFqnRecursesStructChildren() {
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
    Optional<FieldInterface> found =
        ChildFieldResolver.locate(table, Entity.TABLE, "svc.db.sch.tbl.profile.full_name");
    assertTrue(found.isPresent());
    assertEquals("full_name", found.get().getName());
  }

  @Test
  void locate_missingChildReturnsEmpty() {
    Table table =
        new Table()
            .withFullyQualifiedName("svc.db.sch.tbl")
            .withColumns(
                List.of(new Column().withName("id").withFullyQualifiedName("svc.db.sch.tbl.id")));
    assertTrue(ChildFieldResolver.locate(table, Entity.TABLE, "svc.db.sch.tbl.nope").isEmpty());
  }

  @Test
  void ensureChildFqns_fillsMissingRecursively() {
    Container container =
        new Container()
            .withFullyQualifiedName("svc.\"a.b\".bucket")
            .withDataModel(
                new ContainerDataModel()
                    .withColumns(
                        List.of(
                            new Column()
                                .withName("payload")
                                .withChildren(List.of(new Column().withName("inner"))))));
    ChildFieldResolver.ensureChildFqns(container, Entity.CONTAINER);
    assertEquals(
        "svc.\"a.b\".bucket.payload",
        container.getDataModel().getColumns().get(0).getFullyQualifiedName());
    assertEquals(
        "svc.\"a.b\".bucket.payload.inner",
        container.getDataModel().getColumns().get(0).getChildren().get(0).getFullyQualifiedName());
  }

  @Test
  void ensureChildFqns_keepsPersistedFqns() {
    Table table =
        new Table()
            .withFullyQualifiedName("svc.db.sch.tbl")
            .withColumns(
                List.of(
                    new Column().withName("id").withFullyQualifiedName("persisted.fqn.value.x.y")));
    ChildFieldResolver.ensureChildFqns(table, Entity.TABLE);
    assertEquals("persisted.fqn.value.x.y", table.getColumns().get(0).getFullyQualifiedName());
  }

  @Test
  void parentFqnOf_fixedDepthMatchesLegacyPerType() {
    assertEquals(
        "svc.db.sch.tbl", ChildFieldResolver.parentFqnOf("svc.db.sch.tbl.col", Entity.TABLE));
    assertEquals(
        "svc.db.sch.tbl", ChildFieldResolver.parentFqnOf("svc.db.sch.tbl.col.child", Entity.TABLE));
    assertEquals(
        "svc.model.dm",
        ChildFieldResolver.parentFqnOf("svc.model.dm.col", Entity.DASHBOARD_DATA_MODEL));
    assertEquals("svc.topic", ChildFieldResolver.parentFqnOf("svc.topic.field", Entity.TOPIC));
    assertEquals("svc.pipe", ChildFieldResolver.parentFqnOf("svc.pipe.task1", Entity.PIPELINE));
    assertEquals("svc.model", ChildFieldResolver.parentFqnOf("svc.model.feature1", Entity.MLMODEL));
    assertEquals("svc.idx", ChildFieldResolver.parentFqnOf("svc.idx.field1", Entity.SEARCH_INDEX));
    assertEquals(
        "svc.coll.endpoint",
        ChildFieldResolver.parentFqnOf("svc.coll.endpoint.field1", Entity.API_ENDPOINT));
  }

  @Test
  void parentFqnOf_tooShortFqnThrows() {
    assertThrows(
        IllegalArgumentException.class,
        () -> ChildFieldResolver.parentFqnOf("svc.db.sch.tbl", Entity.TABLE));
  }

  @Test
  void parentFqnOf_quotedDottedChildName() {
    assertEquals(
        "svc.db.sch.tbl",
        ChildFieldResolver.parentFqnOf("svc.db.sch.tbl.\"col.with.dot\"", Entity.TABLE));
  }

  @Test
  void parentFqnOf_container_longestPrefixWinsOverShorter() {
    // Nested containers: svc.root and svc.root.sub both exist; the child
    // svc.root.sub.col must resolve to svc.root.sub, never svc.root.
    ContainerRepository repository = Mockito.mock(ContainerRepository.class);
    Container sub = new Container().withFullyQualifiedName("svc.root.sub");
    Mockito.when(repository.findByNameOrNull(eq("svc.root.sub"), eq(Include.ALL))).thenReturn(sub);
    Mockito.when(repository.findByNameOrNull(eq("svc.root"), eq(Include.ALL)))
        .thenReturn(new Container().withFullyQualifiedName("svc.root"));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked.when(() -> Entity.getEntityRepository(Entity.CONTAINER)).thenReturn(repository);
      assertEquals(
          "svc.root.sub", ChildFieldResolver.parentFqnOf("svc.root.sub.col", Entity.CONTAINER));
    }
  }

  @Test
  void containerListFor_directAndNestedContainers() {
    Table table = new Table().withColumns(List.of(new Column().withName("id")));
    assertEquals(1, ChildFieldResolver.containerListFor(table, "columns").size());

    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema().withSchemaFields(List.of(new Field().withName("f"))));
    assertEquals(1, ChildFieldResolver.containerListFor(topic, "messageSchema").size());

    Pipeline pipeline = new Pipeline().withTasks(List.of(new Task().withName("t1")));
    assertEquals(1, ChildFieldResolver.containerListFor(pipeline, "tasks").size());
  }

  @Test
  void containerListFor_resolvesEveryRegistryTypeFromItsPojoClass() {
    // containerListFor maps a POJO to its registry type by lowercased simple class name. That
    // holds for all nine today; this pins it, because a future registry type whose class name
    // does not lowercase to its entity type would silently resolve to null instead of failing.
    assertNotNull(
        ChildFieldResolver.containerListFor(new Table().withColumns(List.of()), "columns"));
    assertNotNull(
        ChildFieldResolver.containerListFor(
            new DashboardDataModel().withColumns(List.of()), "columns"));
    assertNotNull(
        ChildFieldResolver.containerListFor(
            new Topic().withMessageSchema(new MessageSchema().withSchemaFields(List.of())),
            "messageSchema"));
    assertNotNull(
        ChildFieldResolver.containerListFor(
            new Container().withDataModel(new ContainerDataModel().withColumns(List.of())),
            "dataModel"));
    assertNotNull(
        ChildFieldResolver.containerListFor(new MlModel().withMlFeatures(List.of()), "mlFeatures"));
    assertNotNull(
        ChildFieldResolver.containerListFor(new Pipeline().withTasks(List.of()), "tasks"));
    assertNotNull(
        ChildFieldResolver.containerListFor(new SearchIndex().withFields(List.of()), "fields"));
    assertNotNull(
        ChildFieldResolver.containerListFor(
            new APIEndpoint().withRequestSchema(new APISchema().withSchemaFields(List.of())),
            "requestSchema"));
    assertNotNull(
        ChildFieldResolver.containerListFor(new Worksheet().withColumns(List.of()), "columns"));
  }

  @Test
  void containerListFor_unknownContainerOrTypeReturnsNull() {
    assertNull(ChildFieldResolver.containerListFor(new Table(), "mlFeatures"));
    assertNull(ChildFieldResolver.containerListFor(new Glossary(), "columns"));
  }

  // The "columns" alias. One test per registry type, because the point is that the alias is
  // uniform and not a special case for the types that already happened to work.

  @Test
  void columnsAlias_tableAndDashboardDataModelAndWorksheet_returnTheSameLiveListAsBefore() {
    // For these three the registry's container path IS "columns", so alias and declared path
    // coincide. assertSame is the proof: the very same list instance comes back, so nothing
    // downstream can observe a difference.
    Table table = new Table().withColumns(List.of(new Column().withName("id")));
    assertSame(table.getColumns(), ChildFieldResolver.containerListFor(table, "columns"));

    DashboardDataModel model =
        new DashboardDataModel().withColumns(List.of(new Column().withName("id")));
    assertSame(model.getColumns(), ChildFieldResolver.containerListFor(model, "columns"));

    Worksheet worksheet = new Worksheet().withColumns(List.of(new Column().withName("id")));
    assertSame(worksheet.getColumns(), ChildFieldResolver.containerListFor(worksheet, "columns"));
  }

  @Test
  void columnsAlias_topicResolvesToMessageSchemaFields() {
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema().withSchemaFields(List.of(new Field().withName("customer_id"))));
    List<?> children = ChildFieldResolver.containerListFor(topic, "columns");
    assertEquals(1, children.size());
    assertEquals("customer_id", ((Field) children.getFirst()).getName());
  }

  @Test
  void columnsAlias_pipelineResolvesToTasks() {
    Pipeline pipeline = new Pipeline().withTasks(List.of(new Task().withName("extract")));
    assertEquals(
        "extract",
        ((Task) ChildFieldResolver.containerListFor(pipeline, "columns").getFirst()).getName());
  }

  @Test
  void columnsAlias_mlModelResolvesToMlFeatures() {
    MlModel model = new MlModel().withMlFeatures(List.of(new MlFeature().withName("age")));
    assertEquals(
        "age",
        ((MlFeature) ChildFieldResolver.containerListFor(model, "columns").getFirst()).getName());
  }

  @Test
  void columnsAlias_searchIndexResolvesToFields() {
    SearchIndex index =
        new SearchIndex().withFields(List.of(new SearchIndexField().withName("title")));
    assertEquals(
        "title",
        ((SearchIndexField) ChildFieldResolver.containerListFor(index, "columns").getFirst())
            .getName());
  }

  @Test
  void columnsAlias_containerResolvesToDataModelColumns() {
    Container container =
        new Container()
            .withDataModel(
                new ContainerDataModel().withColumns(List.of(new Column().withName("payload"))));
    assertEquals(
        "payload",
        ((Column) ChildFieldResolver.containerListFor(container, "columns").getFirst()).getName());
  }

  @Test
  void columnsAlias_apiEndpointConcatenatesBothSchemasRequestFirst() {
    // The only two-path type. The alias must see BOTH schemas, and the declaration order in
    // containerPaths (request, then response) is the tie-break when a name exists in both.
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("shared"))))
            .withResponseSchema(
                new APISchema()
                    .withSchemaFields(
                        List.of(new Field().withName("shared"), new Field().withName("userId"))));
    List<?> children = ChildFieldResolver.containerListFor(endpoint, "columns");
    assertEquals(3, children.size());
    assertSame(endpoint.getRequestSchema().getSchemaFields().getFirst(), children.getFirst());
  }

  @Test
  void columnsAlias_registryTypeWithNullContainer_returnsEmptyNotNull() {
    // childrenOf is null-tolerant, so the alias yields an empty list rather than null. Callers
    // then get "field not found" rather than "unknown container", which is the same outcome with
    // a clearer log line. Pinned so the distinction is deliberate.
    assertEquals(List.of(), ChildFieldResolver.containerListFor(new Topic(), "columns"));
  }

  @Test
  void columnsAlias_doesNotApplyToNonRegistryTypes() {
    // Glossary has no registered child container. The alias must not invent one; FieldPathUtils'
    // plain getter path still serves types the registry does not cover.
    assertNull(ChildFieldResolver.containerListFor(new Glossary(), "columns"));
  }

  @Test
  void parentFqnOf_container_noParentFoundThrows() {
    ContainerRepository repository = Mockito.mock(ContainerRepository.class);
    Mockito.when(repository.findByNameOrNull(anyString(), eq(Include.ALL))).thenReturn(null);
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked.when(() -> Entity.getEntityRepository(Entity.CONTAINER)).thenReturn(repository);
      assertThrows(
          IllegalArgumentException.class,
          () -> ChildFieldResolver.parentFqnOf("svc.root.sub.col", Entity.CONTAINER));
    }
  }

  @Test
  void containerFields_asksForTheContainerPropertyOnly() {
    // The read paths request this instead of requiredFields so they do not pay for a tag lookup
    // they will not read. A nested path resolves to the property that holds it.
    assertEquals("columns", ChildFieldResolver.containerFields(Entity.TABLE));
    assertEquals("messageSchema", ChildFieldResolver.containerFields(Entity.TOPIC));
    assertEquals("dataModel", ChildFieldResolver.containerFields(Entity.CONTAINER));
    assertEquals("mlFeatures", ChildFieldResolver.containerFields(Entity.MLMODEL));
    assertEquals("tasks", ChildFieldResolver.containerFields(Entity.PIPELINE));
    assertEquals("fields", ChildFieldResolver.containerFields(Entity.SEARCH_INDEX));
  }

  @Test
  void containerFields_apiEndpointCoversBothSchemas() {
    // The one type with two containers: dropping either half would silently hide its fields.
    assertEquals(
        "requestSchema,responseSchema", ChildFieldResolver.containerFields(Entity.API_ENDPOINT));
  }

  /**
   * The parent class per registry type. Spelled out rather than read from
   * Entity.getEntityClassFromType, whose map is populated by repository registration at server
   * bootstrap and is therefore empty in a unit test.
   */
  static final Map<String, Class<?>> PARENT_CLASS_BY_TYPE =
      Map.of(
          Entity.TABLE, Table.class,
          Entity.DASHBOARD_DATA_MODEL, DashboardDataModel.class,
          Entity.TOPIC, Topic.class,
          Entity.CONTAINER, Container.class,
          Entity.MLMODEL, MlModel.class,
          Entity.PIPELINE, Pipeline.class,
          Entity.SEARCH_INDEX, SearchIndex.class,
          Entity.API_ENDPOINT, APIEndpoint.class,
          Entity.WORKSHEET, Worksheet.class);

  @Test
  void containerFields_areRealEntityPropertiesSoTheLoadDoesNotThrow() {
    // getFields validates a requested field against the entity class's JSON properties and throws
    // on anything else, so a container path whose first segment is not a real property would fail
    // every read for that type. This catches it here rather than at runtime.
    assertEquals(
        ChildFieldResolver.supportedEntityTypes(),
        PARENT_CLASS_BY_TYPE.keySet(),
        "a new registry type needs its parent class here");
    for (String entityType : ChildFieldResolver.supportedEntityTypes()) {
      Set<String> properties = Entity.getEntityFields(PARENT_CLASS_BY_TYPE.get(entityType));
      for (String field : ChildFieldResolver.containerFields(entityType).split(",")) {
        assertTrue(
            properties.contains(field),
            "%s is not a property of %s, so requesting it would throw"
                .formatted(field, entityType));
      }
    }
  }
}
