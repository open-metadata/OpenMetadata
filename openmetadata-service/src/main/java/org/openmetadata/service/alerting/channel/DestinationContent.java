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

package org.openmetadata.service.alerting.channel;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.Collection;
import java.util.Map;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.openmetadata.schema.entity.events.SubscriptionDestination;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * A destination as a tree that says what it holds and nothing about how it was sent: keys in
 * order, and an empty value left out, so the empty headers or authentication a form fills in say
 * nothing. Two destinations that hold the same read the same.
 */
final class DestinationContent {

  private DestinationContent() {}

  static JsonNode canonical(SubscriptionDestination destination, Collection<String> leftOut) {
    ObjectNode content = (ObjectNode) JsonUtils.valueToTree(destination);
    content.remove(leftOut);
    return withoutEmptyValues(content);
  }

  private static JsonNode withoutEmptyValues(JsonNode node) {
    JsonNode result = node;
    if (node.isObject()) {
      ObjectNode kept = JsonUtils.getObjectNode();
      Map<String, JsonNode> byName =
          node.properties().stream()
              .collect(
                  Collectors.toMap(
                      Map.Entry::getKey, Map.Entry::getValue, (a, b) -> b, TreeMap::new));
      byName.forEach((name, value) -> keepIfItSaysSomething(kept, name, value));
      result = kept;
    }
    return result;
  }

  private static void keepIfItSaysSomething(ObjectNode kept, String name, JsonNode value) {
    JsonNode reduced = withoutEmptyValues(value);
    boolean empty = reduced.isNull() || (reduced.isContainerNode() && reduced.isEmpty());
    if (!empty) {
      kept.set(name, reduced);
    }
  }
}
