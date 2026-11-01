/*
 *  Copyright 2026 Collate
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

package org.openmetadata.service.secrets.converter;

import com.fasterxml.jackson.databind.JsonNode;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

final class JsonSchemaRepository {
  private static final String ROOT = "json/schema/";
  private static final String JAVA_TYPE = "javaType";
  private static final JsonSchemaRepository INSTANCE = new JsonSchemaRepository();

  private final Map<String, JsonNode> schemas;
  private final Map<String, Ref> types;

  record Ref(JsonNode node, String path) {}

  private JsonSchemaRepository() {
    Map<String, JsonNode> loadedSchemas = new TreeMap<>();
    try (ScanResult scan = new ClassGraph().acceptPaths(ROOT).scan()) {
      for (Resource resource : scan.getResourcesWithExtension("json")) {
        loadedSchemas.put(resource.getPath(), read(resource));
      }
    }
    schemas = Collections.unmodifiableMap(loadedSchemas);
    types = indexTypes(loadedSchemas);
  }

  static JsonSchemaRepository getInstance() {
    return INSTANCE;
  }

  Ref schemaFor(Class<?> clazz) {
    return types.get(clazz.getName());
  }

  Ref property(Ref schema, String propertyName) {
    JsonNode property = schema.node().path("properties").get(propertyName);
    return property == null ? null : new Ref(property, schema.path());
  }

  Ref resolveToOneOf(Ref property) {
    JsonNode node = property.node();
    String base = property.path();
    for (int depth = 0; depth < 16 && node != null; depth++) {
      if (node.has("properties")) {
        return null;
      }
      if (node.has("oneOf") || node.has("anyOf")) {
        return new Ref(node, base);
      }
      String ref = node.path("$ref").asText("");
      if (ref.isEmpty()) {
        return null;
      }
      Ref resolved = resolve(ref, base);
      if (resolved == null) {
        return null;
      }
      node = resolved.node();
      base = resolved.path();
    }
    return null;
  }

  List<Ref> branches(Ref oneOf) {
    JsonNode branches =
        oneOf.node().has("oneOf") ? oneOf.node().get("oneOf") : oneOf.node().get("anyOf");
    List<Ref> resolvedBranches = new ArrayList<>();
    for (JsonNode branch : branches) {
      String ref = branch.path("$ref").asText("");
      Ref resolved = ref.isEmpty() ? new Ref(branch, oneOf.path()) : resolve(ref, oneOf.path());
      if (resolved != null) {
        resolvedBranches.add(resolved);
      }
    }
    return resolvedBranches;
  }

  boolean matchesDiscriminator(Ref schema, Object value) {
    if (!(value instanceof Map<?, ?> map)) {
      return true;
    }
    for (Map.Entry<String, JsonNode> property : schema.node().path("properties").properties()) {
      JsonNode definition = property.getValue();
      String ref = definition.path("$ref").asText("");
      if (!ref.isEmpty()) {
        Ref resolved = resolve(ref, schema.path());
        definition = resolved == null ? definition : resolved.node();
      }
      JsonNode expected = discriminatorValue(definition);
      if (expected != null && map.containsKey(property.getKey())) {
        Object actual = map.get(property.getKey());
        if (actual == null || !expected.asText().equals(actual.toString())) {
          return false;
        }
      }
    }
    return true;
  }

  private JsonNode discriminatorValue(JsonNode definition) {
    if (definition.has("const")) {
      return definition.get("const");
    }
    JsonNode values = definition.path("enum");
    return values.size() == 1 ? values.get(0) : null;
  }

  Class<?> javaClass(Ref schema) {
    String javaType = schema.node().path(JAVA_TYPE).asText("");
    if (javaType.isEmpty() && schema.node() == schemas.get(schema.path())) {
      javaType = inferredRootJavaType(schema);
    }
    if (javaType.isEmpty()) {
      return null;
    }
    try {
      return Class.forName(javaType);
    } catch (ClassNotFoundException e) {
      return null;
    }
  }

  boolean containsPasswordFormat(Ref schema) {
    Deque<Ref> queue = new ArrayDeque<>();
    Set<String> visited = new HashSet<>();
    queue.add(schema);
    while (!queue.isEmpty()) {
      Ref current = queue.poll();
      JsonNode value = current.node();
      if (value == null || !value.isObject()) {
        continue;
      }
      if ("password".equals(value.path("format").asText(""))) {
        return true;
      }
      String ref = value.path("$ref").asText("");
      if (!ref.isEmpty()) {
        if (visited.add(current.path() + "|" + ref)) {
          Ref resolved = resolve(ref, current.path());
          if (resolved != null) {
            queue.add(resolved);
          }
        }
        continue;
      }
      for (String keyword : List.of("oneOf", "anyOf", "allOf")) {
        value.path(keyword).forEach(branch -> queue.add(new Ref(branch, current.path())));
      }
      value.path("properties").forEach(child -> queue.add(new Ref(child, current.path())));
      if (value.path("items").isObject()) {
        queue.add(new Ref(value.get("items"), current.path()));
      }
    }
    return false;
  }

  private Ref resolve(String ref, String base) {
    int hash = ref.indexOf('#');
    String filePart = hash >= 0 ? ref.substring(0, hash) : ref;
    String fragment = hash >= 0 ? ref.substring(hash + 1) : "";
    String targetPath = filePart.isEmpty() ? base : normalize(base, filePart);
    JsonNode node = schemas.get(targetPath);
    if (node == null) {
      return null;
    }
    for (String segment : fragment.split("/")) {
      if (!segment.isEmpty()) {
        node = node.path(segment);
      }
    }
    return node.isMissingNode() ? null : new Ref(node, targetPath);
  }

  private Map<String, Ref> indexTypes(Map<String, JsonNode> loadedSchemas) {
    Map<String, Ref> indexedTypes = new HashMap<>();
    loadedSchemas.forEach(
        (path, schema) -> {
          indexType(schema, path, indexedTypes);
          indexNestedTypes(schema, path, indexedTypes);
        });
    return Collections.unmodifiableMap(indexedTypes);
  }

  private void indexType(JsonNode schema, String path, Map<String, Ref> types) {
    Ref ref = new Ref(schema, path);
    String javaType = schema.path(JAVA_TYPE).asText("");
    if (javaType.isEmpty()) {
      javaType = inferredRootJavaType(ref);
    }
    types.put(javaType, ref);
  }

  private void indexNestedTypes(JsonNode node, String path, Map<String, Ref> types) {
    if (node.isObject()) {
      String javaType = node.path(JAVA_TYPE).asText("");
      if (!javaType.isEmpty()) {
        types.put(javaType, new Ref(node, path));
      }
      node.forEach(child -> indexNestedTypes(child, path, types));
    } else if (node.isArray()) {
      node.forEach(child -> indexNestedTypes(child, path, types));
    }
  }

  private String inferredRootJavaType(Ref schema) {
    String title = schema.node().path("title").asText("");
    if (title.isEmpty()) {
      return "";
    }
    String directory = schema.path().substring(ROOT.length(), schema.path().lastIndexOf('/'));
    String className = Character.toUpperCase(title.charAt(0)) + title.substring(1);
    return "org.openmetadata.schema." + directory.replace('/', '.') + "." + className;
  }

  private static JsonNode read(Resource resource) {
    try {
      return JsonUtils.readTree(resource.getContentAsString());
    } catch (IOException | JsonParsingException e) {
      throw new IllegalStateException("Cannot read schema " + resource.getPath(), e);
    }
  }

  private static String normalize(String base, String relative) {
    Deque<String> segments = new ArrayDeque<>();
    for (String segment : base.substring(0, base.lastIndexOf('/')).split("/")) {
      segments.addLast(segment);
    }
    for (String segment : relative.split("/")) {
      if (segment.equals("..")) {
        segments.pollLast();
      } else if (!segment.equals(".") && !segment.isEmpty()) {
        segments.addLast(segment);
      }
    }
    return String.join("/", segments);
  }
}
