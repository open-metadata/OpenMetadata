package org.openmetadata.service.search;

import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;
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
      if (key.contains(".")) {
        removeFieldByPath(doc, key);
      } else {
        doc.remove(key);
      }
    }
  }

  public static void removeFieldByPath(Map<String, Object> jsonMap, String path) {
    String[] pathElements = path.split("\\.");
    Map<String, Object> currentMap = jsonMap;

    String key = pathElements[0];
    Object value = currentMap.get(key);
    if (value instanceof Map) {
      currentMap = (Map<String, Object>) value;
    } else if (value instanceof List) {
      List<Map<String, Object>> list = (List<Map<String, Object>>) value;
      for (Map<String, Object> item : list) {
        removeFieldByPath(
            item,
            Arrays.stream(pathElements, 1, pathElements.length).collect(Collectors.joining(".")));
      }
      return;
    } else {
      return;
    }

    // Remove the field at the last path element
    String lastKey = pathElements[pathElements.length - 1];
    currentMap.remove(lastKey);
  }

  /*
    * Build the aggregation string for the given aggregation
    *
    * @param aggregation the aggregation to build the string for.
    *   The aggregation string is in the form
    * `bucketName:aggType:key=value&key=value,bucketName:aggType:key=value&key=value;bucketName:aggType:key=value&key=value`
    * where `,` represents a nested aggregation and `;` represents a sibling aggregation
    * @return the aggregation string
  */
  public static String buildAggregationString(String aggregation) {
    StringBuilder aggregationString = new StringBuilder();
    List<String> siblings = Arrays.stream(aggregation.split(";")).toList();
    int outterOpened = 0;
    for (String sibling : siblings) {
      List<String> nested = Arrays.stream(sibling.split(",")).toList();
      for (String nest : nested) {
        List<String> parts = Arrays.stream(nest.split(":")).toList();
        StringBuilder partString = new StringBuilder();
        int innerOpened = 0;
        for (String part : parts) {
            if (!part.contains("&") && !part.contains("=")) {
                partString.append("\"" + part + "\"").append(":{");
                innerOpened++;
            } else {
                List<String> kvs = Arrays.stream(part.split("&")).toList();
                for (String kv : kvs) {
                    List<String> keyValue = Arrays.stream(kv.split("=")).toList();
                    if (kvs.indexOf(kv) != 0) {
                      partString.append(",");
                    }
                    partString.append("\"").append(keyValue.get(0)).append("\"").append(":").append("\"").append(keyValue.get(1)).append("\"");
                }
                partString.append("}".repeat(Math.max(0, innerOpened)));
                innerOpened = 0;
            }
        }
        if (nested.indexOf(nest) == 0) {
            aggregationString.append(partString);
        } else {
            aggregationString.append(",")
                    .append("\"aggs\":{")
                    .append(partString);
            outterOpened++;
        }
      }
      aggregationString.append("}".repeat(Math.max(0, outterOpened)));
    }
    return aggregationString.toString();
  }

  public static List<TagLabel> parseTags(List<TagLabel> tags) {
    if (tags == null) {
      return Collections.emptyList();
    }
    return tags;
  }
}
