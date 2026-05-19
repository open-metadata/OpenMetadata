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
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Scans the entity JSON schemas once and indexes the entity types — both top-level schema files
 * and entity definitions nested inside them. An "entity" is any schema declaring
 * {@code EntityInterface}/{@code ServiceEntityInterface} (a regular entity) or
 * {@code EntityTimeSeriesInterface} (a time-series entity).
 */
final class EntitySchemas {
  private static final String ENTITY_INTERFACE = "org.openmetadata.schema.EntityInterface";
  private static final String SERVICE_ENTITY_INTERFACE =
      "org.openmetadata.schema.ServiceEntityInterface";
  private static final String TIME_SERIES_INTERFACE =
      "org.openmetadata.schema.EntityTimeSeriesInterface";

  /** A resolved entity type: its Java class, schema field names and whether it is time-series. */
  record Info(String javaType, Set<String> fields, boolean timeSeries) {}

  private final Map<String, Info> byFileStem = new HashMap<>();
  private final Map<String, Info> byJavaType = new HashMap<>();

  EntitySchemas(Path schemaRoot) {
    try (Stream<Path> files = Files.walk(schemaRoot)) {
      files.filter(path -> path.getFileName().toString().endsWith(".json")).forEach(this::scan);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to scan entity schemas under " + schemaRoot, e);
    }
  }

  Optional<Info> byFileStem(String stem) {
    return Optional.ofNullable(byFileStem.get(stem));
  }

  Optional<Info> byJavaType(String javaType) {
    return Optional.ofNullable(byJavaType.get(javaType));
  }

  private void scan(Path file) {
    JsonNode schema = Json.loadFile(file);
    String stem = file.getFileName().toString().replace(".json", "");
    register(stem, schema);
    schema.path("definitions").properties().forEach(e -> register(e.getKey(), e.getValue()));
  }

  private void register(String stem, JsonNode node) {
    if (!node.has("javaType") || !node.has("properties")) {
      return;
    }
    boolean timeSeries = declares(node, TIME_SERIES_INTERFACE);
    boolean regular = declares(node, ENTITY_INTERFACE) || declares(node, SERVICE_ENTITY_INTERFACE);
    if (!regular && !timeSeries) {
      return;
    }
    Set<String> fields = new HashSet<>();
    node.get("properties").fieldNames().forEachRemaining(fields::add);
    Info info = new Info(node.get("javaType").asText(), fields, timeSeries);
    byFileStem.putIfAbsent(stem, info);
    byJavaType.put(info.javaType(), info);
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
