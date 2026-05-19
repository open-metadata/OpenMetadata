/*
 *  Copyright 2025 Collate.
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
package org.openmetadata.codegen;

import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Scans the JSON schemas once — used <b>only by {@link SpecExtractor}</b> at bootstrap to resolve
 * each index entity to its Java class. Indexes both top-level schemas and nested definitions
 * (top-level wins a name clash). The result is baked into the entity spec, so the generator never
 * needs to scan.
 */
final class EntitySchemas {
  private static final String ENTITY_INTERFACE = "org.openmetadata.schema.EntityInterface";
  private static final String SERVICE_ENTITY_INTERFACE =
      "org.openmetadata.schema.ServiceEntityInterface";
  private static final String TIME_SERIES_INTERFACE =
      "org.openmetadata.schema.EntityTimeSeriesInterface";

  enum Kind {
    ENTITY,
    TIME_SERIES,
    PLAIN
  }

  /** A resolved schema type: its Java class, schema field names and its kind. */
  record Info(String javaType, Set<String> fields, Kind kind) {}

  private final Map<String, Info> byFileStem = new HashMap<>();
  private final Map<String, Info> byJavaType = new HashMap<>();

  EntitySchemas(Path schemaRoot) {
    List<Map.Entry<String, JsonNode>> definitions = new ArrayList<>();
    try (Stream<Path> files = Files.walk(schemaRoot)) {
      files
          .filter(path -> path.getFileName().toString().endsWith(".json"))
          .forEach(path -> scanTopLevel(path, definitions));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to scan schemas under " + schemaRoot, e);
    }
    definitions.forEach(e -> register(e.getKey(), e.getValue()));
  }

  Optional<Info> byFileStem(String stem) {
    return Optional.ofNullable(byFileStem.get(stem));
  }

  Optional<Info> byJavaType(String javaType) {
    return Optional.ofNullable(byJavaType.get(javaType));
  }

  private void scanTopLevel(Path file, List<Map.Entry<String, JsonNode>> definitions) {
    JsonNode schema = Json.loadFile(file);
    register(file.getFileName().toString().replace(".json", ""), schema);
    schema.path("definitions").properties().forEach(definitions::add);
  }

  private void register(String stem, JsonNode node) {
    if (!node.has("javaType") || !node.has("properties")) {
      return;
    }
    Set<String> fields = new HashSet<>();
    node.get("properties").fieldNames().forEachRemaining(fields::add);
    Info info = new Info(node.get("javaType").asText(), fields, kindOf(node));
    byFileStem.putIfAbsent(stem, info);
    byJavaType.putIfAbsent(info.javaType(), info);
  }

  private Kind kindOf(JsonNode node) {
    if (declares(node, TIME_SERIES_INTERFACE)) {
      return Kind.TIME_SERIES;
    }
    if (declares(node, ENTITY_INTERFACE) || declares(node, SERVICE_ENTITY_INTERFACE)) {
      return Kind.ENTITY;
    }
    return Kind.PLAIN;
  }

  private boolean declares(JsonNode node, String iface) {
    for (JsonNode declared : node.path("javaInterfaces")) {
      if (iface.equals(declared.asText())) {
        return true;
      }
    }
    return false;
  }
}
