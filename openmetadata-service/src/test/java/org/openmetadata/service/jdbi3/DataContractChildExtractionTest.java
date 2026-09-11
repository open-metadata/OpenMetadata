package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;

import java.lang.reflect.Method;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.mockito.MockedStatic;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.data.APIEndpoint;
import org.openmetadata.schema.entity.data.DashboardDataModel;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.data.Table;
import org.openmetadata.schema.entity.data.Topic;
import org.openmetadata.schema.type.APISchema;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.MessageSchema;
import org.openmetadata.service.Entity;

/**
 * Characterization tests pinning the DataContract schema validators against the pre-consolidation
 * implementation. They record two behaviors Task 12 must preserve: contract fields match nested
 * children by bare name (buildColumnMap flattens recursively), and a declared type that disagrees
 * with the entity lands in typeMismatchFields rather than failedFields.
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
          (List<String>)
              invokePrivate(
                  "validateFieldsAgainstTopic",
                  contractWith("customer", "id", "ghost"),
                  ref(Entity.TOPIC));
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
          (List<String>)
              invokePrivate(
                  "validateFieldsAgainstTopic", contractWith("a", "b"), ref(Entity.TOPIC));
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
          (List<String>)
              invokePrivate(
                  "validateFieldsAgainstApiEndpoint",
                  contractWith("payload", "status", "ghost"),
                  ref(Entity.API_ENDPOINT));
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
          (List<String>)
              invokePrivate(
                  "validateFieldsAgainstApiEndpoint",
                  contractWith("a", "b"),
                  ref(Entity.API_ENDPOINT));
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
              "validateFieldsAgainstTable",
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
              "validateFieldsAgainstTable",
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
          invokePrivate("validateFieldsAgainstTable", contractWith("a", "b"), ref(Entity.TABLE));
      assertEquals(List.of("a", "b"), failedFieldsOf(result));
      assertEquals(List.of(), typeMismatchFieldsOf(result));
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
              "validateFieldsAgainstDashboardDataModel",
              contractWith("revenue", "ghost"),
              ref(Entity.DASHBOARD_DATA_MODEL));
      assertEquals(List.of("ghost"), failedFieldsOf(result));
      assertEquals(List.of(), typeMismatchFieldsOf(result));
    }
  }
}
