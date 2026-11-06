package org.openmetadata.service.audit;

import static org.openmetadata.service.jdbi3.AppRepository.RUNTIME_SECRET_FIELDS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Iterator;
import java.util.List;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.type.ChangeEvent;
import org.openmetadata.schema.utils.JsonUtils;

final class AppAuditProjection {
  private static final List<String> DESCRIPTIONS =
      List.of("changeDescription", "incrementalChangeDescription");
  private static final List<String> CHANGES =
      List.of("fieldsAdded", "fieldsUpdated", "fieldsDeleted");

  private AppAuditProjection() {}

  static ChangeEvent apply(ChangeEvent event) {
    if (event == null) {
      return null;
    }
    final ObjectNode projection = (ObjectNode) JsonUtils.valueToTree(event);
    projection.set("entity", projectEntity(projection.get("entity")));
    projectChanges(projection);
    return JsonUtils.treeToValue(projection, ChangeEvent.class);
  }

  private static JsonNode projectEntity(JsonNode entity) {
    if (entity == null || entity.isNull()) {
      return null;
    }
    try {
      final JsonNode parsed = entity.isTextual() ? JsonUtils.readTree(entity.asText()) : entity;
      if (!(parsed instanceof ObjectNode snapshot)) {
        return null;
      }
      snapshot.remove(RUNTIME_SECRET_FIELDS);
      projectChanges(snapshot);
      return entity.isTextual() ? JsonUtils.valueToTree(JsonUtils.pojoToJson(snapshot)) : snapshot;
    } catch (JsonParsingException e) {
      return null;
    }
  }

  private static void projectChanges(ObjectNode node) {
    for (String description : DESCRIPTIONS) {
      for (String changes : CHANGES) {
        final JsonNode fields = node.path(description).path(changes);
        if (fields.isArray()) {
          final Iterator<JsonNode> iterator = fields.elements();
          while (iterator.hasNext()) {
            if (isRuntimeField(iterator.next().path("name").asText())) {
              iterator.remove();
            }
          }
        }
      }
    }
  }

  private static boolean isRuntimeField(String name) {
    return RUNTIME_SECRET_FIELDS.stream()
        .anyMatch(
            field ->
                name.equals(field)
                    || name.startsWith(field + ".")
                    || name.startsWith(field + "[")
                    || name.startsWith(field + "/"));
  }
}
