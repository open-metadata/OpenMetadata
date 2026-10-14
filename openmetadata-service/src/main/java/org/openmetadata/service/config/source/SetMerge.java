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

package org.openmetadata.service.config.source;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

/**
 * Three-way merge of a list of independent entries, such as admin principals: entries the
 * deployment removed are removed, entries it added are added, and entries added in the UI stay.
 * Replacing the whole list would either drop the UI's additions or ignore a revocation made in the
 * deployment.
 */
final class SetMerge {
  private SetMerge() {}

  static ArrayNode merge(JsonNode stored, JsonNode lastApplied, JsonNode deployment) {
    Set<JsonNode> removed = difference(lastApplied, deployment);
    Set<JsonNode> added = difference(deployment, lastApplied);
    ArrayNode merged = JsonNodeFactory.instance.arrayNode();
    Set<JsonNode> kept = new HashSet<>();
    elements(stored)
        .filter(entry -> !removed.contains(SettingValues.canonical(entry)))
        .forEach(entry -> addOnce(merged, kept, entry));
    elements(deployment)
        .filter(entry -> added.contains(SettingValues.canonical(entry)))
        .forEach(entry -> addOnce(merged, kept, entry));
    return merged;
  }

  private static Set<JsonNode> difference(JsonNode from, JsonNode subtract) {
    Set<JsonNode> difference = SettingValues.canonicalElements(from);
    difference.removeAll(SettingValues.canonicalElements(subtract));
    return difference;
  }

  private static Stream<JsonNode> elements(JsonNode array) {
    return array != null && array.isArray()
        ? StreamSupport.stream(array.spliterator(), false)
        : Stream.empty();
  }

  private static void addOnce(ArrayNode merged, Set<JsonNode> kept, JsonNode entry) {
    if (kept.add(SettingValues.canonical(entry))) {
      merged.add(entry.deepCopy());
    }
  }
}
