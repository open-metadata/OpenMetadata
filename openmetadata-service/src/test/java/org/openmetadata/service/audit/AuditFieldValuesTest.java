package org.openmetadata.service.audit;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;

class AuditFieldValuesTest {

  @Test
  void getFieldValueParsesSupportedJsonShapes() {
    assertEquals("", AuditFieldValues.getFieldValue(null));
    assertEquals("", AuditFieldValues.getFieldValue(""));
    assertEquals(
        "PII.Sensitive",
        AuditFieldValues.getFieldValue(
            JsonUtils.pojoToJson(List.of(new TagLabel().withTagFQN("PII.Sensitive")))));
    assertEquals(
        "Data Steward",
        AuditFieldValues.getFieldValue(
            JsonUtils.pojoToJson(List.of(new EntityReference().withDisplayName("Data Steward")))));
    assertEquals(
        "Glossary.Term",
        AuditFieldValues.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("name", "Glossary.Term")))));
    assertEquals(
        "PRIMARY_KEY",
        AuditFieldValues.getFieldValue(
            JsonUtils.pojoToJson(List.of(Map.of("constraintType", "PRIMARY_KEY")))));
    assertEquals(
        "first, second",
        AuditFieldValues.getFieldValue(JsonUtils.pojoToJson(List.of(" first ", "second"))));
    assertEquals(
        "Display Name",
        AuditFieldValues.getFieldValue(
            JsonUtils.pojoToJson(Map.of("displayName", "Display Name"))));
    assertEquals(
        "entity-name",
        AuditFieldValues.getFieldValue(JsonUtils.pojoToJson(Map.of("name", "entity-name"))));
    assertEquals("plain text", AuditFieldValues.getFieldValue("plain text"));
  }
}
