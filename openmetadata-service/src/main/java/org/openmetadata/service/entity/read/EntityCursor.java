package org.openmetadata.service.entity.read;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import java.util.Map;
import java.util.Objects;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;
import org.openmetadata.service.util.RestUtil;

public final class EntityCursor {
  private EntityCursor() {}

  record Position(String name, String id) {}

  @SuppressWarnings("unchecked")
  public static Map<String, String> parse(final String json) {
    Objects.requireNonNull(json);
    return nullOrEmpty(json) ? Map.of("name", "", "id", "") : JsonUtils.readValue(json, Map.class);
  }

  static Position after(final String cursor) {
    return position(nullOrEmpty(cursor) ? "" : RestUtil.decodeCursor(cursor));
  }

  static Position before(final String cursor) {
    return position(RestUtil.decodeCursor(cursor));
  }

  private static Position position(final String json) {
    final Map<String, String> values = parse(json);
    return new Position(FullyQualifiedName.unquoteName(values.get("name")), values.get("id"));
  }
}
