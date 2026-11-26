package org.openmetadata.service.jdbi3;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonPatch;
import jakarta.json.JsonValue;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;

class SystemSettingItemPatchTest {
  private static final String LIST_POINTER = "/entitySemantics";
  private static final String SETTING_JSON =
      """
      {"entitySemantics": [
        {"name": "First", "enabled": true},
        {"name": "Second", "enabled": false}
      ]}""";

  @Test
  void locateFindsTheItemByName() {
    final SystemSettingItemPatch item = locate("Second");

    assertEquals(1, item.index());
    assertEquals(2, item.itemCount());
  }

  @Test
  void locateRejectsAnUnknownItemOrAMissingList() {
    assertThrows(EntityNotFoundException.class, () -> locate("Third"));
    assertThrows(
        EntityNotFoundException.class,
        () -> SystemSettingItemPatch.locate(JsonUtils.readJson("{}"), LIST_POINTER, "First"));
  }

  @Test
  void rebasePrefixesPathAndFromWithTheItemPosition() {
    final JsonArray rebased =
        locate("Second")
            .rebase(
                patch(
                    """
                    [{"op": "copy", "from": "/enabled", "path": "/previouslyEnabled"}]"""))
            .toJsonArray();

    assertEquals("/entitySemantics/1/enabled", rebased.getJsonObject(0).getString("from"));
    assertEquals(
        "/entitySemantics/1/previouslyEnabled", rebased.getJsonObject(0).getString("path"));
  }

  @Test
  void rebasedPatchChangesOnlyTheNamedItem() {
    final JsonValue patched =
        apply(
            locate("Second"),
            """
            [{"op": "replace", "path": "/enabled", "value": true}]""");

    assertEquals(
        JsonUtils.readJson(
            """
            {"entitySemantics": [
              {"name": "First", "enabled": true},
              {"name": "Second", "enabled": true}
            ]}"""),
        patched);
  }

  @Test
  void rebaseRejectsAPointerThatIsNotWithinTheItem() {
    final JsonPatch outside =
        patch("""
        [{"op": "replace", "path": "enabled", "value": true}]""");

    assertThrows(BadRequestException.class, () -> locate("Second").rebase(outside));
  }

  @Test
  void assertItemKeptAcceptsAFieldChange() {
    final SystemSettingItemPatch item = locate("Second");
    final JsonValue patched =
        apply(item, """
        [{"op": "replace", "path": "/enabled", "value": true}]""");

    assertDoesNotThrow(() -> item.assertItemKept(patched));
  }

  @Test
  void assertItemKeptRejectsARename() {
    final SystemSettingItemPatch item = locate("Second");
    final JsonValue patched =
        apply(item, """
        [{"op": "replace", "path": "/name", "value": "First"}]""");

    assertThrows(BadRequestException.class, () -> item.assertItemKept(patched));
  }

  @Test
  void assertItemKeptRejectsRemovingTheItem() {
    final SystemSettingItemPatch item = locate("First");
    final JsonValue patched = apply(item, """
        [{"op": "remove", "path": ""}]""");

    assertThrows(BadRequestException.class, () -> item.assertItemKept(patched));
  }

  private static SystemSettingItemPatch locate(final String itemName) {
    return SystemSettingItemPatch.locate(JsonUtils.readJson(SETTING_JSON), LIST_POINTER, itemName);
  }

  private static JsonPatch patch(final String operations) {
    return Json.createPatch(JsonUtils.readJson(operations).asJsonArray());
  }

  private static JsonValue apply(final SystemSettingItemPatch item, final String operations) {
    return JsonUtils.applyPatch(
        JsonUtils.readValue(SETTING_JSON, Object.class), item.rebase(patch(operations)));
  }
}
