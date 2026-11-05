package org.openmetadata.service.jdbi3;

import jakarta.json.Json;
import jakarta.json.JsonArray;
import jakarta.json.JsonArrayBuilder;
import jakarta.json.JsonObject;
import jakarta.json.JsonObjectBuilder;
import jakarta.json.JsonPatch;
import jakarta.json.JsonPointer;
import jakarta.json.JsonString;
import jakarta.json.JsonStructure;
import jakarta.json.JsonValue;
import java.util.List;
import java.util.stream.IntStream;
import org.openmetadata.service.exception.BadRequestException;
import org.openmetadata.service.exception.EntityNotFoundException;

/**
 * One item, found by its {@code name}, in a list inside a stored setting. A JSON Patch written
 * against the item is rebased onto the item's position in the same snapshot the caller later
 * compares-and-sets against, so a concurrent change surfaces as a 412 rather than a patch applied
 * to whichever item has since moved into that position.
 */
record SystemSettingItemPatch(String listPointer, String itemName, int itemCount, int index) {
  private static final String NAME_FIELD = "name";
  private static final List<String> POINTER_FIELDS = List.of("path", "from");

  static SystemSettingItemPatch locate(
      final JsonValue setting, final String listPointer, final String itemName) {
    final JsonArray items = itemsAt(setting, listPointer);
    final int index =
        IntStream.range(0, items.size())
            .filter(position -> itemName.equals(nameOf(items.get(position))))
            .findFirst()
            .orElseThrow(() -> EntityNotFoundException.byName(itemName));
    return new SystemSettingItemPatch(listPointer, itemName, items.size(), index);
  }

  /** Prefixes every {@code path} and {@code from} of the item patch with the item's position. */
  JsonPatch rebase(final JsonPatch itemPatch) {
    final JsonArrayBuilder operations = Json.createArrayBuilder();
    itemPatch.toJsonArray().forEach(operation -> operations.add(rebaseOperation(operation)));
    return Json.createPatch(operations.build());
  }

  /** A patch on one item may change its fields, never rename, add or remove items. */
  void assertItemKept(final JsonValue patchedSetting) {
    final JsonArray items = itemsAt(patchedSetting, listPointer);
    final boolean isItemKept =
        items.size() == itemCount && itemName.equals(nameOf(items.get(index)));
    if (!isItemKept) {
      throw new BadRequestException(
          String.format("A patch on '%s' may not rename, add or remove items", itemName));
    }
  }

  private String itemPointer() {
    return listPointer + "/" + index;
  }

  private JsonObject rebaseOperation(final JsonValue operation) {
    final JsonObject source = operation.asJsonObject();
    final JsonObjectBuilder rebased = Json.createObjectBuilder(source);
    POINTER_FIELDS.stream()
        .filter(source::containsKey)
        .forEach(field -> rebased.add(field, itemPointer() + relativePointer(source.get(field))));
    return rebased.build();
  }

  private static String relativePointer(final JsonValue pointer) {
    final boolean isRelativePointer =
        pointer instanceof JsonString text
            && (text.getString().isEmpty() || text.getString().startsWith("/"));
    if (!isRelativePointer) {
      throw new BadRequestException(
          String.format("JSON Patch pointer %s must be a JSON Pointer within the item", pointer));
    }
    return ((JsonString) pointer).getString();
  }

  private static JsonArray itemsAt(final JsonValue setting, final String listPointer) {
    final JsonPointer pointer = Json.createPointer(listPointer);
    final boolean hasList =
        setting instanceof JsonStructure structure
            && pointer.containsValue(structure)
            && pointer.getValue(structure).getValueType() == JsonValue.ValueType.ARRAY;
    return hasList
        ? pointer.getValue((JsonStructure) setting).asJsonArray()
        : JsonValue.EMPTY_JSON_ARRAY;
  }

  private static String nameOf(final JsonValue item) {
    return item instanceof JsonObject object ? object.getString(NAME_FIELD, null) : null;
  }
}
