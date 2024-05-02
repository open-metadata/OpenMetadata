package org.openmetadata.service.search;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collections;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.TagLabel;

public final class SearchIndexUtils {

  private SearchIndexUtils() {}

  public static List<String> parseFollowers(List<EntityReference> followersRef) {
    if (followersRef == null) {
      return Collections.emptyList();
    }
    return followersRef.stream().map(item -> item.getId().toString()).toList();
  }

  public static void removeNonIndexableFields(Map<String, Object> doc, Set<String> fields) {
    for (String key : fields) {
      doc.remove(key);
    }
  }

  public static void removeAllNonIndexableFields(JsonNode rootNode, Set<String> fields) {
    for (String key : fields) {
      removeFieldRecursively(rootNode, key);
    }
  }

  private static void removeFieldRecursively(JsonNode node, String fieldName) {
    if (node.isObject()) {
      ObjectNode objectNode = (ObjectNode) node;
      Iterator<Map.Entry<String, JsonNode>> fieldsIterator = objectNode.fields();
      while (fieldsIterator.hasNext()) {
        Map.Entry<String, JsonNode> field = fieldsIterator.next();
        if (field.getKey().equals(fieldName)) {
          fieldsIterator.remove(); // Remove the field
        } else {
          removeFieldRecursively(
              field.getValue(), fieldName); // Recursively remove from nested objects
        }
      }
    } else if (node.isArray()) {
      for (JsonNode arrayElement : node) {
        removeFieldRecursively(arrayElement, fieldName); // Recursively remove from array elements
      }
    }
  }

  public static List<TagLabel> parseTags(List<TagLabel> tags) {
    if (tags == null) {
      return Collections.emptyList();
    }
    return tags;
  }
}
