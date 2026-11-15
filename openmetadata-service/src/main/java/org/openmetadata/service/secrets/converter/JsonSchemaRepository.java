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

import static org.openmetadata.service.secrets.converter.SchemaKeywords.ADDITIONAL_PROPERTIES;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.COMPOSITIONS;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.FORMAT;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ITEMS;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.PASSWORD;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.PROPERTIES;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.REF;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.ROOT;
import static org.openmetadata.service.secrets.converter.SchemaKeywords.TYPE_INDEX;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.introspect.BeanPropertyDefinition;
import io.github.classgraph.ClassGraph;
import io.github.classgraph.Resource;
import io.github.classgraph.ScanResult;
import java.io.IOException;
import java.io.InputStream;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Deque;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Properties;
import java.util.Set;
import java.util.TreeMap;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

final class JsonSchemaRepository {
  private static JsonSchemaRepository instance;
  private final Map<String, JsonNode> schemas;
  private final Map<String, Ref> types;
  private final Map<String, Class<?>> classes;
  private final Map<String, Facts> facts;
  private final Map<Class<?>, Map<String, Method>> getters;

  record Ref(JsonNode node, String path, String pointer) {
    String location() {
      return path + "#" + pointer;
    }
  }

  record Facts(
      Map<String, Ref> properties,
      List<Ref> branches,
      List<Ref> allOf,
      Set<String> required,
      Set<String> defaulted,
      Map<String, JsonNode> discriminators,
      boolean openObject,
      Set<String> passwordChildren,
      boolean password,
      boolean containsPassword) {}

  JsonSchemaRepository(Map<String, JsonNode> schemas, Map<String, String> typeIndex) {
    Map<String, JsonNode> copies = new TreeMap<>();
    schemas.forEach((path, node) -> copies.put(path, node.deepCopy()));
    this.schemas = Collections.unmodifiableMap(copies);
    Map<String, Ref> byType = new LinkedHashMap<>();
    Map<String, Class<?>> byLocation = new LinkedHashMap<>();
    typeIndex.forEach((location, type) -> indexType(location, type, byType, byLocation));
    types = Map.copyOf(byType);
    classes = Map.copyOf(byLocation);
    facts = compileFacts();
    getters = indexGetters();
  }

  static synchronized JsonSchemaRepository getInstance() {
    if (instance == null) {
      instance = load();
    }
    return instance;
  }

  static JsonSchemaRepository load() {
    Map<String, JsonNode> schemas = new TreeMap<>();
    try (ScanResult scan = new ClassGraph().acceptPaths(ROOT).scan()) {
      for (Resource resource : scan.getResourcesWithExtension("json")) {
        schemas.put(resource.getPath(), read(resource));
      }
    }
    if (schemas.isEmpty()) {
      throw new IllegalStateException("Missing schema resources " + ROOT);
    }
    return new JsonSchemaRepository(schemas, readIndex());
  }

  Ref schemaFor(Class<?> clazz) {
    return types.get(clazz.getName());
  }

  Set<Class<?>> javaClasses() {
    return Set.copyOf(classes.values());
  }

  Set<String> schemaPaths() {
    return schemas.keySet();
  }

  Ref rootSchema(String path) {
    JsonNode node = schemas.get(path);
    return node == null ? null : new Ref(node, path, "");
  }

  Ref property(Ref schema, String propertyName) {
    return facts(schema).properties().get(propertyName);
  }

  Facts facts(Ref schema) {
    return facts.get(dereference(schema).location());
  }

  Ref child(Ref parent, String keyword) {
    JsonNode node = parent.node().get(keyword);
    return node == null
        ? null
        : new Ref(node, parent.path(), parent.pointer() + "/" + escape(keyword));
  }

  Ref dereference(Ref schema) {
    Set<String> visited = new HashSet<>();
    Ref current = schema;
    while (current.node().has(REF)) {
      if (!visited.add(current.location())) {
        throw new IllegalStateException("Cyclic schema reference " + current.location());
      }
      current = resolve(current.node().get(REF).asText(), current.path());
    }
    return current;
  }

  Ref resolveToOneOf(Ref schema) {
    Ref resolved = dereference(schema);
    return facts(resolved).branches().isEmpty() ? null : resolved;
  }

  List<Ref> branches(Ref schema) {
    return facts(schema).branches();
  }

  Class<?> javaClass(Ref schema) {
    Class<?> direct = classes.get(schema.location());
    return direct == null ? classes.get(dereference(schema).location()) : direct;
  }

  Method getter(Ref schema, String property) {
    Class<?> type = javaClass(schema);
    return type == null ? null : getters.getOrDefault(type, Map.of()).get(property);
  }

  String accessorSuffix(Ref schema, String property) {
    Method getter = getter(schema, property);
    return getter == null ? property : getter.getName().substring(3);
  }

  boolean hasAdditionalPropertiesHolder(Ref schema) {
    Class<?> type = javaClass(schema);
    if (type == null) {
      return false;
    }
    try {
      return Map.class.isAssignableFrom(type.getMethod("getAdditionalProperties").getReturnType());
    } catch (NoSuchMethodException e) {
      return false;
    }
  }

  boolean hasName(Ref schema) {
    Method getter = getter(schema, "name");
    return getter != null
        && getter.getName().equals("getName")
        && getter.getReturnType() == String.class;
  }

  boolean containsPasswordFormat(Ref schema) {
    return facts(schema).containsPassword();
  }

  private void indexType(
      String location, String name, Map<String, Ref> byType, Map<String, Class<?>> byLocation) {
    Ref schema = resolveLocation(location);
    try {
      Class<?> type = Class.forName(name, false, JsonSchemaRepository.class.getClassLoader());
      byLocation.put(location, type);
      Ref previous = byType.get(name);
      if (previous == null || schema.pointer().isEmpty()) {
        byType.put(name, schema);
      }
    } catch (ClassNotFoundException | LinkageError e) {
      throw new IllegalStateException("Cannot load generated schema type at " + location, e);
    }
  }

  private Map<Class<?>, Map<String, Method>> indexGetters() {
    Map<Class<?>, Map<String, Method>> indexed = new HashMap<>();
    for (Class<?> type : javaClasses()) {
      Map<String, Method> methods = new LinkedHashMap<>();
      for (BeanPropertyDefinition property :
          JsonUtils.getObjectMapper()
              .getSerializationConfig()
              .introspect(JsonUtils.getObjectMapper().constructType(type))
              .findProperties()) {
        if (property.getGetter() != null && property.getGetter().getName().startsWith("get")) {
          methods.put(property.getName(), property.getGetter().getAnnotated());
        }
      }
      indexed.put(type, Map.copyOf(methods));
    }
    return Map.copyOf(indexed);
  }

  private Map<String, Facts> compileFacts() {
    Map<String, Ref> nodes = new LinkedHashMap<>();
    schemas.keySet().forEach(path -> collectNodes(rootSchema(path), nodes));
    Map<String, Set<String>> parents = new HashMap<>();
    Deque<String> passwords = new ArrayDeque<>();
    nodes.forEach(
        (location, schema) -> {
          if (PASSWORD.equals(schema.node().path(FORMAT).asText())) {
            passwords.add(location);
          }
          for (Ref child : reachableChildren(schema)) {
            parents.computeIfAbsent(child.location(), ignored -> new HashSet<>()).add(location);
          }
        });
    Set<String> secretNodes = new HashSet<>();
    while (!passwords.isEmpty()) {
      String location = passwords.removeFirst();
      if (secretNodes.add(location)) {
        passwords.addAll(parents.getOrDefault(location, Set.of()));
      }
    }
    Map<String, Facts> compiled = new LinkedHashMap<>();
    nodes.forEach((location, schema) -> compiled.put(location, compile(schema, secretNodes)));
    return Map.copyOf(compiled);
  }

  private Facts compile(Ref schema, Set<String> secretNodes) {
    Map<String, Ref> properties = new LinkedHashMap<>();
    Ref propertySchemas = child(schema, PROPERTIES);
    if (propertySchemas != null) {
      propertySchemas
          .node()
          .fieldNames()
          .forEachRemaining(name -> properties.put(name, child(propertySchemas, name)));
    }
    Set<String> required = new LinkedHashSet<>();
    schema.node().path(SchemaKeywords.REQUIRED).forEach(value -> required.add(value.asText()));
    List<Ref> branches = new ArrayList<>(composition(schema, SchemaKeywords.ONE_OF));
    branches.addAll(composition(schema, SchemaKeywords.ANY_OF));
    boolean open =
        SchemaKeywords.OBJECT.equals(schema.node().path(SchemaKeywords.TYPE).asText())
            && properties.isEmpty()
            && schema.node().path(ADDITIONAL_PROPERTIES).asBoolean(false);
    return new Facts(
        Map.copyOf(properties),
        List.copyOf(branches),
        composition(schema, SchemaKeywords.ALL_OF),
        Set.copyOf(required),
        defaultedProperties(properties),
        discriminators(properties),
        open,
        passwordChildren(schema, secretNodes),
        PASSWORD.equals(schema.node().path(FORMAT).asText()),
        secretNodes.contains(schema.location()));
  }

  private Set<String> defaultedProperties(Map<String, Ref> properties) {
    Set<String> defaults = new LinkedHashSet<>();
    properties.forEach(
        (name, property) -> {
          JsonNode value =
              property.node().has(SchemaKeywords.DEFAULT)
                  ? property.node().get(SchemaKeywords.DEFAULT)
                  : dereference(property).node().get(SchemaKeywords.DEFAULT);
          if (value != null && !value.isNull()) {
            defaults.add(name);
          }
        });
    return Set.copyOf(defaults);
  }

  private Map<String, JsonNode> discriminators(Map<String, Ref> properties) {
    Map<String, JsonNode> result = new LinkedHashMap<>();
    properties.forEach(
        (name, property) -> {
          JsonNode definition = dereference(property).node();
          JsonNode constant = definition.get(SchemaKeywords.CONST);
          if (constant == null && definition.path(SchemaKeywords.ENUM).size() == 1) {
            constant = definition.path(SchemaKeywords.ENUM).get(0);
          }
          if (constant != null) {
            result.put(name, constant);
          }
        });
    return Map.copyOf(result);
  }

  private Set<String> passwordChildren(Ref schema, Set<String> secretNodes) {
    Set<String> names = new LinkedHashSet<>();
    Set<String> visited = new HashSet<>();
    Deque<Ref> pending = new ArrayDeque<>();
    pending.add(schema);
    while (!pending.isEmpty()) {
      Ref current = dereference(pending.removeFirst());
      if (visited.add(current.location())) {
        Ref properties = child(current, PROPERTIES);
        if (properties != null) {
          properties
              .node()
              .fieldNames()
              .forEachRemaining(
                  name -> {
                    if (secretNodes.contains(child(properties, name).location())) {
                      names.add(name);
                    }
                  });
        }
        COMPOSITIONS.forEach(keyword -> pending.addAll(composition(current, keyword)));
      }
    }
    return Set.copyOf(names);
  }

  private List<Ref> composition(Ref schema, String keyword) {
    Ref values = child(schema, keyword);
    List<Ref> result = new ArrayList<>();
    if (values != null) {
      for (int index = 0; index < values.node().size(); index++) {
        result.add(
            new Ref(values.node().get(index), values.path(), values.pointer() + "/" + index));
      }
    }
    return List.copyOf(result);
  }

  private void collectNodes(Ref schema, Map<String, Ref> nodes) {
    if (nodes.putIfAbsent(schema.location(), schema) != null) {
      return;
    }
    for (Ref child : structuralChildren(schema)) {
      collectNodes(child, nodes);
    }
    for (String definitions : List.of("definitions", "$defs")) {
      Ref values = child(schema, definitions);
      if (values != null) {
        values
            .node()
            .fieldNames()
            .forEachRemaining(name -> collectNodes(child(values, name), nodes));
      }
    }
  }

  private List<Ref> reachableChildren(Ref schema) {
    List<Ref> result = new ArrayList<>(structuralChildren(schema));
    if (schema.node().has(REF)) {
      result.add(resolve(schema.node().get(REF).asText(), schema.path()));
    }
    return result;
  }

  private List<Ref> structuralChildren(Ref schema) {
    List<Ref> result = new ArrayList<>();
    Ref properties = child(schema, PROPERTIES);
    if (properties != null) {
      properties.node().fieldNames().forEachRemaining(name -> result.add(child(properties, name)));
    }
    COMPOSITIONS.forEach(keyword -> result.addAll(composition(schema, keyword)));
    for (String keyword : List.of(ITEMS, ADDITIONAL_PROPERTIES)) {
      Ref value = child(schema, keyword);
      if (value != null && value.node().isObject()) {
        result.add(value);
      }
    }
    return result;
  }

  private Ref resolve(String reference, String base) {
    URI resolved = URI.create(base).resolve(reference);
    String fragment = resolved.getFragment() == null ? "" : resolved.getFragment();
    return resolveLocation(resolved.getPath() + "#" + fragment);
  }

  private Ref resolveLocation(String location) {
    int hash = location.indexOf('#');
    String path = hash < 0 ? location : location.substring(0, hash);
    String pointer = hash < 0 ? "" : location.substring(hash + 1);
    JsonNode root = schemas.get(path);
    JsonNode node = root == null ? null : root.at(pointer);
    if (node == null || node.isMissingNode()) {
      throw new IllegalStateException("Missing schema resource " + location);
    }
    return new Ref(node, path, pointer);
  }

  private static Map<String, String> readIndex() {
    try (InputStream input =
        JsonSchemaRepository.class.getClassLoader().getResourceAsStream(TYPE_INDEX)) {
      if (input == null) {
        throw new IOException("Resource not found");
      }
      Properties properties = new Properties();
      properties.load(input);
      Map<String, String> result = new TreeMap<>();
      properties.forEach((location, type) -> result.put(location.toString(), type.toString()));
      if (result.isEmpty()) {
        throw new IOException("Resource is empty");
      }
      return result;
    } catch (IOException e) {
      throw new IllegalStateException("Cannot read schema type index " + TYPE_INDEX, e);
    }
  }

  private static JsonNode read(Resource resource) {
    try {
      return JsonUtils.readTree(resource.getContentAsString());
    } catch (IOException | JsonParsingException e) {
      throw new IllegalStateException("Cannot read schema " + resource.getPath(), e);
    }
  }

  private static String escape(String key) {
    return key.replace("~", "~0").replace("/", "~1");
  }
}
