package org.openmetadata.service.audit;

import static org.openmetadata.service.jdbi3.AppRepository.RUNTIME_SECRET_FIELDS;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
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
      if (node.path(description) instanceof ObjectNode changeDescription) {
        projectChangeDescription(changeDescription);
      }
    }
  }

  private static void projectChangeDescription(ObjectNode description) {
    for (String changes : CHANGES) {
      if (description.path(changes) instanceof ArrayNode fields) {
        description.set(changes, projectFields(fields));
      }
    }
  }

  private static ArrayNode projectFields(ArrayNode fields) {
    final ArrayNode projected = fields.arrayNode(fields.size());
    for (JsonNode field : fields) {
      if (!isRuntimeField(field.path("name").asText())) {
        projected.add(field);
      }
    }
    return projected;
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
