package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import java.util.List;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
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
}
