package org.openmetadata.service.secrets.converter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.ReflectionUtil;

class SchemaBackedMapTest {
  private static final String PATH = "json/schema/test.json";

  public static class NamedEntry {
    public String getName() {
      return null;
    }

    @JsonProperty("secret.key")
    public String getSecretKey() {
      return null;
    }
  }

  public static class Root {
    public List<NamedEntry> getRows() {
      return List.of();
    }

    public Object getAuth() {
      return null;
    }
  }

  @Test
  void contradictoryDiscriminatorsDoNotHideAnotherBranchesPassword() {
    String schema =
        """
        {"type":"object", "properties":{"auth":{"oneOf":[
          {"type":"object", "properties":{"kind":{"const":"first"},
             "one":{"type":"string","format":"password"}}, "required":["missing"]},
          {"type":"object", "properties":{"kind":{"const":"second"},
             "two":{"type":"string","format":"password"}}}
        ]}}}
        """;
    JsonSchemaRepository schemas = repository(schema, Map.of(PATH + "#", Root.class.getName()));
    SchemaBackedMap value =
        new SchemaBackedMap(
            Map.of(
                "auth",
                Map.of(
                    "kind",
                    "first",
                    "one",
                    Map.of("secret", "nested"),
                    "two",
                    "alternate",
                    "old",
                    true)),
            schemas.rootSchema(PATH),
            schemas);
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    value.visitSecrets(
        slot -> {
          slots.add(slot);
          slot.setValue("masked");
        });
    assertEquals(2, slots.size());
    assertEquals(
        Map.of("kind", "first", "one", "masked", "two", "masked", "old", true), value.get("auth"));
    assertFalse(JsonUtils.pojoToJson(value).contains("alternate"));
  }

  @Test
  void namedArraysUseTheSameUniqueNameAndPositionalFallbackAsTypedWalkers() {
    String schema =
        """
        {"type":"object", "properties":{"rows":{"type":"array", "items":{
          "type":"object", "properties":{"name":{"type":"string"},
            "secret.key":{"type":"string","format":"password"}}
        }}}}
        """;
    JsonSchemaRepository schemas =
        repository(
            schema,
            Map.of(
                PATH + "#",
                Root.class.getName(),
                PATH + "#/properties/rows/items",
                NamedEntry.class.getName()));
    SchemaBackedMap value =
        new SchemaBackedMap(
            Map.of(
                "rows",
                List.of(
                    Map.of("name", "unique", "secret.key", "a"),
                    Map.of("name", "duplicate", "secret.key", "b"),
                    Map.of("name", "duplicate", "secret.key", "c"),
                    Map.of("secret.key", "d"))),
            schemas.rootSchema(PATH),
            schemas);
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    value.visitSecrets(slots::add);
    assertEquals(List.of("Rows", "unique", "SecretKey"), slots.getFirst().path());
    assertEquals(List.of("rows", "0", "secret.key"), slots.getFirst().jsonPath());
    assertEquals(List.of(2), slots.getFirst().ownerPathLengths());
    assertEquals(List.of("Rows", "#1", "SecretKey"), slots.get(1).path());
    assertEquals(List.of("Rows", "#2", "SecretKey"), slots.get(2).path());
    assertEquals(List.of("Rows", "#3", "SecretKey"), slots.get(3).path());
    JsonSchemaRepository.Ref items =
        schemas.child(schemas.property(schemas.rootSchema(PATH), "rows"), "items");
    SchemaBackedMap named = new SchemaBackedMap(Map.of("name", "unique"), items, schemas);
    assertEquals(List.of("unique"), ReflectionUtil.getCollectionElementKeys(List.of(named)));
  }

  @Test
  void unnamedArraySchemasIgnoreIncidentalNameFields() {
    String schema =
        """
        {"type":"object", "properties":{"rows":{"type":"array", "items":{
          "type":"object", "properties":{"secret.key":{"format":"password"}}
        }}}}
        """;
    JsonSchemaRepository schemas = repository(schema, Map.of(PATH + "#", Root.class.getName()));
    SchemaBackedMap value =
        new SchemaBackedMap(
            Map.of("rows", List.of(Map.of("name", "not-an-identity", "secret.key", "secret"))),
            schemas.rootSchema(PATH),
            schemas);
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    value.visitSecrets(slots::add);
    assertEquals("#0", slots.getFirst().path().get(1));
  }

  @Test
  void referenceChainsHaveNoArbitraryDepthLimitAndCompositionVisitsEachLeafOnce() {
    Map<String, Object> definitions = new LinkedHashMap<>();
    for (int index = 0; index < 40; index++) {
      definitions.put("ref" + index, Map.of("$ref", "#/definitions/ref" + (index + 1)));
    }
    definitions.put("ref40", Map.of("format", "password", "type", "string"));
    Map<String, Object> schema =
        Map.of(
            "type",
            "object",
            "definitions",
            definitions,
            "properties",
            Map.of(
                "auth",
                Map.of(
                    "allOf",
                    List.of(
                        Map.of(
                            "type",
                            "object",
                            "properties",
                            Map.of("secret", Map.of("$ref", "#/definitions/ref0"))),
                        Map.of(
                            "type",
                            "object",
                            "properties",
                            Map.of("secret", Map.of("$ref", "#/definitions/ref0")))))));
    JsonSchemaRepository schemas =
        new JsonSchemaRepository(
            Map.of(PATH, JsonUtils.valueToTree(schema)), Map.of(PATH + "#", Root.class.getName()));
    SchemaBackedMap value =
        new SchemaBackedMap(
            Map.of("auth", Map.of("secret", "value")), schemas.rootSchema(PATH), schemas);
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    value.visitSecrets(slots::add);
    assertEquals(1, slots.size());
    assertTrue(schemas.containsPasswordFormat(schemas.rootSchema(PATH)));
  }

  @Test
  void aSecretObjectWithoutGeneratedIdentityCannotEscapeAsAnOrdinaryMap() {
    String schema =
        """
        {"type":"object","properties":{"auth":{"oneOf":[
          {"type":"object","properties":{"token":{"type":"string","format":"password"}}}
        ]}}}
        """;
    JsonSchemaRepository schemas = repository(schema, Map.of(PATH + "#", Root.class.getName()));
    SchemaClassConverter converter = new SchemaClassConverter(schemas);
    Map<String, Object> secret = Map.of("token", "never-echo");
    SchemaConversionException failure =
        assertThrows(
            SchemaConversionException.class,
            () -> converter.convertProperty(Root.class, "auth", secret, false));
    assertTrue(failure.getMessage().contains(PATH));
    assertFalse(failure.getMessage().contains("never-echo"));
    SchemaBackedMap read =
        assertInstanceOf(
            SchemaBackedMap.class, converter.convertProperty(Root.class, "auth", secret, true));
    read.visitSecrets(slot -> slot.setValue("masked"));
    assertEquals(Map.of("token", "masked"), read);
  }

  @Test
  void aDeclaredPasswordMapDoesNotRequireAnObjectClass() {
    String schema =
        """
        {"type":"object","properties":{"auth":{"type":"object", "additionalProperties":{"format":"password"}}}}
        """;
    JsonSchemaRepository schemas = repository(schema, Map.of(PATH + "#", Root.class.getName()));
    Map<String, Object> entries = Map.of("dynamic", "secret", "number", 5);
    assertEquals(
        entries,
        new SchemaClassConverter(schemas).convertProperty(Root.class, "auth", entries, false));
  }

  @Test
  void scalarAndDynamicPasswordsInsideAllOfAreStillSecretLeaves() {
    String schema =
        """
        {"type":"object","properties":{
          "auth":{"allOf":[{"type":"string"},{"format":"password"}]},
          "rows":{"type":"object","additionalProperties":{"allOf":[{"format":"password"}]}}
        }}
        """;
    JsonSchemaRepository schemas = repository(schema, Map.of(PATH + "#", Root.class.getName()));
    SchemaBackedMap raw =
        new SchemaBackedMap(
            Map.of(
                "auth", Map.of("nested", "secret"), "rows", Map.of("key", "secret", "number", 7)),
            schemas.rootSchema(PATH),
            schemas);
    List<SchemaBackedMap.SecretSlot> slots = new ArrayList<>();
    raw.visitSecrets(
        slot -> {
          slots.add(slot);
          slot.setValue("masked");
        });
    assertEquals(2, slots.size());
    assertEquals("masked", raw.get("auth"));
    assertEquals(Map.of("key", "masked", "number", 7), raw.get("rows"));
    assertEquals(1, slots.stream().filter(SchemaBackedMap.SecretSlot::mapEntry).count());
  }

  private static JsonSchemaRepository repository(String schema, Map<String, String> types) {
    return new JsonSchemaRepository(Map.of(PATH, JsonUtils.readTree(schema)), types);
  }
}
