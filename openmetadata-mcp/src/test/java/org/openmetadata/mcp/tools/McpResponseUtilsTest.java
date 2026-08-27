package org.openmetadata.mcp.tools;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.entity.data.Glossary;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.EventType;
import org.openmetadata.schema.type.FieldChange;

class McpResponseUtilsTest {

  private static Glossary buildGlossary() {
    Glossary glossary = new Glossary();
    glossary.setName("BusinessGlossary");
    glossary.setVersion(1.0);
    glossary.setUpdatedBy("x");
    glossary.setDeleted(false);
    return glossary;
  }

  private static Glossary patchedGlossary() {
    Glossary glossary = buildGlossary();
    glossary.setVersion(1.3);
    glossary.setChangeDescription(
        new ChangeDescription()
            .withFieldsUpdated(List.of(new FieldChange().withName("description")))
            .withFieldsAdded(List.of(new FieldChange().withName("tags"))));
    return glossary;
  }

  @Test
  void compactPatchKeepsWhatOnlyAnUpdateCanAnswer() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(patchedGlossary(), EventType.ENTITY_UPDATED);

    // compact() strips both of these because they are meaningless on a create. On a patch they are
    // the confirmation the caller wrote for, so aligning the response must not drop them.
    assertEquals(1.3, doc.get("version"), "the new version must survive the slimming");
    // Order is added-then-updated-then-deleted, which is not a contract - the set is.
    assertEquals(
        Set.of("description", "tags"),
        Set.copyOf((List<?>) doc.get("changed")),
        "which fields actually changed is the answer to 'did my update land'");
    assertEquals("updated", doc.get("_operation"));
  }

  @Test
  void compactPatchStillDropsTheNoise() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(patchedGlossary(), EventType.ENTITY_UPDATED);

    assertFalse(doc.containsKey("updatedBy"));
    assertFalse(
        doc.containsKey("changeDescription"),
        "the full object carries old and new values for every field - the names are enough");
  }

  @Test
  void compactPatchOmitsChangedWhenNothingIsRecorded() {
    Map<String, Object> doc =
        McpResponseUtils.compactPatch(buildGlossary(), EventType.ENTITY_UPDATED);

    assertFalse(doc.containsKey("changed"), "an empty list would read as 'nothing changed'");
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
