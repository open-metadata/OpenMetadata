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

import com.fasterxml.jackson.databind.JavaType;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import com.github.benmanes.caffeine.cache.Cache;
import com.github.benmanes.caffeine.cache.Caffeine;
import jakarta.json.JsonObject;
import jakarta.json.JsonPatch;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.Set;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.MetadataOperation;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.ResourceRegistry;
import org.openmetadata.service.security.policyevaluator.ResourceContextInterface;

/**
 * Decides which operations a JSON Patch needs. Every location an operation touches counts: its
 * {@code path} and, for {@code copy} and {@code move}, its {@code from}. A field name selects a
 * narrower operation than EditAll only where it is a declared field of the entity's type, not a key
 * of a map or of an untyped object. ADR:2026-11-03-a-patch-is-authorized-at-every-location-it-touches
 */
@Slf4j
public class JsonPatchUtils {
  private static final String FROM_MEMBER = "from";
  private static final String PATH_MEMBER = "path";
  private static final String OP_MEMBER = "op";
  private static final String TEST_OPERATION = "test";
  private static final String ROOT_POINTER = "/";
  private static final String TAGS_FIELD = "tags";
  private static final String DOMAINS_PATH = "/" + Entity.FIELD_DOMAINS;
  private static final String DOMAINS_PATH_PREFIX = DOMAINS_PATH + "/";
  private static final int MAX_INTROSPECTED_TYPES = 1000;

  // JSON field name -> declared type, per bean class; entity types and their nested types only.
  private static final Cache<Class<?>, Map<String, JavaType>> BEAN_FIELDS =
      Caffeine.newBuilder().maximumSize(MAX_INTROSPECTED_TYPES).build();

  private JsonPatchUtils() {}

  /**
   * Domains the entity will carry once {@code patch} is applied, or null when the patch leaves the
   * domain assignment alone. An update is authorized against the stored entity, so this is what lets
   * a caller re-run the decision against the domain an asset is moving into.
   *
   * <p>Takes the resource context rather than the entity so the patch is inspected before anything
   * is loaded: a patch that never mentions domains — nearly all of them — costs one scan of the
   * operation list and no entity resolution. A move or copy touches its "from" location as well
   * (ADR:2026-11-03-a-patch-is-authorized-at-every-location-it-touches).
   */
  public static List<EntityReference> getPatchedDomains(
      ResourceContextInterface resourceContext, JsonPatch patch) {
    if (resourceContext == null || patch == null || !patchTouchesDomains(patch)) {
      return null;
    }
    EntityInterface entity = resourceContext.getEntity();
    if (entity == null) {
      return null;
    }
    return readDomains(JsonUtils.applyPatch(entity, patch));
  }

  private static boolean patchTouchesDomains(JsonPatch patch) {
    return touchedLocations(patch).stream()
        .anyMatch(path -> path.equals(DOMAINS_PATH) || path.startsWith(DOMAINS_PATH_PREFIX));
  }

  private static List<EntityReference> readDomains(JsonValue patchedEntity) {
    JsonValue domains = patchedEntity.asJsonObject().get(Entity.FIELD_DOMAINS);
    return domains == null || domains.getValueType() == JsonValue.ValueType.NULL
        ? List.of()
        : JsonUtils.readObjects(domains.toString(), EntityReference.class);
  }

  public static Set<MetadataOperation> getMetadataOperations(
      ResourceContextInterface resourceContextInterface, JsonPatch jsonPatch) {
    Set<MetadataOperation> uniqueOperations = new HashSet<>();
    EntityInterface originalEntity = resourceContextInterface.getEntity();
    String resourceType = resourceContextInterface.getResource();
    Class<?> entityClass =
        originalEntity != null ? originalEntity.getClass() : entityClass(resourceType);
    boolean tagsAffected = false;

    for (JsonValue jsonValue : jsonPatch.toJsonArray()) {
      for (String location : touchedLocations(jsonValue)) {
        MetadataOperation metadataOperation =
            getMetadataOperation(location, resourceType, entityClass);
        if (metadataOperation.equals(MetadataOperation.EDIT_TAGS)) {
          tagsAffected = true;
        } else {
          uniqueOperations.add(metadataOperation);
        }
      }
    }
    if (uniqueOperations.contains(MetadataOperation.EDIT_ALL)) {
      // EditAll stands in for the other field operations: the seeded bot policies deny
      // EditDisplayName outright, and ingestion patches that rewrite the entity also fill in
      // display names. The label operations below are still added, so a deny conditioned on
      // tags applies whatever else the patch touches.
      uniqueOperations.retainAll(Set.of(MetadataOperation.EDIT_ALL));
    }
    if (tagsAffected && originalEntity == null) {
      // Without the entity there is no way to tell which labels change.
      uniqueOperations.addAll(Set.of(MetadataOperation.EDIT_ALL, MetadataOperation.EDIT_TAGS));
    } else if (tagsAffected) {
      Set<MetadataOperation> tagOperations = tagOperations(originalEntity, jsonPatch);
      // A patch that touches tags without changing a label still writes the entity.
      uniqueOperations.addAll(
          tagOperations.isEmpty() ? Set.of(MetadataOperation.EDIT_TAGS) : tagOperations);
      LOG.debug("Returning patch operations {}", uniqueOperations);
    }
    if (uniqueOperations.isEmpty()) {
      // An empty patch changes nothing, but its response carries the entity.
      uniqueOperations.add(MetadataOperation.VIEW_BASIC);
    }
    return uniqueOperations;
  }

  /**
   * The locations a patch operation touches: its {@code path} and, when present, its {@code
   * from}. A location that is missing or not a string is reported as the document root.
   */
  public static List<String> touchedLocations(JsonValue patchOperation) {
    if (!(patchOperation instanceof JsonObject operation)) {
      return List.of("");
    }
    List<String> locations = new ArrayList<>(2);
    locations.add(location(operation, PATH_MEMBER));
    if (operation.containsKey(FROM_MEMBER)) {
      locations.add(location(operation, FROM_MEMBER));
    }
    return locations;
  }

  /** Every location the operations of {@code jsonPatch} touch; see {@link #touchedLocations}. */
  public static List<String> touchedLocations(JsonPatch jsonPatch) {
    List<String> locations = new ArrayList<>();
    for (JsonValue operation : jsonPatch.toJsonArray()) {
      locations.addAll(touchedLocations(operation));
    }
    return locations;
  }

  private static String location(JsonObject operation, String member) {
    return operation.get(member) instanceof JsonString value ? value.getString() : "";
  }

  /**
   * Whether an operation of {@code jsonPatch} reads a value from another location of the document,
   * as {@code copy} and {@code move} do through their {@code from} member.
   */
  public static boolean readsFromAnotherPath(JsonPatch jsonPatch) {
    // jakarta JsonPatch exposes its operations as untyped JsonValues; each operation is a JSON
    // object.
    return jsonPatch.toJsonArray().stream()
        .anyMatch(
            operation -> operation instanceof JsonObject object && object.containsKey(FROM_MEMBER));
  }

  /** Whether an operation of {@code jsonPatch} reads a value from under {@code pointerPrefix}. */
  public static boolean readsFrom(JsonPatch jsonPatch, String pointerPrefix) {
    return jsonPatch.toJsonArray().stream()
        .filter(
            operation -> operation instanceof JsonObject object && object.containsKey(FROM_MEMBER))
        .map(operation -> location(operation.asJsonObject(), FROM_MEMBER))
        .anyMatch(from -> isAtOrUnder(from, pointerPrefix));
  }

  /**
   * Whether {@code location} is {@code pointer}, lies under it, or is the document root, which
   * contains it.
   */
  public static boolean isAtOrUnder(String location, String pointer) {
    return location.isEmpty()
        || ROOT_POINTER.equals(location)
        || location.equals(pointer)
        || location.startsWith(pointer + ROOT_POINTER);
  }

  /**
   * Whether an operation of {@code jsonPatch} writes the document root ({@code ""} or {@code "/"}),
   * so it can change any field. {@link JsonUtils#extractPatchedFields} skips root paths, which makes
   * a root replace bundled with, say, a {@code /description} edit look like a description edit alone;
   * a check that keys off the patched fields must ask this as well. A {@code test} operation only
   * reads the document, so a root {@code test} does not count.
   */
  public static boolean replacesWholeDocument(JsonPatch jsonPatch) {
    return jsonPatch.toJsonArray().stream()
        .anyMatch(
            operation -> {
              if (!(operation instanceof JsonObject object)
                  || TEST_OPERATION.equals(object.getString(OP_MEMBER, null))) {
                return false;
              }
              String path = object.getString(PATH_MEMBER, null);
              return path == null || path.isEmpty() || ROOT_POINTER.equals(path);
            });
  }

  /**
   * The tag operations a patch needs: one per label that it adds or removes, where a label is
   * compared together with the object that carries it, so moving a label counts as removing it
   * from one place and adding it to another. The patched entity is built with the call {@code
   * EntityRepository} stores through, so the labels compared are the labels written.
   */
  @SuppressWarnings("unchecked")
  private static Set<MetadataOperation> tagOperations(
      EntityInterface originalEntity, JsonPatch jsonPatch) {
    EntityInterface patchedEntity =
        JsonUtils.applyPatch(
            originalEntity, jsonPatch, (Class<EntityInterface>) originalEntity.getClass());
    Set<LocatedTag> originalTags = locatedTags(JsonUtils.pojoToJsonNode(originalEntity));
    Set<LocatedTag> patchedTags = locatedTags(JsonUtils.pojoToJsonNode(patchedEntity));
    Set<MetadataOperation> operations = new HashSet<>();
    for (LocatedTag tag : patchedTags) {
      if (!originalTags.contains(tag)) {
        operations.add(mapTagToOperation(tag.tag()));
      }
    }
    for (LocatedTag tag : originalTags) {
      if (!patchedTags.contains(tag)) {
        operations.add(mapTagToOperation(tag.tag()));
      }
    }
    return operations;
  }

  /** A tag label and the JSON pointer of the object whose {@code tags} carry it. */
  private record LocatedTag(String owner, TagLabel tag) {}

  private static Set<LocatedTag> locatedTags(JsonNode entityJson) {
    Set<LocatedTag> tags = new HashSet<>();
    collectTags(entityJson, "", tags);
    return tags;
  }

  private static void collectTags(JsonNode node, String pointer, Set<LocatedTag> tags) {
    if (node == null || node.isNull()) {
      return;
    }
    if (node.isObject()) {
      JsonNode tagArray = node.get(TAGS_FIELD);
      if (tagArray != null && tagArray.isArray()) {
        for (JsonNode tagNode : tagArray) {
          TagLabel tag = tagLabel(tagNode);
          if (tag != null) {
            tags.add(new LocatedTag(pointer, tag));
          }
        }
      }
      Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
      while (fields.hasNext()) {
        Map.Entry<String, JsonNode> field = fields.next();
        collectTags(field.getValue(), pointer + ROOT_POINTER + escape(field.getKey()), tags);
      }
    } else if (node.isArray()) {
      for (int i = 0; i < node.size(); i++) {
        collectTags(node.get(i), pointer + ROOT_POINTER + i, tags);
      }
    }
  }

  // Both entities come from typed objects, so every label of a declared tags field binds; what does
  // not bind is a "tags" key of an untyped object, which carries no labels.
  private static TagLabel tagLabel(JsonNode tagNode) {
    try {
      return JsonUtils.treeToValue(tagNode, TagLabel.class);
    } catch (RuntimeException e) {
      LOG.debug("Not a tag label: {}", tagNode);
      return null;
    }
  }

  private static String escape(String key) {
    return key.replace("~", "~0").replace("/", "~1");
  }

  /**
   * The operation adding or removing {@code tag} needs. A glossary term needs EditGlossaryTerms
   * whatever its name; Tier and Certification are read from the FQN of any other label, including
   * labels decoded from a task without their source.
   */
  public static MetadataOperation mapTagToOperation(TagLabel tag) {
    if (tag == null) {
      return null;
    }
    if (tag.getSource() == TagLabel.TagSource.GLOSSARY) {
      return MetadataOperation.EDIT_GLOSSARY_TERMS;
    }
    if (isTierClassification(tag.getTagFQN())) {
      return MetadataOperation.EDIT_TIER;
    }
    if (isCertificationClassification(tag.getTagFQN())) {
      return MetadataOperation.EDIT_CERTIFICATION;
    }
    return tag.getSource() == TagLabel.TagSource.CLASSIFICATION
        ? MetadataOperation.EDIT_TAGS
        : MetadataOperation.EDIT_ALL;
  }

  private static boolean isTierClassification(String tagFQN) {
    return tagFQN != null && tagFQN.startsWith("Tier.");
  }

  private static boolean isCertificationClassification(String tagFQN) {
    return tagFQN != null && tagFQN.startsWith("Certification.");
  }

  public static MetadataOperation getMetadataOperation(String path) {
    return getMetadataOperation(path, null);
  }

  /** The operation needed to write {@code path} of an entity of {@code resourceType}. */
  public static MetadataOperation getMetadataOperation(String path, String resourceType) {
    return getMetadataOperation(path, resourceType, entityClass(resourceType));
  }

  private static MetadataOperation getMetadataOperation(
      String path, String resourceType, Class<?> entityClass) {
    return entityClass == null
        ? operationByFieldName(path, resourceType)
        : operationByDeclaredField(path, resourceType, entityClass);
  }

  private static Class<?> entityClass(String resourceType) {
    if (resourceType == null) {
      return null;
    }
    try {
      return Entity.getEntityClassFromType(resourceType);
    } catch (RuntimeException e) {
      return null;
    }
  }

  // Without a type to walk, the first mapped field name decides.
  private static MetadataOperation operationByFieldName(String path, String resourceType) {
    for (String segment : path.split(ROOT_POINTER)) {
      MetadataOperation operation = ResourceRegistry.getEntityEditOperation(resourceType, segment);
      if (operation != null) {
        return operation;
      }
    }
    LOG.debug("No specific operation for patch path {}", path);
    return MetadataOperation.EDIT_ALL;
  }

  private static MetadataOperation operationByDeclaredField(
      String path, String resourceType, Class<?> entityClass) {
    JavaType type = JsonUtils.getObjectMapper().constructType(entityClass);
    for (String segment : pointerSegments(path)) {
      if (type.isCollectionLikeType() || type.isArrayType()) {
        type = type.getContentType();
        continue;
      }
      JavaType fieldType = declaredFields(type).get(segment);
      if (fieldType == null) {
        // A map key, a key of an untyped object, or a field the type does not declare.
        return MetadataOperation.EDIT_ALL;
      }
      MetadataOperation operation = ResourceRegistry.getEntityEditOperation(resourceType, segment);
      if (operation != null) {
        return operation;
      }
      type = fieldType;
    }
    LOG.debug("No specific operation for patch path {}", path);
    return MetadataOperation.EDIT_ALL;
  }

  private static List<String> pointerSegments(String path) {
    if (path.isEmpty()) {
      return List.of();
    }
    String[] parts = path.substring(path.startsWith(ROOT_POINTER) ? 1 : 0).split(ROOT_POINTER, -1);
    List<String> segments = new ArrayList<>(parts.length);
    for (String part : parts) {
      segments.add(part.replace("~1", "/").replace("~0", "~"));
    }
    return segments;
  }

  private static Map<String, JavaType> declaredFields(JavaType type) {
    if (!isBean(type)) {
      return Map.of();
    }
    return BEAN_FIELDS.get(type.getRawClass(), raw -> introspect(type));
  }

  private static boolean isBean(JavaType type) {
    Class<?> raw = type.getRawClass();
    String name = raw.getName();
    return !type.isContainerType()
        && !type.isPrimitive()
        && !raw.isEnum()
        && !raw.isInterface()
        && raw != Object.class
        && !name.startsWith("java.")
        && !name.startsWith("javax.")
        && !name.startsWith("jakarta.")
        && !name.startsWith("com.fasterxml.");
  }

  private static Map<String, JavaType> introspect(JavaType type) {
    Map<String, JavaType> fields = new HashMap<>();
    for (BeanPropertyDefinition property :
        JsonUtils.getObjectMapper().getDeserializationConfig().introspect(type).findProperties()) {
      fields.put(property.getName(), property.getPrimaryType());
    }
    return Map.copyOf(fields);
  }
}
