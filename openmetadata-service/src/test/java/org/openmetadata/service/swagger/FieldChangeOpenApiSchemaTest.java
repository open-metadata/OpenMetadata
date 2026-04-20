package org.openmetadata.service.swagger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.swagger.v3.core.converter.ModelConverters;
import io.swagger.v3.core.converter.ResolvedSchema;
import io.swagger.v3.oas.models.media.ComposedSchema;
import io.swagger.v3.oas.models.media.Schema;
import java.util.List;
import java.util.stream.Collectors;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.FieldChange;

class FieldChangeOpenApiSchemaTest {

  @Test
  void test_fieldChangeValuesSupportPrimitiveAndStructuredJson() {
    ResolvedSchema resolvedSchema =
        ModelConverters.getInstance().readAllAsResolvedSchema(FieldChange.class);

    Schema<?> fieldChangeSchema =
        resolvedSchema.referencedSchemas != null
            ? resolvedSchema.referencedSchemas.get("FieldChange")
            : null;
    if (fieldChangeSchema == null) {
      fieldChangeSchema = resolvedSchema.schema;
    }

    assertNotNull(fieldChangeSchema);
    Schema<?> oldValueSchema = (Schema<?>) fieldChangeSchema.getProperties().get("oldValue");
    Schema<?> newValueSchema = (Schema<?>) fieldChangeSchema.getProperties().get("newValue");

    assertValueSchema(oldValueSchema, "oldValue");
    assertValueSchema(newValueSchema, "newValue");
  }

  private void assertValueSchema(Schema<?> schema, String propertyName) {
    assertNotNull(schema, propertyName + " should be present in the generated OpenAPI schema");
    assertInstanceOf(
        ComposedSchema.class, schema, propertyName + " should resolve to a composed schema");

    ComposedSchema composedSchema = (ComposedSchema) schema;
    List<String> anyOfTypes =
        composedSchema.getAnyOf().stream().map(Schema::getType).collect(Collectors.toList());

    assertEquals("object", schema.getType(), propertyName + " should still allow object values");
    assertEquals(
        3,
        anyOfTypes.size(),
        propertyName + " should enumerate primitive JSON variants alongside object values");
    assertTrue(anyOfTypes.contains("string"), propertyName + " should allow strings");
    assertTrue(anyOfTypes.contains("boolean"), propertyName + " should allow booleans");
    assertTrue(anyOfTypes.contains("number"), propertyName + " should allow numbers");
    assertTrue(Boolean.TRUE.equals(schema.getNullable()), propertyName + " should remain nullable");
  }
}
