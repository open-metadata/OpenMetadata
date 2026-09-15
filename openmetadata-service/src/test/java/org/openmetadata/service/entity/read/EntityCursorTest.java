package org.openmetadata.service.entity.read;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import java.util.Map;
import org.junit.jupiter.api.Test;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.RestUtil;

class EntityCursorTest {
  @Test
  void emptyCursorAndExtendedSortFieldsKeepTheirWireShape() {
    assertEquals(Map.of("name", "", "id", ""), EntityCursor.parse(""));
    final Map<String, String> values = Map.of("name", "a", "id", "id", "displayNameSort", "Label");
    assertEquals(values, EntityCursor.parse(JsonUtils.pojoToJson(values)));
    assertEquals(new EntityCursor.Position("", ""), EntityCursor.after(null));
  }

  @Test
  void encodedPositionUnquotesNamesAndPreservesIds() {
    final String wire =
        RestUtil.encodeCursor(JsonUtils.pojoToJson(Map.of("name", "\"a.b\"", "id", "id")));
    assertEquals(new EntityCursor.Position("a.b", "id"), EntityCursor.after(wire));
    assertEquals(EntityCursor.after(wire), EntityCursor.before(wire));
  }

  @Test
  void invalidJsonAndNullDecodedCursorsRemainErrors() {
    assertThrows(RuntimeException.class, () -> EntityCursor.parse("not json"));
    assertThrows(NullPointerException.class, () -> EntityCursor.parse(null));
  }
}
