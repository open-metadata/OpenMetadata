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
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.stream.Stream;

/**
 * Filesystem view of the index-mapping spec. There is one spec file per entity
 * ({@code entities/<entity>.json}); language is a generation input. Language
 * profiles ({@code languages/<lang>.json}) carry the systematic analyzer/normalizer
 * renames; settings are per-language ({@code settings/<lang>/}).
 */
final class Spec {
  private static final String JSON = ".json";
  private final Path dir;

  Spec(Path dir) {
    this.dir = dir;
  }

  JsonNode fieldTypes() {
    return Json.loadFile(dir.resolve("field_types.json"));
  }

  JsonNode fragmentJavaTypes() {
    return Json.loadFile(dir.resolve("fragment_java_types.json"));
  }

  JsonNode fragment(String name) {
    return Json.loadFile(dir.resolve("fragments").resolve(name + JSON));
  }

  JsonNode engine(String name) {
    return Json.loadFile(dir.resolve("engines").resolve(name + JSON));
  }

  JsonNode language(String name) {
    return Json.loadFile(dir.resolve("languages").resolve(name + JSON));
  }

  /**
   * Loads an entity spec, resolving {@code extends}: the base entity's fields are inherited,
   * the entity's own {@code fields} block overrides them (a JSON null removes an inherited field).
   */
  JsonNode entity(String name) {
    ObjectNode spec = (ObjectNode) Json.loadFile(dir.resolve("entities").resolve(name + JSON));
    JsonNode base = spec.get("extends");
    if (base == null) {
      return spec;
    }
    ObjectNode fields = (ObjectNode) Json.loadFile(dir.resolve(base.asText() + JSON)).get("fields");
    ObjectNode merged = fields.deepCopy();
    spec.get("fields").properties().forEach(e -> mergeField(merged, e.getKey(), e.getValue()));
    spec.set("fields", merged);
    spec.remove("extends");
    return spec;
  }

  private void mergeField(ObjectNode merged, String name, JsonNode delta) {
    if (delta.isNull()) {
      merged.remove(name);
      return;
    }
    JsonNode base = merged.get(name);
    if (base != null && base.isObject() && delta.isObject()) {
      Json.deepMerge((ObjectNode) base, (ObjectNode) delta);
    } else {
      merged.set(name, delta);
    }
  }

  /** The canonical (en) analysis settings. Per-language deltas live in {@link #language}. */
  JsonNode settingsBase() {
    return Json.loadFile(dir.resolve("settings").resolve("base.json"));
  }

  /** Root of the entity JSON schemas — the source of truth for entity field types. */
  Path schemaRoot() {
    return dir.getParent().getParent().resolve("json").resolve("schema");
  }

  List<String> entityNames() {
    try (Stream<Path> files = Files.list(dir.resolve("entities"))) {
      List<String> names = new ArrayList<>();
      files
          .map(path -> path.getFileName().toString())
          .filter(name -> name.endsWith(JSON))
          .forEach(name -> names.add(name.substring(0, name.length() - JSON.length())));
      names.sort(String::compareTo);
      return names;
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to list entities", e);
    }
  }
}
