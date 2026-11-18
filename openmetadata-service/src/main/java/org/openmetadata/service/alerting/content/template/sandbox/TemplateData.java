package org.openmetadata.service.alerting.content.template.sandbox;

import java.util.Map;
import org.openmetadata.schema.utils.JsonUtils;

/** Turns what a template sees into plain data: maps, lists, text, numbers and booleans. */
final class TemplateData {

  private TemplateData() {}

  static Map<String, Object> of(Map<String, Object> context) {
    return JsonUtils.getMap(context);
  }

  static Object of(Object value) {
    return switch (value) {
      case null -> null;
      case CharSequence text -> text;
      case Number number -> number;
      case Boolean flag -> flag;
      default -> JsonUtils.convertValue(value, Object.class);
    };
  }
}
