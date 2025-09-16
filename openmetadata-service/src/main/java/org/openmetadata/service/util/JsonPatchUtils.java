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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.github.fge.jsonpatch.JsonPatchException;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

@Slf4j
public class JsonPatchUtils {
  private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

  private JsonPatchUtils() {}

  public static Set<MetadataOperation> getMetadataOperations(
      ResourceContextInterface resourceContextInterface, JsonPatch jsonPatch) {
    Set<MetadataOperation> uniqueOperations = new HashSet<>();
    EntityInterface originalEntity = resourceContextInterface.getEntity();
    boolean tagsAffected = false;

    for (JsonValue jsonValue : jsonPatch.toJsonArray()) {
      MetadataOperation metadataOperation = getMetadataOperation(jsonValue);
      if (metadataOperation.equals(MetadataOperation.EDIT_ALL)) {
        return Collections.singleton(MetadataOperation.EDIT_ALL);
      }
      if (metadataOperation.equals(MetadataOperation.EDIT_TAGS)) {
        tagsAffected = true;
      } else {
        uniqueOperations.add(metadataOperation);
      }
    }
    if (tagsAffected) {
      try {
        JsonNode originalEntityJson = JsonUtils.pojoToJsonNode(originalEntity);
        JsonNode patchedEntityJson = applyPatch(originalEntityJson, jsonPatch);
        Set<TagLabel> originalTags = extractTags(originalEntityJson);
        Set<TagLabel> patchedTags = extractTags(patchedEntityJson);
        Set<TagLabel> addedTags = new HashSet<>(patchedTags);
        addedTags.removeAll(originalTags);

        Set<TagLabel> removedTags = new HashSet<>(originalTags);
        removedTags.removeAll(patchedTags);

        for (TagLabel addedTag : addedTags) {
          uniqueOperations.add(mapTagToOperation(addedTag));
        }
        for (TagLabel removedTag : removedTags) {
          uniqueOperations.add(mapTagToOperation(removedTag));
        }
        LOG.debug("Returning patch operations {}", uniqueOperations);
      } catch (JsonPatchException | IOException e) {
        LOG.error("Failed to process JSON Patch for MetadataOperations", e);
        throw new RuntimeException("Error processing JSON Patch", e);
      }
    }

    return uniqueOperations;
  }

  private static JsonNode applyPatch(JsonNode targetJson, JsonPatch patch)
      throws JsonPatchException, IOException {
    String patchString = patch.toString();
    JsonNode patchNode = OBJECT_MAPPER.readTree(patchString);
    com.github.fge.jsonpatch.JsonPatch jacksonPatch =
        com.github.fge.jsonpatch.JsonPatch.fromJson(patchNode);
    return jacksonPatch.apply(targetJson);
  }

  private static Set<TagLabel> extractTags(JsonNode entityJson) {
    Set<TagLabel> tags = new HashSet<>();
    traverseForTags(entityJson, tags);
    return tags;
  }

  private static void traverseForTags(JsonNode node, Set<TagLabel> tags) {
    if (node == null || node.isNull()) {
      return;
    }

    if (node.isObject()) {
      if (node.has("tags") && node.get("tags").isArray()) {
        for (JsonNode tagNode : node.get("tags")) {
          try {
            TagLabel tag = OBJECT_MAPPER.treeToValue(tagNode, TagLabel.class);
            tags.add(tag);
          } catch (JsonProcessingException e) {
            LOG.warn("Failed to parse TagLabel from node: {}", tagNode, e);
          }
        }
      }

      Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
      while (fields.hasNext()) {
        Map.Entry<String, JsonNode> entry = fields.next();
        traverseForTags(entry.getValue(), tags);
      }
    } else if (node.isArray()) {
      for (JsonNode arrayItem : node) {
        traverseForTags(arrayItem, tags);
      }
    }
  }

  private static MetadataOperation mapTagToOperation(TagLabel tag) {
    if (tag == null) {
      return null;
    }
    String source = tag.getSource().value();
    String tagFQN = tag.getTagFQN();
    if (isTierClassification(tagFQN)) {
      return MetadataOperation.EDIT_TIER;
    } else if (isCertificationClassification(tagFQN)) {
      return MetadataOperation.EDIT_CERTIFICATION;
    } else if ("Classification".equalsIgnoreCase(source)) {
      return MetadataOperation.EDIT_TAGS;
    } else if ("Glossary".equalsIgnoreCase(source)) {
      return MetadataOperation.EDIT_GLOSSARY_TERMS;
    }
    // Default to EDIT_ALL if the tag is not recognized
    return MetadataOperation.EDIT_ALL;
  }

  private static boolean isTierClassification(String tagFQN) {
    return tagFQN != null && tagFQN.startsWith("Tier.");
  }

  private static boolean isCertificationClassification(String tagFQN) {
    return tagFQN != null && tagFQN.startsWith("Certification.");
  }

  public static MetadataOperation getMetadataOperation(Object jsonPatchObject) {
    String path;

    // Handle jakarta JSON patch objects efficiently
    if (jsonPatchObject instanceof JsonObject) {
      JsonObject jsonPatchObj = (JsonObject) jsonPatchObject;
      JsonValue pathValue = jsonPatchObj.get("path");
      if (pathValue instanceof JsonString) {
        path = ((JsonString) pathValue).getString();
      } else {
        path = pathValue.toString();
      }
    } else {
      // Fallback for other object types
      Map<String, Object> jsonPatchMap = JsonUtils.getMap(jsonPatchObject);
      path = jsonPatchMap.get("path").toString();
    }

    return getMetadataOperation(path);
  }

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
