package org.openmetadata.service.formatter.field;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

class DefaultFieldFormatterTest {

  @Test
  void getFieldValueParsesSupportedJsonShapes() {
    assertEquals("", DefaultFieldFormatter.getFieldValue(null));
    assertEquals("", DefaultFieldFormatter.getFieldValue(""));
    assertEquals(
        "PII.Sensitive",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(new TagLabel().withTagFQN("PII.Sensitive")))));
    assertEquals(
        "Data Steward",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(new EntityReference().withDisplayName("Data Steward")))));
    assertEquals(
        "Glossary.Term",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("name", "Glossary.Term")))));
    assertEquals(
        "PRIMARY_KEY",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("constraintType", "PRIMARY_KEY")))));
    assertEquals(
        "first, second",
        DefaultFieldFormatter.getFieldValue(JsonUtils.pojoToJson(List.of(" first ", "second"))));
    assertEquals(
        "Display Name",
        DefaultFieldFormatter.getFieldValue(
            JsonUtils.pojoToJson(Map.of("displayName", "Display Name"))));
    assertEquals(
        "entity-name",
        DefaultFieldFormatter.getFieldValue(JsonUtils.pojoToJson(Map.of("name", "entity-name"))));
    assertEquals("plain text", DefaultFieldFormatter.getFieldValue("plain text"));
  }
}
