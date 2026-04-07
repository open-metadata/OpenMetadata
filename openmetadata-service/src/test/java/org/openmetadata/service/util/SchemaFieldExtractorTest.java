package org.openmetadata.service.util;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

import jakarta.ws.rs.core.UriInfo;
import java.io.InputStream;
import java.lang.reflect.Constructor;
import java.lang.reflect.Field;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.everit.json.schema.ArraySchema;
import org.everit.json.schema.BooleanSchema;
import org.everit.json.schema.NullSchema;
import org.everit.json.schema.NumberSchema;
import org.everit.json.schema.ObjectSchema;
import org.everit.json.schema.Schema;
import org.everit.json.schema.StringSchema;
import org.everit.json.schema.loader.SchemaClient;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.sdk.exception.SchemaProcessingException;
import org.openmetadata.service.jdbi3.TypeRepository;

class SchemaFieldExtractorTest {

  @Test
  void getAllEntityTypesIncludesNewSchemaDirectories() {
    List<String> entityTypes = SchemaFieldExtractor.getAllEntityTypes();

    assertTrue(entityTypes.contains("table"));
    assertTrue(entityTypes.contains("dataContract"));
    assertTrue(entityTypes.contains("learningResource"));
    assertTrue(entityTypes.contains("aiApplication"));
  }

  @Test
  void extractFieldsSupportsLearningAndAiSchemas() throws Throwable {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();

    Map<String, SchemaFieldExtractor.FieldDefinition> learningFields =
        toMap(extractor.extractFields(new Type(), "learningResource"));
    Map<String, SchemaFieldExtractor.FieldDefinition> aiFields =
        toMap(extractor.extractFields(new Type(), "aiApplication"));

    assertEquals("string", learningFields.get("source.provider").getType());
    assertEquals("string", learningFields.get("source.url").getType());
    assertEquals("array<resourceCategory>", learningFields.get("categories").getType());
    assertEquals("applicationType", aiFields.get("applicationType").getType());
    assertEquals("developmentStage", aiFields.get("developmentStage").getType());
    assertEquals("array<modelConfiguration>", aiFields.get("modelConfigurations").getType());

    Map<String, Map<String, SchemaFieldExtractor.FieldDefinition>> entityFieldsCache =
        entityFieldsCache();
    assertTrue(entityFieldsCache.containsKey("learningResource"));
    assertTrue(entityFieldsCache.containsKey("aiApplication"));
  }

  @Test
  void extractFieldsPreservesSpecialDefinitionNames() {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();

    Map<String, SchemaFieldExtractor.FieldDefinition> tableFields =
        toMap(extractor.extractFields(new Type(), "table"));
    Map<String, SchemaFieldExtractor.FieldDefinition> dataContractFields =
        toMap(extractor.extractFields(new Type(), "dataContract"));

    assertEquals("impersonatedBy", tableFields.get("impersonatedBy").getType());
    assertEquals("array<semanticsRule>", dataContractFields.get("semantics").getType());
    assertEquals("string", dataContractFields.get("semantics.rule").getType());
  }

  @Test
  void extractFieldsAddsCustomPropertiesWithReferenceTypesAndConfig() {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();
    CustomPropertyConfig notesConfig =
        new CustomPropertyConfig().withConfig(Map.of("format", "md"));
    Type type =
        new Type()
            .withCustomProperties(
                List.of(
                    customProperty("ownerCustom", "Owner Custom", "entityReference", null),
                    customProperty(
                        "reviewersCustom", "Reviewers Custom", "entityReferenceList", null),
                    customProperty("notesCustom", "Notes Custom", "markdown", notesConfig)));

    Map<String, SchemaFieldExtractor.FieldDefinition> fields =
        toMap(extractor.extractFields(type, "table"));

    assertEquals("entityReference", fields.get("ownerCustom").getType());
    assertEquals("array<entityReference>", fields.get("reviewersCustom").getType());
    assertEquals("markdown", fields.get("notesCustom").getType());
    assertEquals("Owner Custom", fields.get("ownerCustom").getDisplayName());
    assertSame(notesConfig, fields.get("notesCustom").getCustomPropertyConfig());
  }

  @Test
  void extractAllCustomPropertiesDelegatesToRepository() {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();
    TypeRepository repository = mock(TypeRepository.class);
    UriInfo uriInfo = mock(UriInfo.class);
    Type entityType =
        new Type()
            .withCustomProperties(
                List.of(customProperty("extraField", "Extra Field", "string", null)));

    when(repository.getByName(eq(uriInfo), anyString(), any(), eq(Include.ALL), eq(false)))
        .thenAnswer(
            invocation -> "table".equals(invocation.getArgument(1)) ? entityType : new Type());

    Map<String, List<SchemaFieldExtractor.FieldDefinition>> customProperties =
        extractor.extractAllCustomProperties(uriInfo, repository);

    assertTrue(customProperties.containsKey("table"));
    assertEquals("string", toMap(customProperties.get("table")).get("extraField").getType());
  }

  @Test
  void determineReferenceTypeRecognizesNewDefinitions() throws Throwable {
    Map<String, String> expectedMappings =
        Map.ofEntries(
            Map.entry("../../type/basic.json#/definitions/duration", "duration"),
            Map.entry("../../type/basic.json#/definitions/markdown", "markdown"),
            Map.entry("../../type/basic.json#/definitions/timestamp", "timestamp"),
            Map.entry("../../type/basic.json#/definitions/integer", "integer"),
            Map.entry("../../type/basic.json#/definitions/number", "number"),
            Map.entry("../../type/basic.json#/definitions/string", "string"),
            Map.entry("../../type/basic.json#/definitions/uuid", "uuid"),
            Map.entry("../../type/basic.json#/definitions/email", "email"),
            Map.entry("../../type/basic.json#/definitions/href", "href"),
            Map.entry("../../type/basic.json#/definitions/timeInterval", "timeInterval"),
            Map.entry("../../type/basic.json#/definitions/date", "date"),
            Map.entry("../../type/basic.json#/definitions/impersonatedBy", "impersonatedBy"),
            Map.entry("../../type/basic.json#/definitions/dateTime", "dateTime"),
            Map.entry("../../type/basic.json#/definitions/time", "time"),
            Map.entry("../../type/basic.json#/definitions/date-cp", "date-cp"),
            Map.entry("../../type/basic.json#/definitions/dateTime-cp", "dateTime-cp"),
            Map.entry("../../type/basic.json#/definitions/time-cp", "time-cp"),
            Map.entry("../../type/basic.json#/definitions/enum", "enum"),
            Map.entry(
                "../../type/basic.json#/definitions/enumWithDescriptions", "enumWithDescriptions"),
            Map.entry("../../type/basic.json#/definitions/timezone", "timezone"),
            Map.entry("../../type/basic.json#/definitions/entityLink", "entityLink"),
            Map.entry("../../type/basic.json#/definitions/entityName", "entityName"),
            Map.entry(
                "../../type/basic.json#/definitions/testCaseEntityName", "testCaseEntityName"),
            Map.entry(
                "../../type/basic.json#/definitions/fullyQualifiedEntityName",
                "fullyQualifiedEntityName"),
            Map.entry("../../type/basic.json#/definitions/sqlQuery", "sqlQuery"),
            Map.entry("../../type/basic.json#/definitions/sqlFunction", "sqlFunction"),
            Map.entry("../../type/basic.json#/definitions/expression", "expression"),
            Map.entry("../../type/basic.json#/definitions/jsonSchema", "jsonSchema"),
            Map.entry("../../type/basic.json#/definitions/entityExtension", "entityExtension"),
            Map.entry("../../type/basic.json#/definitions/providerType", "providerType"),
            Map.entry("../../type/basic.json#/definitions/componentConfig", "componentConfig"),
            Map.entry("../../type/basic.json#/definitions/semanticsRule", "semanticsRule"),
            Map.entry("../../type/basic.json#/definitions/status", "status"),
            Map.entry("../../type/basic.json#/definitions/sourceUrl", "sourceUrl"),
            Map.entry("../../type/basic.json#/definitions/style", "style"),
            Map.entry("../../type/entityReference.json", "entityReference"),
            Map.entry("../../type/entityReferenceList.json", "array<entityReference>"),
            Map.entry("../../type/tagLabel.json", "tagLabel"),
            Map.entry("../../type/entityVersion.json", "entityVersion"));

    for (Map.Entry<String, String> expectedMapping : expectedMappings.entrySet()) {
      assertEquals(
          expectedMapping.getValue(),
          invokePrivateStatic(
              "determineReferenceType", new Class<?>[] {String.class}, expectedMapping.getKey()));
    }

    assertNull(
        invokePrivateStatic(
            "determineReferenceType", new Class<?>[] {String.class}, "../../type/notMapped.json"));
  }

  @Test
  void resolveSchemaByTypeReturnsSchemaForKnownTypes() throws Throwable {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();
    SchemaClient schemaClient =
        customSchemaClient("classpath:///json/schema/type/entityReference.json");

    assertNotNull(
        invokePrivate(
            extractor,
            "resolveSchemaByType",
            new Class<?>[] {String.class, String.class, SchemaClient.class},
            "entityReference",
            "classpath:///json/schema/type/entityReference.json",
            schemaClient));
    assertNull(
        invokePrivate(
            extractor,
            "resolveSchemaByType",
            new Class<?>[] {String.class, String.class, SchemaClient.class},
            "missingType",
            "classpath:///json/schema/type/missingType.json",
            schemaClient));
  }

  @Test
  void mapSchemaTypeToSimpleTypeHandlesSupportedVariants() throws Throwable {
    NumberSchema integerSchema = mock(NumberSchema.class);
    NumberSchema numberSchema = mock(NumberSchema.class);
    when(integerSchema.requiresInteger()).thenReturn(true);
    when(numberSchema.requiresInteger()).thenReturn(false);

    assertEquals(
        "object",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, new Object[] {null}));
    assertEquals(
        "string",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(StringSchema.class)));
    assertEquals(
        "integer",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, integerSchema));
    assertEquals(
        "number",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, numberSchema));
    assertEquals(
        "boolean",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(BooleanSchema.class)));
    assertEquals(
        "object",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(ObjectSchema.class)));
    assertEquals(
        "array",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(ArraySchema.class)));
    assertEquals(
        "null",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(NullSchema.class)));
    assertEquals(
        "string",
        invokePrivateStatic(
            "mapSchemaTypeToSimpleType", new Class<?>[] {Schema.class}, mock(Schema.class)));
  }

  @Test
  void customSchemaClientLoadsOpenMetadataResourcesAndRejectsUnsupportedUrls() throws Throwable {
    SchemaClient schemaClient =
        customSchemaClient("classpath:///json/schema/entity/data/table.json");

    try (InputStream inputStream =
        schemaClient.get("https://open-metadata.org/schema/type/entityReference.json")) {
      assertNotNull(inputStream);
      assertTrue(inputStream.readAllBytes().length > 0);
    }

    assertThrows(
        RuntimeException.class, () -> schemaClient.get("https://example.com/entityReference.json"));
  }

  @Test
  void loadSchemaThrowsForMissingResources() throws Throwable {
    SchemaFieldExtractor extractor = new SchemaFieldExtractor();
    SchemaClient schemaClient =
        customSchemaClient("classpath:///json/schema/entity/data/table.json");

    assertThrows(
        SchemaProcessingException.class,
        () ->
            invokePrivate(
                extractor,
                "loadSchema",
                new Class<?>[] {String.class, String.class, SchemaClient.class},
                "json/schema/entity/data/missing.json",
                "classpath:///json/schema/entity/data/missing.json",
                schemaClient));
  }

  @Test
  void loadMainSchemaLoadsKnownEntities() throws Throwable {
    SchemaClient schemaClient =
        customSchemaClient("classpath:///json/schema/entity/data/table.json");

    assertNotNull(
        invokePrivateStatic(
            "loadMainSchema",
            new Class<?>[] {String.class, String.class, String.class, SchemaClient.class},
            "json/schema/entity/data/table.json",
            "table",
            "classpath:///json/schema/entity/data/table.json",
            schemaClient));
  }

  private static CustomProperty customProperty(
      String name, String displayName, String propertyTypeName, CustomPropertyConfig config) {
    return new CustomProperty()
        .withName(name)
        .withDisplayName(displayName)
        .withPropertyType(new EntityReference().withName(propertyTypeName))
        .withCustomPropertyConfig(config);
  }

  private static Map<String, SchemaFieldExtractor.FieldDefinition> toMap(
      List<SchemaFieldExtractor.FieldDefinition> fields) {
    return fields.stream()
        .collect(
            Collectors.toMap(
                SchemaFieldExtractor.FieldDefinition::getName,
                field -> field,
                (left, right) -> left,
                LinkedHashMap::new));
  }

  @SuppressWarnings("unchecked")
  private static Map<String, Map<String, SchemaFieldExtractor.FieldDefinition>> entityFieldsCache()
      throws Exception {
    Field cacheField = SchemaFieldExtractor.class.getDeclaredField("entityFieldsCache");
    cacheField.setAccessible(true);
    return (Map<String, Map<String, SchemaFieldExtractor.FieldDefinition>>) cacheField.get(null);
  }

  private static Object invokePrivateStatic(
      String methodName, Class<?>[] parameterTypes, Object... args) throws Throwable {
    Method method = SchemaFieldExtractor.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return method.invoke(null, args);
    } catch (InvocationTargetException e) {
      throw e.getCause();
    }
  }

  private static Object invokePrivate(
      Object target, String methodName, Class<?>[] parameterTypes, Object... args)
      throws Throwable {
    Method method = SchemaFieldExtractor.class.getDeclaredMethod(methodName, parameterTypes);
    method.setAccessible(true);
    try {
      return method.invoke(target, args);
    } catch (InvocationTargetException e) {
      throw e.getCause();
    }
  }

  private static SchemaClient customSchemaClient(String baseUri) throws Exception {
    Class<?> customSchemaClientClass =
        Class.forName("org.openmetadata.service.util.SchemaFieldExtractor$CustomSchemaClient");
    Constructor<?> constructor = customSchemaClientClass.getDeclaredConstructor(String.class);
    constructor.setAccessible(true);
    return (SchemaClient) constructor.newInstance(baseUri);
  }
}
