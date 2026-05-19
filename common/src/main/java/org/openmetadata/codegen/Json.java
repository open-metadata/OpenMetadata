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
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.TreeSet;

/** JSON load/write helpers and an order-independent semantic diff for codegen. */
public final class Json {
  public static final ObjectMapper MAPPER =
      new ObjectMapper().enable(SerializationFeature.INDENT_OUTPUT);

  private Json() {}

  public static JsonNode loadFile(Path file) {
    try {
      return MAPPER.readTree(Files.readString(file));
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to read " + file, e);
    }
  }

  public static void writeText(Path file, String content) {
    try {
      Files.createDirectories(file.getParent());
      Files.writeString(file, content);
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to write " + file, e);
    }
  }

  public static void writeJson(Path file, JsonNode node) {
    try {
      writeText(file, MAPPER.writeValueAsString(node) + "\n");
    } catch (IOException e) {
      throw new UncheckedIOException("Failed to serialize " + file, e);
    }
  }

  /** Deep-merges {@code override} into {@code base}; a JSON null deletes the key. */
  public static void deepMerge(ObjectNode base, ObjectNode override) {
    override.properties().forEach(e -> mergeEntry(base, e.getKey(), e.getValue()));
  }

  private static void mergeEntry(ObjectNode base, String key, JsonNode value) {
    if (value.isNull()) {
      base.remove(key);
    } else if (value.isObject() && base.path(key).isObject()) {
      deepMerge((ObjectNode) base.get(key), (ObjectNode) value);
    } else {
      base.set(key, value);
    }
  }

  /** Recursively removes {@code _}-prefixed metadata keys (e.g. {@code _javaType}). */
  public static void stripMeta(JsonNode node) {
    if (node.isArray()) {
      node.forEach(Json::stripMeta);
      return;
    }
    if (!node.isObject()) {
      return;
    }
    ObjectNode obj = (ObjectNode) node;
    List<String> metaKeys = new ArrayList<>();
    obj.fieldNames().forEachRemaining(key -> collectMetaKey(metaKeys, key));
    metaKeys.forEach(obj::remove);
    obj.forEach(Json::stripMeta);
  }

  private static void collectMetaKey(List<String> metaKeys, String key) {
    if (key.startsWith("_")) {
      metaKeys.add(key);
    }
  }

  public static List<String> diff(JsonNode expected, JsonNode actual) {
    List<String> out = new ArrayList<>();
    collectDiff(expected, actual, "", out);
    return out;
  }

  private static void collectDiff(
      JsonNode expected, JsonNode actual, String path, List<String> out) {
    if (expected.getNodeType() != actual.getNodeType()) {
      out.add(path + ": " + expected.getNodeType() + " != " + actual.getNodeType());
    } else if (expected.isObject()) {
      collectObjectDiff(expected, actual, path, out);
    } else if (expected.isArray()) {
      collectArrayDiff(expected, actual, path, out);
    } else if (!expected.equals(actual)) {
      out.add(path + ": expected=" + expected + " != actual=" + actual);
    }
  }

  private static void collectObjectDiff(
      JsonNode expected, JsonNode actual, String path, List<String> out) {
    TreeSet<String> keys = new TreeSet<>();
    expected.fieldNames().forEachRemaining(keys::add);
    actual.fieldNames().forEachRemaining(keys::add);
    for (String key : keys) {
      String child = path + "/" + key;
      if (!expected.has(key)) {
        out.add(child + ": unexpected key");
      } else if (!actual.has(key)) {
        out.add(child + ": missing key");
      } else {
        collectDiff(expected.get(key), actual.get(key), child, out);
      }
    }
  }

  private static void collectArrayDiff(
      JsonNode expected, JsonNode actual, String path, List<String> out) {
    if (expected.size() != actual.size()) {
      out.add(path + ": array length " + expected.size() + " != " + actual.size());
      return;
    }
    for (int i = 0; i < expected.size(); i++) {
      collectDiff(expected.get(i), actual.get(i), path + "[" + i + "]", out);
    }
  }
}
