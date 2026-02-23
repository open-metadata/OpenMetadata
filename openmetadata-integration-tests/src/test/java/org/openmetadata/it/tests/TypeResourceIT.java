package org.openmetadata.it.tests;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Disabled;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.parallel.Execution;
import org.junit.jupiter.api.parallel.ExecutionMode;
import org.openmetadata.it.util.SdkClients;
import org.openmetadata.it.util.TestNamespace;
import org.openmetadata.it.util.TestNamespaceExtension;
import org.openmetadata.schema.api.CreateType;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.CustomPropertyConfig;
import org.openmetadata.schema.type.customProperties.EnumConfig;
import org.openmetadata.sdk.client.OpenMetadataClient;
import org.openmetadata.sdk.network.HttpMethod;

/**
 * Integration tests for Type entity operations.
 *
 * <p>Tests type operations including: - Creating custom types (property types) - Retrieving types
 * by name and ID - Listing all types - Adding custom properties to entity types - Type schema
 * validation - Enum type configuration - Custom property validation
 *
 * <p>Test isolation: Uses TestNamespace for unique entity names Parallelization: Safe for
 * concurrent execution via @Execution(ExecutionMode.CONCURRENT)
 *
 * <p>Migrated from: org.openmetadata.service.resources.metadata.TypeResourceTest
 */
@Execution(ExecutionMode.CONCURRENT)
@ExtendWith(TestNamespaceExtension.class)
public class TypeResourceIT {

  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();
  private static Type INT_TYPE;
  private static Type STRING_TYPE;
  private static Type ENUM_TYPE;
  private static Type HYPERLINK_TYPE;
  private static Type TOPIC_ENTITY_TYPE;
  private static Type TABLE_ENTITY_TYPE;
  private static Type CONTAINER_ENTITY_TYPE;
  private static Type TABLE_COLUMN_ENTITY_TYPE;
  private static Type DASHBOARD_DATA_MODEL_COLUMN_ENTITY_TYPE;

  @BeforeAll
  static void setupTypes() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    INT_TYPE = getTypeByName(client, "integer");
    STRING_TYPE = getTypeByName(client, "string");
    ENUM_TYPE = getTypeByName(client, "enum");
    HYPERLINK_TYPE = getTypeByName(client, "hyperlink-cp");
    TOPIC_ENTITY_TYPE = getTypeByName(client, "topic");
    TABLE_ENTITY_TYPE = getTypeByName(client, "table");
    CONTAINER_ENTITY_TYPE = getTypeByName(client, "container");
    TABLE_COLUMN_ENTITY_TYPE = getTypeByName(client, "tableColumn");
    DASHBOARD_DATA_MODEL_COLUMN_ENTITY_TYPE = getTypeByName(client, "dashboardDataModelColumn");
  }

  @Test
  void test_createCustomType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String typeName = ns.prefix("customType");
    CreateType createRequest = new CreateType();
    createRequest.setName(typeName);
    createRequest.setCategory(Category.Field);
    createRequest.setDescription("Custom type for integration testing");
    createRequest.setSchema(INT_TYPE.getSchema());

    Type createdType = createType(client, createRequest);

    assertNotNull(createdType);
    assertNotNull(createdType.getId());
    assertEquals(typeName, createdType.getName());
    assertEquals(Category.Field, createdType.getCategory());
    assertEquals("Custom type for integration testing", createdType.getDescription());
    assertEquals(INT_TYPE.getSchema(), createdType.getSchema());
  }

  @Test
  void test_getTypeById() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type intType = getTypeById(client, INT_TYPE.getId());

    assertNotNull(intType);
    assertEquals(INT_TYPE.getId(), intType.getId());
    assertEquals("integer", intType.getName());
    assertEquals(Category.Field, intType.getCategory());
  }

  @Test
  void test_getTypeByName() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type stringType = getTypeByName(client, "string");

    assertNotNull(stringType);
    assertEquals("string", stringType.getName());
    assertEquals(Category.Field, stringType.getCategory());
  }

  @Test
  @Disabled("Type list pagination may not include all types - needs investigation")
  void test_listTypes() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    TypeList types = listTypes(client);

    assertNotNull(types);
    assertNotNull(types.getData());
    assertFalse(types.getData().isEmpty());

    boolean hasIntegerType = types.getData().stream().anyMatch(t -> "integer".equals(t.getName()));
    assertTrue(hasIntegerType, "Type list should contain 'integer' type");

    boolean hasStringType = types.getData().stream().anyMatch(t -> "string".equals(t.getName()));
    assertTrue(hasStringType, "Type list should contain 'string' type");
  }

  @Test
  void test_listTypesByCategory() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    TypeList fieldTypes = listTypesByCategory(client, Category.Field);

    assertNotNull(fieldTypes);
    assertNotNull(fieldTypes.getData());
    assertFalse(fieldTypes.getData().isEmpty());

    boolean allFieldCategory =
        fieldTypes.getData().stream().allMatch(t -> Category.Field.equals(t.getCategory()));
    assertTrue(allFieldCategory, "All types should be of category Field");
  }

  @Test
  void test_addCustomPropertyToEntityType(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type topicType = getTypeByName(client, "topic");

    String propertyName = ns.prefix("customProp");
    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setDescription("Custom property for integration testing");
    customProperty.setPropertyType(INT_TYPE.getEntityReference());

    Type updatedType = addCustomProperty(client, topicType.getId(), customProperty);

    assertNotNull(updatedType);
    assertNotNull(updatedType.getCustomProperties());

    boolean hasCustomProperty =
        updatedType.getCustomProperties().stream()
            .anyMatch(cp -> propertyName.equals(cp.getName()));
    assertTrue(hasCustomProperty, "Topic type should have the new custom property");

    CustomProperty addedProperty =
        updatedType.getCustomProperties().stream()
            .filter(cp -> propertyName.equals(cp.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(addedProperty);
    assertEquals(propertyName, addedProperty.getName());
    assertEquals("Custom property for integration testing", addedProperty.getDescription());
    assertEquals(INT_TYPE.getId(), addedProperty.getPropertyType().getId());
  }

  @Test
  void test_addEnumCustomProperty(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type tableType = getTypeByName(client, "table");

    String propertyName = ns.prefix("enumProp");
    CustomProperty enumProperty = new CustomProperty();
    enumProperty.setName(propertyName);
    enumProperty.setDescription("Enum custom property for testing");
    enumProperty.setPropertyType(ENUM_TYPE.getEntityReference());

    EnumConfig enumConfig = new EnumConfig();
    enumConfig.setValues(List.of("Option1", "Option2", "Option3"));

    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(enumConfig);
    enumProperty.setCustomPropertyConfig(config);

    Type updatedType = addCustomProperty(client, tableType.getId(), enumProperty);

    assertNotNull(updatedType);
    assertNotNull(updatedType.getCustomProperties());

    CustomProperty addedProperty =
        updatedType.getCustomProperties().stream()
            .filter(cp -> propertyName.equals(cp.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(addedProperty);
    assertEquals(propertyName, addedProperty.getName());
    assertNotNull(addedProperty.getCustomPropertyConfig());
  }

  @Test
  void test_addEnumCustomPropertyWithoutConfig_fails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String propertyName = ns.prefix("invalidEnumProp");
    CustomProperty enumProperty = new CustomProperty();
    enumProperty.setName(propertyName);
    enumProperty.setDescription("Enum property without config");
    enumProperty.setPropertyType(ENUM_TYPE.getEntityReference());

    assertThrows(
        Exception.class,
        () -> addCustomProperty(client, TABLE_ENTITY_TYPE.getId(), enumProperty),
        "Adding enum custom property without config should fail");
  }

  @Test
  void test_addEnumCustomPropertyWithDuplicateValues_fails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String propertyName = ns.prefix("dupEnumProp");
    CustomProperty enumProperty = new CustomProperty();
    enumProperty.setName(propertyName);
    enumProperty.setDescription("Enum property with duplicate values");
    enumProperty.setPropertyType(ENUM_TYPE.getEntityReference());

    EnumConfig enumConfig = new EnumConfig();
    enumConfig.setValues(List.of("A", "B", "C", "A"));

    CustomPropertyConfig config = new CustomPropertyConfig();
    config.setConfig(enumConfig);
    enumProperty.setCustomPropertyConfig(config);

    assertThrows(
        Exception.class,
        () -> addCustomProperty(client, TABLE_ENTITY_TYPE.getId(), enumProperty),
        "Adding enum custom property with duplicate values should fail");
  }

  @Test
  void test_updateCustomPropertyDescription(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type topicType = getTypeByName(client, "topic");

    String propertyName = ns.prefix("updateDescProp");
    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setDescription("Initial description");
    customProperty.setPropertyType(STRING_TYPE.getEntityReference());

    Type typeWithProperty = addCustomProperty(client, topicType.getId(), customProperty);

    customProperty.setDescription("Updated description");
    Type updatedType = addCustomProperty(client, typeWithProperty.getId(), customProperty);

    CustomProperty updatedProperty =
        updatedType.getCustomProperties().stream()
            .filter(cp -> propertyName.equals(cp.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(updatedProperty);
    assertEquals("Updated description", updatedProperty.getDescription());
  }

  @Test
  void test_addCustomPropertyToPropertyType_fails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String propertyName = ns.prefix("invalidProp");
    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setDescription("Property on property type");
    customProperty.setPropertyType(INT_TYPE.getEntityReference());

    assertThrows(
        Exception.class,
        () -> addCustomProperty(client, INT_TYPE.getId(), customProperty),
        "Adding custom property to property type should fail");
  }

  @Test
  void test_typeWithInvalidName_fails(TestNamespace ns) {
    OpenMetadataClient client = SdkClients.adminClient();

    String[] invalidNames = {"Invalid Name", "invalid-name", "invalid'name"};

    for (String invalidName : invalidNames) {
      CreateType createRequest = new CreateType();
      createRequest.setName(invalidName);
      createRequest.setCategory(Category.Field);
      createRequest.setDescription("Type with invalid name");
      createRequest.setSchema(INT_TYPE.getSchema());

      assertThrows(
          Exception.class,
          () -> createType(client, createRequest),
          "Creating type with invalid name '" + invalidName + "' should fail");
    }
  }

  @Test
  void test_getEntityTypeFields() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    List<Map<String, Object>> tableFields = getEntityTypeFields(client, "table");

    assertNotNull(tableFields);
    assertFalse(tableFields.isEmpty());

    boolean hasNameField = tableFields.stream().anyMatch(f -> "name".equals(f.get("name")));
    assertTrue(hasNameField, "Table entity should have 'name' field");

    boolean hasColumnsField = tableFields.stream().anyMatch(f -> "columns".equals(f.get("name")));
    assertTrue(hasColumnsField, "Table entity should have 'columns' field");

    Map<String, Object> columnsField =
        tableFields.stream().filter(f -> "columns".equals(f.get("name"))).findFirst().orElse(null);

    assertNotNull(columnsField);
    assertEquals(
        "array<column>", columnsField.get("type"), "columns field should be of type array<column>");
  }

  @Test
  void test_getClassificationEntityFields() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    List<Map<String, Object>> classificationFields = getEntityTypeFields(client, "classification");

    assertNotNull(classificationFields);
    assertFalse(classificationFields.isEmpty());

    boolean hasName = classificationFields.stream().anyMatch(f -> "name".equals(f.get("name")));
    assertTrue(hasName, "Classification should have 'name' field");

    boolean hasDescription =
        classificationFields.stream().anyMatch(f -> "description".equals(f.get("name")));
    assertTrue(hasDescription, "Classification should have 'description' field");

    boolean hasMutuallyExclusive =
        classificationFields.stream().anyMatch(f -> "mutuallyExclusive".equals(f.get("name")));
    assertTrue(hasMutuallyExclusive, "Classification should have 'mutuallyExclusive' field");
  }

  @Test
  void test_getTagEntityFields() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    List<Map<String, Object>> tagFields = getEntityTypeFields(client, "tag");

    assertNotNull(tagFields);
    assertFalse(tagFields.isEmpty());

    boolean hasName = tagFields.stream().anyMatch(f -> "name".equals(f.get("name")));
    assertTrue(hasName, "Tag should have 'name' field");

    boolean hasClassification =
        tagFields.stream().anyMatch(f -> "classification".equals(f.get("name")));
    assertTrue(hasClassification, "Tag should have 'classification' field");

    boolean hasParent = tagFields.stream().anyMatch(f -> "parent".equals(f.get("name")));
    assertTrue(hasParent, "Tag should have 'parent' field");
  }

  @Test
  void test_addMultipleCustomPropertiesToSameEntity(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type topicType = getTypeByName(client, "topic");

    String prop1Name = ns.prefix("multiProp1");
    CustomProperty prop1 = new CustomProperty();
    prop1.setName(prop1Name);
    prop1.setDescription("First property");
    prop1.setPropertyType(INT_TYPE.getEntityReference());

    Type typeWithProp1 = addCustomProperty(client, topicType.getId(), prop1);

    String prop2Name = ns.prefix("multiProp2");
    CustomProperty prop2 = new CustomProperty();
    prop2.setName(prop2Name);
    prop2.setDescription("Second property");
    prop2.setPropertyType(STRING_TYPE.getEntityReference());

    Type typeWithBothProps = addCustomProperty(client, typeWithProp1.getId(), prop2);

    assertNotNull(typeWithBothProps.getCustomProperties());
    assertTrue(typeWithBothProps.getCustomProperties().size() >= 2);

    boolean hasProp1 =
        typeWithBothProps.getCustomProperties().stream()
            .anyMatch(cp -> prop1Name.equals(cp.getName()));
    boolean hasProp2 =
        typeWithBothProps.getCustomProperties().stream()
            .anyMatch(cp -> prop2Name.equals(cp.getName()));

    assertTrue(hasProp1, "Type should have first custom property");
    assertTrue(hasProp2, "Type should have second custom property");
  }

  @Test
  void test_typeSchemaValidation(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String typeName = ns.prefix("schemaType");
    CreateType createRequest = new CreateType();
    createRequest.setName(typeName);
    createRequest.setCategory(Category.Field);
    createRequest.setDescription("Type with schema validation");
    createRequest.setSchema(STRING_TYPE.getSchema());

    Type createdType = createType(client, createRequest);

    assertNotNull(createdType.getSchema());
    assertEquals(STRING_TYPE.getSchema(), createdType.getSchema());
  }

  @Test
  void test_hyperlinkTypeExists() throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    Type hyperlinkType = getTypeByName(client, "hyperlink-cp");

    assertNotNull(hyperlinkType);
    assertEquals("hyperlink-cp", hyperlinkType.getName());
    assertEquals(Category.Field, hyperlinkType.getCategory());
    assertNotNull(hyperlinkType.getSchema());
  }

  @Test
  void test_addHyperlinkCustomProperty(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Add a hyperlink custom property - hyperlink-cp type doesn't require any config
    String propertyName = ns.prefix("hyperlinkProp");
    CustomProperty hyperlinkProperty = new CustomProperty();
    hyperlinkProperty.setName(propertyName);
    hyperlinkProperty.setDescription("Hyperlink custom property for integration testing");
    hyperlinkProperty.setPropertyType(HYPERLINK_TYPE.getEntityReference());
    hyperlinkProperty.setDisplayName("Test Hyperlink");

    Type updatedType = addCustomProperty(client, CONTAINER_ENTITY_TYPE.getId(), hyperlinkProperty);

    assertNotNull(updatedType);
    assertNotNull(updatedType.getCustomProperties());

    CustomProperty addedProperty =
        updatedType.getCustomProperties().stream()
            .filter(cp -> propertyName.equals(cp.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(addedProperty, "Container type should have the new hyperlink custom property");
    assertEquals(propertyName, addedProperty.getName());
    assertEquals(
        "Hyperlink custom property for integration testing", addedProperty.getDescription());
    assertEquals("Test Hyperlink", addedProperty.getDisplayName());
    assertEquals(HYPERLINK_TYPE.getId(), addedProperty.getPropertyType().getId());
  }

  @Test
  void test_updateHyperlinkCustomPropertyDescription(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // First, add the hyperlink custom property
    String propertyName = ns.prefix("hyperlinkUpdateProp");
    CustomProperty hyperlinkProperty = new CustomProperty();
    hyperlinkProperty.setName(propertyName);
    hyperlinkProperty.setDescription("Initial hyperlink description");
    hyperlinkProperty.setPropertyType(HYPERLINK_TYPE.getEntityReference());
    hyperlinkProperty.setDisplayName("Initial Display Name");

    Type typeWithProperty =
        addCustomProperty(client, CONTAINER_ENTITY_TYPE.getId(), hyperlinkProperty);

    // Update the description and displayName
    hyperlinkProperty.setDescription("Updated hyperlink description");
    hyperlinkProperty.setDisplayName("Updated Display Name");
    Type updatedType = addCustomProperty(client, typeWithProperty.getId(), hyperlinkProperty);

    CustomProperty updatedProperty =
        updatedType.getCustomProperties().stream()
            .filter(cp -> propertyName.equals(cp.getName()))
            .findFirst()
            .orElse(null);

    assertNotNull(updatedProperty);
    assertEquals("Updated hyperlink description", updatedProperty.getDescription());
    assertEquals("Updated Display Name", updatedProperty.getDisplayName());
  }

  @Test
  void test_addMultipleHyperlinkCustomProperties(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    // Add first hyperlink property
    String prop1Name = ns.prefix("hyperlinkMulti1");
    CustomProperty hyperlinkProp1 = new CustomProperty();
    hyperlinkProp1.setName(prop1Name);
    hyperlinkProp1.setDescription("First hyperlink property");
    hyperlinkProp1.setPropertyType(HYPERLINK_TYPE.getEntityReference());
    hyperlinkProp1.setDisplayName("Hyperlink 1");

    Type typeWithProp1 = addCustomProperty(client, CONTAINER_ENTITY_TYPE.getId(), hyperlinkProp1);

    // Add second hyperlink property
    String prop2Name = ns.prefix("hyperlinkMulti2");
    CustomProperty hyperlinkProp2 = new CustomProperty();
    hyperlinkProp2.setName(prop2Name);
    hyperlinkProp2.setDescription("Second hyperlink property");
    hyperlinkProp2.setPropertyType(HYPERLINK_TYPE.getEntityReference());
    hyperlinkProp2.setDisplayName("Hyperlink 2");

    Type typeWithBothProps = addCustomProperty(client, typeWithProp1.getId(), hyperlinkProp2);

    assertNotNull(typeWithBothProps.getCustomProperties());

    boolean hasProp1 =
        typeWithBothProps.getCustomProperties().stream()
            .anyMatch(cp -> prop1Name.equals(cp.getName()));
    boolean hasProp2 =
        typeWithBothProps.getCustomProperties().stream()
            .anyMatch(cp -> prop2Name.equals(cp.getName()));

    assertTrue(hasProp1, "Type should have first hyperlink custom property");
    assertTrue(hasProp2, "Type should have second hyperlink custom property");
  }

  @Test
  void test_concurrentCustomPropertyAdditions(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();
    Type pipelineType = getTypeByName(client, "pipeline");

    int threadCount = 5;
    List<CustomProperty> properties = new ArrayList<>();
    for (int i = 0; i < threadCount; i++) {
      CustomProperty prop = new CustomProperty();
      prop.setName(ns.prefix("concurrentProp" + i));
      prop.setDescription("Concurrent property " + i);
      prop.setPropertyType(STRING_TYPE.getEntityReference());
      properties.add(prop);
    }

    ExecutorService executor = Executors.newFixedThreadPool(threadCount);
    CountDownLatch startLatch = new CountDownLatch(1);
    CountDownLatch doneLatch = new CountDownLatch(threadCount);
    List<Exception> errors = new CopyOnWriteArrayList<>();

    for (CustomProperty prop : properties) {
      executor.submit(
          () -> {
            try {
              startLatch.await();
              addCustomProperty(client, pipelineType.getId(), prop);
            } catch (InterruptedException e) {
              Thread.currentThread().interrupt();
              errors.add(e);
            } catch (Exception e) {
              errors.add(e);
            } finally {
              doneLatch.countDown();
            }
          });
    }

    startLatch.countDown();
    assertTrue(doneLatch.await(30, TimeUnit.SECONDS), "All threads should complete within 30s");
    executor.shutdown();

    assertTrue(errors.isEmpty(), "Concurrent requests should not throw: " + errors);

    Type updatedType = getTypeByName(client, "pipeline", "customProperties");
    List<String> persistedNames =
        updatedType.getCustomProperties() != null
            ? updatedType.getCustomProperties().stream().map(CustomProperty::getName).toList()
            : List.of();

    for (CustomProperty prop : properties) {
      assertTrue(
          persistedNames.contains(prop.getName()),
          "Property '"
              + prop.getName()
              + "' was lost due to a concurrent update. Persisted: "
              + persistedNames);
    }
  }

  @Test
  void test_addCustomPropertyToTableColumn(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String propertyName = ns.prefix("tableColProp");
    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setDescription("Custom property for table column");
    customProperty.setPropertyType(STRING_TYPE.getEntityReference());

    Type updatedType = addCustomProperty(client, TABLE_COLUMN_ENTITY_TYPE.getId(), customProperty);

    assertNotNull(updatedType);
    assertNotNull(updatedType.getCustomProperties());

    boolean hasCustomProperty =
        updatedType.getCustomProperties().stream()
            .anyMatch(cp -> propertyName.equals(cp.getName()));
    assertTrue(hasCustomProperty, "tableColumn type should have the new custom property");
  }

  @Test
  void test_addCustomPropertyToDashboardDataModelColumn(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String propertyName = ns.prefix("dashColProp");
    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setDescription("Custom property for dashboard data model column");
    customProperty.setPropertyType(INT_TYPE.getEntityReference());

    Type updatedType =
        addCustomProperty(client, DASHBOARD_DATA_MODEL_COLUMN_ENTITY_TYPE.getId(), customProperty);

    assertNotNull(updatedType);
    assertNotNull(updatedType.getCustomProperties());

    boolean hasCustomProperty =
        updatedType.getCustomProperties().stream()
            .anyMatch(cp -> propertyName.equals(cp.getName()));
    assertTrue(
        hasCustomProperty, "dashboardDataModelColumn type should have the new custom property");
  }

  @Test
  void test_columnCustomPropertiesAreIsolated(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String tableColPropName = ns.prefix("isolatedTableColProp");
    CustomProperty tableColProp = new CustomProperty();
    tableColProp.setName(tableColPropName);
    tableColProp.setDescription("Property only for table column");
    tableColProp.setPropertyType(STRING_TYPE.getEntityReference());

    addCustomProperty(client, TABLE_COLUMN_ENTITY_TYPE.getId(), tableColProp);

    String dashColPropName = ns.prefix("isolatedDashColProp");
    CustomProperty dashColProp = new CustomProperty();
    dashColProp.setName(dashColPropName);
    dashColProp.setDescription("Property only for dashboard data model column");
    dashColProp.setPropertyType(INT_TYPE.getEntityReference());

    addCustomProperty(client, DASHBOARD_DATA_MODEL_COLUMN_ENTITY_TYPE.getId(), dashColProp);

    Type tableColumnType = getTypeByName(client, "tableColumn", "customProperties");
    Type dashboardColumnType =
        getTypeByName(client, "dashboardDataModelColumn", "customProperties");

    boolean tableColHasOwnProp =
        tableColumnType.getCustomProperties().stream()
            .anyMatch(cp -> tableColPropName.equals(cp.getName()));
    boolean tableColHasDashProp =
        tableColumnType.getCustomProperties().stream()
            .anyMatch(cp -> dashColPropName.equals(cp.getName()));

    boolean dashColHasOwnProp =
        dashboardColumnType.getCustomProperties().stream()
            .anyMatch(cp -> dashColPropName.equals(cp.getName()));
    boolean dashColHasTableProp =
        dashboardColumnType.getCustomProperties().stream()
            .anyMatch(cp -> tableColPropName.equals(cp.getName()));

    assertTrue(tableColHasOwnProp, "tableColumn should have its own custom property");
    assertFalse(
        tableColHasDashProp,
        "tableColumn should NOT have dashboardDataModelColumn's custom property");

    assertTrue(dashColHasOwnProp, "dashboardDataModelColumn should have its own custom property");
    assertFalse(
        dashColHasTableProp,
        "dashboardDataModelColumn should NOT have tableColumn's custom property");
  }

  @Test
  void test_getAllCustomPropertiesIncludesColumnTypes(TestNamespace ns) throws Exception {
    OpenMetadataClient client = SdkClients.adminClient();

    String tableColPropName = ns.prefix("allPropsTableColProp");
    CustomProperty tableColProp = new CustomProperty();
    tableColProp.setName(tableColPropName);
    tableColProp.setDescription("Table column property for getAllCustomProperties test");
    tableColProp.setPropertyType(STRING_TYPE.getEntityReference());

    addCustomProperty(client, TABLE_COLUMN_ENTITY_TYPE.getId(), tableColProp);

    String dashColPropName = ns.prefix("allPropsDashColProp");
    CustomProperty dashColProp = new CustomProperty();
    dashColProp.setName(dashColPropName);
    dashColProp.setDescription("Dashboard column property for getAllCustomProperties test");
    dashColProp.setPropertyType(INT_TYPE.getEntityReference());

    addCustomProperty(client, DASHBOARD_DATA_MODEL_COLUMN_ENTITY_TYPE.getId(), dashColProp);

    Map<String, List<Map<String, Object>>> allCustomProperties = getAllCustomProperties(client);

    assertNotNull(allCustomProperties);
    assertTrue(
        allCustomProperties.containsKey("tableColumn"),
        "getAllCustomProperties should include tableColumn");
    assertTrue(
        allCustomProperties.containsKey("dashboardDataModelColumn"),
        "getAllCustomProperties should include dashboardDataModelColumn");

    List<Map<String, Object>> tableColumnProps = allCustomProperties.get("tableColumn");
    List<Map<String, Object>> dashboardColumnProps =
        allCustomProperties.get("dashboardDataModelColumn");

    boolean tableColHasProp =
        tableColumnProps.stream().anyMatch(p -> tableColPropName.equals(p.get("name")));
    boolean dashColHasProp =
        dashboardColumnProps.stream().anyMatch(p -> dashColPropName.equals(p.get("name")));

    assertTrue(
        tableColHasProp,
        "tableColumn in getAllCustomProperties should contain tableColumn custom property");
    assertTrue(
        dashColHasProp,
        "dashboardDataModelColumn in getAllCustomProperties should contain dashboardDataModelColumn custom property");

    boolean tableColHasDashProp =
        tableColumnProps.stream().anyMatch(p -> dashColPropName.equals(p.get("name")));
    boolean dashColHasTableProp =
        dashboardColumnProps.stream().anyMatch(p -> tableColPropName.equals(p.get("name")));

    assertFalse(
        tableColHasDashProp,
        "tableColumn should NOT contain dashboardDataModelColumn's property in getAllCustomProperties");
    assertFalse(
        dashColHasTableProp,
        "dashboardDataModelColumn should NOT contain tableColumn's property in getAllCustomProperties");
  }

  private static Type createType(OpenMetadataClient client, CreateType createRequest)
      throws Exception {
    return client
        .getHttpClient()
        .execute(HttpMethod.POST, "/v1/metadata/types", createRequest, Type.class);
  }

  private static Type getTypeById(OpenMetadataClient client, UUID typeId) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/" + typeId.toString(), null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/name/" + name, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static Type getTypeByName(OpenMetadataClient client, String name, String fields)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types/name/" + name + "?fields=" + fields, null);
    return OBJECT_MAPPER.readValue(response, Type.class);
  }

  private static TypeList listTypes(OpenMetadataClient client) throws Exception {
    String response =
        client.getHttpClient().executeForString(HttpMethod.GET, "/v1/metadata/types", null);
    return OBJECT_MAPPER.readValue(response, TypeList.class);
  }

  private static TypeList listTypesByCategory(OpenMetadataClient client, Category category)
      throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(
                HttpMethod.GET, "/v1/metadata/types?category=" + category.value(), null);
    return OBJECT_MAPPER.readValue(response, TypeList.class);
  }

  private static Type addCustomProperty(
      OpenMetadataClient client, UUID typeId, CustomProperty customProperty) throws Exception {
    return client
        .getHttpClient()
        .execute(
            HttpMethod.PUT, "/v1/metadata/types/" + typeId.toString(), customProperty, Type.class);
  }

  private static List<Map<String, Object>> getEntityTypeFields(
      OpenMetadataClient client, String entityType) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/fields/" + entityType, null);
    return OBJECT_MAPPER.readValue(
        response, OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class));
  }

  private static Map<String, List<Map<String, Object>>> getAllCustomProperties(
      OpenMetadataClient client) throws Exception {
    String response =
        client
            .getHttpClient()
            .executeForString(HttpMethod.GET, "/v1/metadata/types/customProperties", null);
    return OBJECT_MAPPER.readValue(
        response,
        OBJECT_MAPPER
            .getTypeFactory()
            .constructMapType(
                Map.class,
                OBJECT_MAPPER.getTypeFactory().constructType(String.class),
                OBJECT_MAPPER.getTypeFactory().constructCollectionType(List.class, Map.class)));
  }

  private static class TypeList {
    private List<Type> data;
    private Object paging;

    public List<Type> getData() {
      return data;
    }

    public void setData(List<Type> data) {
      this.data = data;
    }

    public Object getPaging() {
      return paging;
    }

    public void setPaging(Object paging) {
      this.paging = paging;
    }
  }
}
