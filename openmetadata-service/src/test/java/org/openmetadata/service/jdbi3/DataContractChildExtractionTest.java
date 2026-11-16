package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.FieldInterface;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.Container;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.MlModel;
import org.openmetadata.schema.entity.data.Pipeline;
import org.openmetadata.schema.entity.data.SearchIndex;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.entity.data.Worksheet;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.ContainerDataModel;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.schema.type.MlFeature;
import org.openmetadata.schema.type.SearchIndexField;
import org.openmetadata.schema.type.Task;
import org.openmetadata.service.Entity;
import org.openmetadata.service.util.ChildFieldResolver;

/**
 * Tests for DataContract schema validation.
 *
 * <p>Written as characterization pins against the four pre-consolidation per-type validators, then
 * repointed to the single generic validator with every expectation unchanged, which is what proves
 * the consolidation preserved behavior. Two invariants they exist to protect: contract fields match
 * nested children by bare name at any depth, and a declared type that disagrees with the entity
 * lands in typeMismatchFields rather than failedFields.
 */
class DataContractChildExtractionTest {

  /**
   * The receiver is a CALLS_REAL_METHODS mock, so every instance field on it is null: Mockito never
   * runs a constructor. That is safe only because these validators and extractors touch no instance
   * state, verified 2026-09-11: they read their arguments and call the static Entity.getEntity,
   * nothing else. If a future edit makes one of them read a field such as daoCollection, this
   * helper starts failing with a NullPointerException from inside production code, and the fix is
   * to construct a real repository or stub that collaborator, not to chase the NPE.
   */
  static Object invokePrivate(String methodName, Object... args) throws Exception {
    DataContractRepository repository =
        Mockito.mock(DataContractRepository.class, Mockito.CALLS_REAL_METHODS);
    Class<?>[] argTypes = new Class<?>[args.length];
    for (int i = 0; i < args.length; i++) {
      argTypes[i] = args[i].getClass();
    }
    Method method = findDeclaredMethod(methodName, argTypes);
    method.setAccessible(true);
    return method.invoke(repository, args);
  }

  /**
   * Matches by name AND parameter count/assignability, not name alone: DataContractRepository
   * declares more than one private validator, and matching by name only would pick whichever
   * overload the JVM happens to enumerate last.
   */
  static Method findDeclaredMethod(String methodName, Class<?>[] argTypes) throws Exception {
    Method match = null;
    for (Method candidate : DataContractRepository.class.getDeclaredMethods()) {
      if (candidate.getName().equals(methodName)
          && candidate.getParameterCount() == argTypes.length
          && parametersAreAssignable(candidate.getParameterTypes(), argTypes)) {
        match = candidate;
      }
    }
    if (match == null) {
      throw new NoSuchMethodException(
          methodName + " with " + argTypes.length + " parameter(s) of the given types");
    }
    return match;
  }

  static boolean parametersAreAssignable(Class<?>[] declared, Class<?>[] actual) {
    boolean assignable = true;
    for (int i = 0; i < declared.length && assignable; i++) {
      assignable = declared[i].isAssignableFrom(actual[i]);
    }
    return assignable;
  }

  /**
   * SchemaValidationResult is a private static class, so the test cannot name the type. Widening it
   * for the tests' benefit is forbidden (no production change whose only consumer is a test), so
   * its two fields are read reflectively instead.
   */
  @SuppressWarnings("unchecked")
  static List<String> failedFieldsOf(Object schemaValidationResult) throws Exception {
    return (List<String>) readListField(schemaValidationResult, "failedFields");
  }

  @SuppressWarnings("unchecked")
  static List<String> typeMismatchFieldsOf(Object schemaValidationResult) throws Exception {
    return (List<String>) readListField(schemaValidationResult, "typeMismatchFields");
  }

  static Object readListField(Object target, String fieldName) throws Exception {
    java.lang.reflect.Field field = target.getClass().getDeclaredField(fieldName);
    field.setAccessible(true);
    return field.get(target);
  }

  static DataContract contractWith(String... columnNames) {
    return new DataContract()
        .withSchema(Arrays.stream(columnNames).map(n -> new Column().withName(n)).toList());
  }

  static DataContract contractWithTyped(String columnName, ColumnDataType dataType) {
    return new DataContract()
        .withSchema(List.of(new Column().withName(columnName).withDataType(dataType)));
  }

  static EntityReference ref(String type) {
    return new EntityReference().withType(type).withId(UUID.randomUUID());
  }

  static Set<String> flattenNames(List<FieldInterface> fields) {
    Set<String> names = new HashSet<>();
    for (FieldInterface field : fields) {
      names.add(field.getName());
      if (field.getChildren() != null) {
        names.addAll(flattenNames((List<FieldInterface>) field.getChildren()));
      }
    }
    return names;
  }

  @SuppressWarnings("unchecked")
  @Test
  void topicValidation_agreesWithDirectRegistryExtraction() throws Exception {
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("customer")
                                .withChildren(List.of(new Field().withName("id"))))));
    DataContract contract = contractWith("customer", "id", "ghost");
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TOPIC), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(topic);
      List<String> viaValidator =
          failedFieldsOf(invokePrivate("validateFieldsAgainstEntity", contract, ref(Entity.TOPIC)));
      Set<String> names = flattenNames(ChildFieldResolver.childrenOf(topic, Entity.TOPIC));
      List<String> viaExtraction =
          contract.getSchema().stream()
              .map(Column::getName)
              .filter(name -> !names.contains(name))
              .toList();
      assertEquals(viaValidator, viaExtraction);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void apiEndpointValidation_agreesWithUnionOfBothSchemas() throws Exception {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("payload"))))
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("status"))));
    DataContract contract = contractWith("payload", "status", "ghost");
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.API_ENDPOINT), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(endpoint);
      List<String> viaValidator =
          failedFieldsOf(
              invokePrivate("validateFieldsAgainstEntity", contract, ref(Entity.API_ENDPOINT)));
      Set<String> names =
          flattenNames(ChildFieldResolver.childrenOf(endpoint, Entity.API_ENDPOINT));
      List<String> viaExtraction =
          contract.getSchema().stream()
              .map(Column::getName)
              .filter(name -> !names.contains(name))
              .toList();
      assertEquals(viaValidator, viaExtraction);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void topic_nestedFieldNamesMatchByBareName() throws Exception {
    Topic topic =
        new Topic()
            .withMessageSchema(
                new MessageSchema()
                    .withSchemaFields(
                        List.of(
                            new Field()
                                .withName("customer")
                                .withChildren(List.of(new Field().withName("id"))))));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TOPIC), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(topic);
      List<String> failed =
          failedFieldsOf(
              invokePrivate(
                  "validateFieldsAgainstEntity",
                  contractWith("customer", "id", "ghost"),
                  ref(Entity.TOPIC)));
      assertEquals(List.of("ghost"), failed);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void topic_emptySchema_allContractFieldsFail() throws Exception {
    Topic topic = new Topic().withMessageSchema(new MessageSchema().withSchemaFields(List.of()));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TOPIC), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(topic);
      List<String> failed =
          failedFieldsOf(
              invokePrivate(
                  "validateFieldsAgainstEntity", contractWith("a", "b"), ref(Entity.TOPIC)));
      assertEquals(List.of("a", "b"), failed);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void apiEndpoint_requestAndResponseSchemasAreUnioned() throws Exception {
    APIEndpoint endpoint =
        new APIEndpoint()
            .withRequestSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("payload"))))
            .withResponseSchema(
                new APISchema().withSchemaFields(List.of(new Field().withName("status"))));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.API_ENDPOINT), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(endpoint);
      List<String> failed =
          failedFieldsOf(
              invokePrivate(
                  "validateFieldsAgainstEntity",
                  contractWith("payload", "status", "ghost"),
                  ref(Entity.API_ENDPOINT)));
      assertEquals(List.of("ghost"), failed);
    }
  }

  @SuppressWarnings("unchecked")
  @Test
  void apiEndpoint_bothSchemasNull_allContractFieldsFail() throws Exception {
    APIEndpoint endpoint = new APIEndpoint();
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.API_ENDPOINT), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(endpoint);
      List<String> failed =
          failedFieldsOf(
              invokePrivate(
                  "validateFieldsAgainstEntity", contractWith("a", "b"), ref(Entity.API_ENDPOINT)));
      assertEquals(List.of("a", "b"), failed);
    }
  }

  @Test
  void table_missingColumnLandsInFailedFields_nestedStructMatchesByBareName() throws Exception {
    Table table =
        new Table()
            .withColumns(
                List.of(
                    new Column()
                        .withName("profile")
                        .withDataType(ColumnDataType.STRUCT)
                        .withChildren(
                            List.of(
                                new Column()
                                    .withName("full_name")
                                    .withDataType(ColumnDataType.STRING)))));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(table);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity",
              contractWith("profile", "full_name", "ghost"),
              ref(Entity.TABLE));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
      assertEquals(List.of(), typeMismatchFieldsOf(result));
    }
  }

  @Test
  void table_dataTypeMismatchLandsInTypeMismatchFieldsNotFailedFields() throws Exception {
    Table table =
        new Table()
            .withColumns(List.of(new Column().withName("id").withDataType(ColumnDataType.STRING)));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(table);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity",
              contractWithTyped("id", ColumnDataType.INT),
              ref(Entity.TABLE));
      assertEquals(List.of(), failedFieldsOf(result));
      // The message names the entity's type first, then the contract's.
      assertEquals(List.of("id: expected STRING, got INT"), typeMismatchFieldsOf(result));
    }
  }

  @Test
  void table_emptyColumns_allContractFieldsFail() throws Exception {
    Table table = new Table().withColumns(List.of());
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.TABLE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(table);
      Object result =
          invokePrivate("validateFieldsAgainstEntity", contractWith("a", "b"), ref(Entity.TABLE));
      assertEquals(List.of("a", "b"), failedFieldsOf(result));
      assertEquals(List.of(), typeMismatchFieldsOf(result));
    }
  }

  // New coverage. These five types had no schema validation before the consolidation: the old
  // switch had arms for table, topic, apiEndpoint and dashboardDataModel only, and everything else
  // fell through to a no-op default. They validate by name now because the registry knows their
  // child collections.

  @Test
  void searchIndex_fieldsNowValidated() throws Exception {
    SearchIndex searchIndex =
        new SearchIndex().withFields(List.of(new SearchIndexField().withName("f1")));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.SEARCH_INDEX), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(searchIndex);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity", contractWith("f1", "ghost"), ref(Entity.SEARCH_INDEX));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
    }
  }

  @Test
  void pipeline_taskNamesNowValidated() throws Exception {
    Pipeline pipeline = new Pipeline().withTasks(List.of(new Task().withName("t1")));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.PIPELINE), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(pipeline);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity", contractWith("t1", "ghost"), ref(Entity.PIPELINE));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
    }
  }

  @Test
  void container_dataModelColumnsNowValidated() throws Exception {
    Container container =
        new Container()
            .withDataModel(
                new ContainerDataModel().withColumns(List.of(new Column().withName("c1"))));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.CONTAINER), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(container);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity", contractWith("c1", "ghost"), ref(Entity.CONTAINER));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
    }
  }

  @Test
  void mlmodel_featureNamesNowValidated() throws Exception {
    MlModel model = new MlModel().withMlFeatures(List.of(new MlFeature().withName("age")));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.MLMODEL), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(model);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity", contractWith("age", "ghost"), ref(Entity.MLMODEL));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
    }
  }

  @Test
  void worksheet_columnsNowValidated() throws Exception {
    Worksheet worksheet = new Worksheet().withColumns(List.of(new Column().withName("row_id")));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.WORKSHEET), any(UUID.class), anyString(), any(Include.class)))
          .thenReturn(worksheet);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity",
              contractWith("row_id", "ghost"),
              ref(Entity.WORKSHEET));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
    }
  }

  @Test
  void dashboardDataModel_missingColumnLandsInFailedFields() throws Exception {
    DashboardDataModel dataModel =
        new DashboardDataModel()
            .withColumns(
                List.of(new Column().withName("revenue").withDataType(ColumnDataType.DOUBLE)));
    try (MockedStatic<Entity> mocked = Mockito.mockStatic(Entity.class)) {
      mocked
          .when(
              () ->
                  Entity.getEntity(
                      eq(Entity.DASHBOARD_DATA_MODEL),
                      any(UUID.class),
                      anyString(),
                      any(Include.class)))
          .thenReturn(dataModel);
      Object result =
          invokePrivate(
              "validateFieldsAgainstEntity",
              contractWith("revenue", "ghost"),
              ref(Entity.DASHBOARD_DATA_MODEL));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
      assertEquals(List.of(), typeMismatchFieldsOf(result));
    }
  }
}
