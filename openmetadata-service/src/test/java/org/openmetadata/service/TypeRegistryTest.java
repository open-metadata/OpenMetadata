package org.openmetadata.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.util.Collections;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.openmetadata.schema.entity.Type;
import org.openmetadata.schema.entity.type.Category;
import org.openmetadata.schema.entity.type.CustomProperty;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.service.exception.EntityNotFoundException;
import org.openmetadata.service.jdbi3.TypeRepository;
import org.openmetadata.service.util.EntityUtil;

public class TypeRegistryTest {

  private TypeRepository mockTypeRepository;

  @BeforeEach
  void setUp() {
    clearRegistryState();
    mockTypeRepository = Mockito.mock(TypeRepository.class);
    TypeRegistry.instance().initialize(mockTypeRepository);
  }

  @AfterEach
  void tearDown() {
    clearRegistryState();
  }

  private void clearRegistryState() {
    TypeRegistry.TYPES.clear();
    TypeRegistry.CUSTOM_PROPERTIES.clear();
    TypeRegistry.CUSTOM_PROPERTY_SCHEMAS.clear();
    TypeRegistry.TYPE_LAST_REFRESHED.clear();
  }

  private Type createPropertyType(String name, String schema) {
    Type propertyType = new Type();
    propertyType.setId(UUID.randomUUID());
    propertyType.setName(name);
    propertyType.setCategory(Category.Field);
    propertyType.setSchema(schema);
    return propertyType;
  }

  private Type createEntityTypeWithCustomProperty(
      String entityTypeName, String propertyName, String propertyTypeName) {
    EntityReference propertyTypeRef = new EntityReference();
    propertyTypeRef.setId(UUID.randomUUID());
    propertyTypeRef.setName(propertyTypeName);
    propertyTypeRef.setType(Entity.TYPE);

    CustomProperty customProperty = new CustomProperty();
    customProperty.setName(propertyName);
    customProperty.setPropertyType(propertyTypeRef);

    Type entityType = new Type();
    entityType.setId(UUID.randomUUID());
    entityType.setName(entityTypeName);
    entityType.setCategory(Category.Entity);
    entityType.setCustomProperties(List.of(customProperty));
    return entityType;
  }

  @Test
  void addType_withNullCustomProperties_doesNotThrowNPE() {
    Type fieldType = new Type();
    fieldType.setId(UUID.randomUUID());
    fieldType.setName("testFieldType");
    fieldType.setCategory(Category.Field);
    fieldType.setCustomProperties(null);

    assertDoesNotThrow(() -> TypeRegistry.instance().addType(fieldType));
    assertNotNull(TypeRegistry.TYPES.get("testFieldType"));
  }

  @Test
  void addType_withEmptyCustomProperties_doesNotThrowNPE() {
    Type fieldType = new Type();
    fieldType.setId(UUID.randomUUID());
    fieldType.setName("testFieldType");
    fieldType.setCategory(Category.Field);
    fieldType.setCustomProperties(Collections.emptyList());

    assertDoesNotThrow(() -> TypeRegistry.instance().addType(fieldType));
    assertNotNull(TypeRegistry.TYPES.get("testFieldType"));
  }

  @Test
  void getSchema_cacheMiss_loadsFromDbAndReturnsSchema() throws Exception {
    Type stringType = createPropertyType("string", "{\"type\": \"string\"}");
    TypeRegistry.instance().addType(stringType);

    Type tableType = createEntityTypeWithCustomProperty("table", "myProp", "string");

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableType);

    assertNotNull(TypeRegistry.instance().getSchema("table", "myProp"));
    assertNotNull(TypeRegistry.CUSTOM_PROPERTIES.get("table.customProperties.myProp"));
  }

  @Test
  void getSchema_afterFallback_subsequentCallsServedFromCache() throws Exception {
    Type stringType = createPropertyType("string", "{\"type\": \"string\"}");
    TypeRegistry.instance().addType(stringType);

    Type tableType = createEntityTypeWithCustomProperty("table", "myProp", "string");

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableType);

    TypeRegistry.instance().getSchema("table", "myProp");
    TypeRegistry.instance().getSchema("table", "myProp");

    verify(mockTypeRepository, times(1)).getByName(any(), eq("table"), any());
  }

  @Test
  void getSchema_propertyNotInDb_returnsNull() throws Exception {
    Type tableTypeNoProps = new Type();
    tableTypeNoProps.setId(UUID.randomUUID());
    tableTypeNoProps.setName("table");
    tableTypeNoProps.setCategory(Category.Entity);
    tableTypeNoProps.setCustomProperties(Collections.emptyList());

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableTypeNoProps);

    assertNull(TypeRegistry.instance().getSchema("table", "nonExistentProp"));
  }

  @Test
  void getSchema_typeRepositoryNotAvailable_returnsNull() {
    TypeRegistry registry = TypeRegistry.instance();
    clearRegistryState();
    // Re-create instance state without initializing typeRepository
    TypeRegistry freshRegistry = TypeRegistry.instance();
    // Use reflection to clear the typeRepository reference
    try {
      var field = TypeRegistry.class.getDeclaredField("typeRepository");
      field.setAccessible(true);
      field.set(freshRegistry, null);
    } catch (Exception e) {
      throw new RuntimeException(e);
    }

    assertNull(freshRegistry.getSchema("table", "someProp"));
  }

  @Test
  void getSchema_dbThrowsException_returnsNull() throws Exception {
    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any()))
        .thenThrow(new RuntimeException("DB unavailable"));

    assertNull(TypeRegistry.instance().getSchema("table", "someProp"));
  }

  @Test
  void getCustomPropertyType_cacheMiss_loadsFromDb() throws Exception {
    Type stringType = createPropertyType("string", "{\"type\": \"string\"}");
    TypeRegistry.instance().addType(stringType);

    Type tableType = createEntityTypeWithCustomProperty("table", "myProp", "string");

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableType);

    assertEquals("string", TypeRegistry.getCustomPropertyType("table", "myProp"));
  }

  @Test
  void getCustomPropertyType_notInDbEither_throwsEntityNotFound() throws Exception {
    Type tableTypeNoProps = new Type();
    tableTypeNoProps.setId(UUID.randomUUID());
    tableTypeNoProps.setName("table");
    tableTypeNoProps.setCategory(Category.Entity);
    tableTypeNoProps.setCustomProperties(Collections.emptyList());

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableTypeNoProps);

    assertThrows(
        EntityNotFoundException.class,
        () -> TypeRegistry.getCustomPropertyType("table", "nonExistent"));
  }

  @Test
  void refreshTypeFromDB_removesDeletedProperties() throws Exception {
    Type stringType = createPropertyType("string", "{\"type\": \"string\"}");
    TypeRegistry.instance().addType(stringType);

    // Add a property that will later be "deleted" from DB
    Type tableWithProp = createEntityTypeWithCustomProperty("table", "oldProp", "string");
    TypeRegistry.instance().addType(tableWithProp);
    assertNotNull(TypeRegistry.CUSTOM_PROPERTIES.get("table.customProperties.oldProp"));

    // DB now returns the type without the old property
    Type tableWithoutProp = new Type();
    tableWithoutProp.setId(UUID.randomUUID());
    tableWithoutProp.setName("table");
    tableWithoutProp.setCategory(Category.Entity);
    tableWithoutProp.setCustomProperties(Collections.emptyList());

    when(mockTypeRepository.getFields(any())).thenReturn(new EntityUtil.Fields(List.of()));
    when(mockTypeRepository.getByName(any(), eq("table"), any())).thenReturn(tableWithoutProp);

    // Force staleness so refresh triggers
    TypeRegistry.TYPES.remove("table");
    TypeRegistry.instance().getSchema("table", "oldProp");

    assertNull(TypeRegistry.CUSTOM_PROPERTIES.get("table.customProperties.oldProp"));
    assertNull(TypeRegistry.CUSTOM_PROPERTY_SCHEMAS.get("table.customProperties.oldProp"));
  }
}
