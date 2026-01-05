package org.openmetadata.sdk.fluent;

import static org.junit.jupiter.api.Assertions.*;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class CustomPropertiesTest {

  private UUID testId = UUID.randomUUID();
  private String testFqn = "service.database.schema.table";

  @Test
  void testCreateUpdaterById() {
    // Test creating an updater by ID
    var updater = CustomProperties.update(Tables.class, testId);
    assertNotNull(updater);

    // Test adding properties
    updater.withProperty("key1", "value1");
    assertEquals(1, updater.properties.size());
    assertEquals("value1", updater.properties.get("key1"));
  }

  @Test
  void testCreateUpdaterByName() {
    // Test creating an updater by name/FQN
    var updater = CustomProperties.updateByName(Tables.class, testFqn);
    assertNotNull(updater);
    assertTrue(updater.isFqn);
    assertEquals(testFqn, updater.identifier);
  }

  @Test
  void testWithProperty() {
    var updater = CustomProperties.update(Tables.class, testId);

    // Test single property
    updater.withProperty("businessImportance", "HIGH");
    assertEquals("HIGH", updater.properties.get("businessImportance"));

    // Test chaining
    updater
        .withProperty("dataClassification", "CONFIDENTIAL")
        .withProperty("refreshFrequency", "DAILY");

    assertEquals(3, updater.properties.size());
    assertEquals("CONFIDENTIAL", updater.properties.get("dataClassification"));
    assertEquals("DAILY", updater.properties.get("refreshFrequency"));
  }

  @Test
  void testWithProperties() {
    var updater = CustomProperties.update(Tables.class, testId);

    Map<String, Object> bulkProperties = new HashMap<>();
    bulkProperties.put("key1", "value1");
    bulkProperties.put("key2", "value2");
    bulkProperties.put("key3", 123);

    updater.withProperties(bulkProperties);

    assertEquals(3, updater.properties.size());
    assertEquals("value1", updater.properties.get("key1"));
    assertEquals("value2", updater.properties.get("key2"));
    assertEquals(123, updater.properties.get("key3"));
  }

  @Test
  void testClearProperty() {
    var updater = CustomProperties.update(Tables.class, testId);

    updater.withProperty("key1", "value1").withProperty("key2", "value2").clearProperty("key1");

    // key1 should be set to null (for removal)
    assertNull(updater.properties.get("key1"));
    assertEquals("value2", updater.properties.get("key2"));
  }

  @Test
  void testClearAll() {
    var updater = CustomProperties.update(Tables.class, testId);

    updater.withProperty("key1", "value1").withProperty("key2", "value2").clearAll();

    assertTrue(updater.clearAll);
  }

  @Test
  void testFluentChaining() {
    Map<String, Object> bulkProps = new HashMap<>();
    bulkProps.put("key3", "value3");
    bulkProps.put("key4", "value4");

    var updater =
        CustomProperties.update(Tables.class, testId)
            .withProperty("key1", "value1")
            .withProperty("key2", "value2")
            .withProperties(bulkProps)
            .clearProperty("key1");

    assertNotNull(updater);
    assertNull(updater.properties.get("key1")); // Should be null for removal
    assertEquals("value2", updater.properties.get("key2"));
    assertEquals("value3", updater.properties.get("key3"));
    assertEquals("value4", updater.properties.get("key4"));
  }

  @Test
  void testStringEntityId() {
    String stringId = testId.toString();
    var updater = CustomProperties.update(Tables.class, stringId);

    assertNotNull(updater);
    assertEquals(stringId, updater.identifier);
    assertFalse(updater.isFqn);
  }

  @Test
  void testComplexPropertyValues() {
    var updater = CustomProperties.update(Tables.class, testId);

    Map<String, Object> nestedObject = new HashMap<>();
    nestedObject.put("nested", "value");

    updater
        .withProperty("stringProp", "value")
        .withProperty("numberProp", 42)
        .withProperty("booleanProp", true)
        .withProperty("objectProp", nestedObject)
        .withProperty("nullProp", null);

    assertEquals("value", updater.properties.get("stringProp"));
    assertEquals(42, updater.properties.get("numberProp"));
    assertEquals(true, updater.properties.get("booleanProp"));
    assertNotNull(updater.properties.get("objectProp"));
    assertTrue(updater.properties.get("objectProp") instanceof Map);
    assertNull(updater.properties.get("nullProp"));
  }

  @Test
  void testGlossaryEntity() {
    var updater = CustomProperties.update(Glossaries.class, testId);
    assertNotNull(updater);
    assertEquals(Glossaries.class, updater.entityClass);

    updater.withProperty("category", "BUSINESS");
    assertEquals("BUSINESS", updater.properties.get("category"));
  }
}
