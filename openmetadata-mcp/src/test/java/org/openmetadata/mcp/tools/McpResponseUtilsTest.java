package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.EventType;

class McpResponseUtilsTest {

  private static Glossary buildGlossary() {
    Glossary glossary = new Glossary();
    glossary.setName("BusinessGlossary");
    glossary.setVersion(1.0);
    glossary.setUpdatedBy("x");
    glossary.setDeleted(false);
    return glossary;
  }

  @Test
  void testCompactCreated() {
    Glossary glossary = buildGlossary();

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_CREATED);

    assertEquals("created", doc.get("_operation"));
    assertTrue(doc.containsKey("name"));
    assertFalse(doc.containsKey("version"));
    assertFalse(doc.containsKey("updatedBy"));
    assertFalse(doc.containsKey("deleted"));
  }

  @Test
  void testCompactUpdated() {
    Glossary glossary = buildGlossary();

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_UPDATED);

    assertEquals("updated", doc.get("_operation"));
  }

  @Test
  void testCompactKeepsDeletedWhenTrue() {
    Glossary glossary = buildGlossary();
    glossary.setDeleted(true);

    Map<String, Object> doc = McpResponseUtils.compact(glossary, EventType.ENTITY_CREATED);

    assertTrue(doc.containsKey("deleted"));
    assertEquals(Boolean.TRUE, doc.get("deleted"));
  }
}
