/*
 *  Copyright 2021 Collate
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

package org.openmetadata.service.util;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import javax.json.JsonPatch;
import javax.json.JsonValue;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
public class JsonPatchUtils {
  private JsonPatchUtils() {}

  public static Set<MetadataOperation> getMetadataOperations(
      ResourceContextInterface resourceContextInterface, JsonPatch jsonPatch) {
    Set<MetadataOperation> uniqueOperations = new HashSet<>();
    for (JsonValue jsonValue : jsonPatch.toJsonArray()) {
      Set<MetadataOperation> operations =
          getOperationsForPatch(jsonValue, resourceContextInterface.getEntity());
      if (operations.contains(MetadataOperation.EDIT_ALL)) {
        return Collections.singleton(MetadataOperation.EDIT_ALL);
      }
      uniqueOperations.addAll(operations);
    }
    LOG.debug("Returning patch operations {}", uniqueOperations);
    return uniqueOperations;
  }

  private static Set<MetadataOperation> getOperationsForPatch(
      JsonValue jsonValue, EntityInterface entity) {
    Map<String, Object> jsonPatchMap = JsonUtils.getMap(jsonValue);
    String path = jsonPatchMap.get("path").toString();
    String operation = jsonPatchMap.get("op").toString();
    Object value = jsonPatchMap.get("value");

    // Split and clean the path
    String[] pathParts =
        Arrays.stream(path.split("/")).filter(s -> !s.isEmpty()).toArray(String[]::new);

    if (containsPathSegment(pathParts, "tags")) {
      // Handle tag modifications at any level
      if ("remove".equalsIgnoreCase(operation)) {
        return getOperationsForTagRemoval(entity, pathParts);
      } else if ("add".equalsIgnoreCase(operation)) {
        return getOperationsForTagAddition(value);
      } else if ("replace".equalsIgnoreCase(operation)) {
        return getOperationsForTagReplacement(entity, pathParts, value);
      }
    } else {
      // Handle other fields
      MetadataOperation op = getMetadataOperation(path);
      return Collections.singleton(op);
    }
    return Collections.emptySet();
  }

  private static boolean containsPathSegment(String[] pathParts, String segment) {
    for (String part : pathParts) {
      if (segment.equals(part)) {
        return true;
      }
    }
    return false;
  }

  private static Set<MetadataOperation> getOperationsForTagRemoval(
      EntityInterface entity, String[] pathParts) {
    Set<MetadataOperation> operations = new HashSet<>();

    TagLabel tagLabel = getTagLabelFromEntity(entity, pathParts);
    if (tagLabel != null) {
      if ("Classification".equals(tagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_TAGS);
      } else if ("Glossary".equals(tagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
      } else {
        operations.add(MetadataOperation.EDIT_ALL);
      }
    } else {
      // Unable to retrieve tag, conservative approach
      operations.add(MetadataOperation.EDIT_ALL);
    }

    return operations;
  }

  private static Set<MetadataOperation> getOperationsForTagAddition(Object value) {
    Set<MetadataOperation> operations = new HashSet<>();

    if (value instanceof Map) {
      Map<String, Object> valueMap = (Map<String, Object>) value;
      String source = (String) valueMap.get("source");
      if ("Classification".equals(source)) {
        operations.add(MetadataOperation.EDIT_TAGS);
      } else if ("Glossary".equals(source)) {
        operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
      }
    }
    return operations;
  }

  private static Set<MetadataOperation> getOperationsForTagReplacement(
      EntityInterface entity, String[] pathParts, Object newValue) {
    Set<MetadataOperation> operations = new HashSet<>();
    TagLabel oldTagLabel = getTagLabelFromEntity(entity, getTagLabelPath(pathParts));
    TagLabel newTagLabel = null;
    if (newValue instanceof Map) {
      newTagLabel = JsonUtils.convertValue(newValue, TagLabel.class);
    } else {
      // For primitive values (e.g., replacing a single field of the tag), we need to reconstruct
      // the new TagLabel
      newTagLabel = reconstructTagLabel(entity, pathParts, newValue);
    }

    if (oldTagLabel != null && newTagLabel != null) {
      if (tagsAreEqual(oldTagLabel, newTagLabel)) {
        return operations;
      } else {
        String source = oldTagLabel.getSource().toString();
        if ("Classification".equalsIgnoreCase(source)) {
          operations.add(MetadataOperation.EDIT_TAGS);
        } else if ("Glossary".equalsIgnoreCase(source)) {
          operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
        } else {
          operations.add(MetadataOperation.EDIT_TAGS);
          operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
        }
      }
    } else {
      operations.add(MetadataOperation.EDIT_TAGS);
      operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
    }

    return operations;
  }

  private static boolean tagsAreEqual(TagLabel tag1, TagLabel tag2) {
    return tag1.getTagFQN().equals(tag2.getTagFQN()) && tag1.getSource().equals(tag2.getSource());
  }

  private static TagLabel reconstructTagLabel(
      EntityInterface entity, String[] pathParts, Object newValue) {

    String[] tagLabelPath = getTagLabelPath(pathParts);
    TagLabel oldTagLabel = getTagLabelFromEntity(entity, tagLabelPath);
    if (oldTagLabel == null) {
      return null;
    }

    TagLabel newTagLabel = JsonUtils.deepCopy(oldTagLabel, TagLabel.class);
    String fieldName = pathParts[pathParts.length - 1];

    switch (fieldName) {
      case "tagFQN":
        newTagLabel.setTagFQN(newValue.toString());
        break;
      case "source":
        newTagLabel.setSource(TagLabel.TagSource.fromValue(newValue.toString()));
        break;
      case "labelType":
        newTagLabel.setLabelType(TagLabel.LabelType.fromValue(newValue.toString()));
        break;
      case "state":
        newTagLabel.setState(TagLabel.State.fromValue(newValue.toString()));
        break;
      default:
        return null;
    }

    return newTagLabel;
  }

  private static String[] getTagLabelPath(String[] pathParts) {
    List<String> tagPath = new ArrayList<>();
    for (int i = 0; i < pathParts.length; i++) {
      tagPath.add(pathParts[i]);
      if ("tags".equals(pathParts[i])) {
        if (i + 1 < pathParts.length) {
          // Include the index after "tags"
          tagPath.add(pathParts[i + 1]);
        }
        break;
      }
    }
    return tagPath.toArray(new String[0]);
  }

  private static TagLabel getTagLabelFromEntity(EntityInterface entity, String[] pathParts) {
    // Construct the JSON Pointer path to the TagLabel
    String jsonPointerPath = "/" + String.join("/", pathParts);

    try {
      JsonNode entityNode = JsonUtils.getObjectMapper().valueToTree(entity);
      JsonNode tagNode = entityNode.at(jsonPointerPath);

      if (tagNode.isMissingNode() || tagNode.isNull()) {
        return null;
      }

      return JsonUtils.getObjectMapper().treeToValue(tagNode, TagLabel.class);
    } catch (JsonProcessingException e) {
      return null;
    }
  }

  private static Set<MetadataOperation> getOperationsForModifiedTags(Object value) {
    Set<MetadataOperation> operations = new HashSet<>();

    if (value == null) {
      // No value to inspect, so no operations are required
      return operations;
    }

    List<TagLabel> tagLabels = extractTagLabels(value);

    for (TagLabel tagLabel : tagLabels) {
      if ("Classification".equals(tagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_TAGS);
      } else if ("Glossary".equals(tagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
      }
    }

    return operations;
  }

  private static Set<MetadataOperation> getOperationsForRemovedTags(
      EntityInterface entity, List<String> pathList) {
    Set<MetadataOperation> operations = new HashSet<>();

    TagLabel removedTagLabel = getTagLabelFromEntity(entity, pathList);
    if (removedTagLabel != null) {
      if ("Classification".equals(removedTagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_TAGS);
      } else if ("Glossary".equals(removedTagLabel.getSource())) {
        operations.add(MetadataOperation.EDIT_GLOSSARY_TERMS);
      }
    }

    return operations;
  }

  private static List<TagLabel> extractTagLabels(Object value) {
    List<TagLabel> tagLabels = new ArrayList<>();

    if (value instanceof Map) {
      Map<String, Object> mapValue = (Map<String, Object>) value;
      extractTagLabelsFromMap(mapValue, tagLabels);
    } else if (value instanceof List) {
      List<Object> valueList = (List<Object>) value;
      for (Object item : valueList) {
        tagLabels.addAll(extractTagLabels(item));
      }
    }
    // Handle other types if necessary

    return tagLabels;
  }

  private static void extractTagLabelsFromMap(Map<String, Object> map, List<TagLabel> tagLabels) {
    if (map.containsKey("tagFQN") && map.containsKey("source")) {
      // This is a TagLabel
      TagLabel tagLabel = JsonUtils.convertValue(map, TagLabel.class);
      tagLabels.add(tagLabel);
    } else {
      // Recursively search for TagLabels in nested structures
      for (Object value : map.values()) {
        tagLabels.addAll(extractTagLabels(value));
      }
    }
  }

  private static TagLabel getTagLabelFromEntity(EntityInterface entity, List<String> pathList) {
    String jsonPointerPath = "/" + String.join("/", pathList);

    try {
      JsonNode entityNode = JsonUtils.getObjectMapper().valueToTree(entity);
      JsonNode tagNode = entityNode.at(jsonPointerPath);
      if (tagNode.isMissingNode() || tagNode.isNull()) {
        return null;
      }

      return JsonUtils.getObjectMapper().treeToValue(tagNode, TagLabel.class);
    } catch (JsonProcessingException e) {
      throw new RuntimeException(e);
    }
  }

  public static String getPath(String path) {
    return Arrays.stream(path.split("/")).filter(part -> !part.isEmpty()).findFirst().orElse(path);
  }

  // Its important that we parse the path from starting down to end
  // In case of /owners/0/displayName we should see if the user has permission to EDIT_OWNERS
  // If not, we will end up returning user does not have permission to edit the displayName
  public static MetadataOperation getMetadataOperation(String path) {
    String[] paths = path.contains("/") ? path.split("/") : new String[] {path};
    for (String p : paths) {
      if (ResourceRegistry.hasEditOperation(p)) {
        return ResourceRegistry.getEditOperation(p);
      }
    }
    LOG.warn("Failed to find specific operation for patch path {}", path);
    return MetadataOperation
        .EDIT_ALL; // If path is not mapped to any edit field, then return edit all
  }
}
