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

package org.openmetadata.service.fernet.rotation;

import com.fasterxml.jackson.core.JsonPointer;
import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.ServiceLoader;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.secrets.BoundCiphertext;
import org.openmetadata.service.secrets.SecretOwner;

/** The candidate bindings of every bound token in a stored value, from every anchor provider. */
@Slf4j
final class Anchors {
  /** How deep JSON held in strings is expanded: a version holds a change description holding a list. */
  static final int MAX_NESTING = 4;

  private static final String ID = "id";
  private static final List<BoundSecretAnchors> PROVIDERS =
      ServiceLoader.load(BoundSecretAnchors.class).stream()
          .map(ServiceLoader.Provider::get)
          .toList();

  /** Where a bound token was written: for this owner, at this field. */
  record Binding(SecretOwner owner, String field) {}

  private Anchors() {}

  /** Candidate bindings of every bound token in {@code root}, by token text, in anchor order. */
  static Map<String, List<Binding>> bindingsIn(JsonNode root) {
    Map<String, LinkedHashSet<Binding>> bindings = new LinkedHashMap<>();
    for (JsonDocument document : documentsIn(root)) {
      for (BoundSecretAnchors provider : PROVIDERS) {
        provider.anchorsIn(document, anchor -> collect(anchor, bindings));
      }
    }
    return bindings.entrySet().stream()
        .collect(
            Collectors.toUnmodifiableMap(
                Map.Entry::getKey, entry -> List.copyOf(entry.getValue())));
  }

  /** {@code root} and, to {@link #MAX_NESTING}, every JSON held in a string that has a bound token. */
  static List<JsonDocument> documentsIn(JsonNode root) {
    List<JsonDocument> documents = new ArrayList<>();
    expand(root, Optional.empty(), 0, documents);
    return List.copyOf(documents);
  }

  private static void collect(Anchor anchor, Map<String, LinkedHashSet<Binding>> bindings) {
    for (JsonPointer field : anchor.fields()) {
      JsonNode value = anchor.config().at(field);
      if (value.isTextual() && BoundCiphertext.isBound(value.textValue())) {
        bindings
            .computeIfAbsent(value.textValue(), token -> new LinkedHashSet<>())
            .add(new Binding(anchor.owner(), field.toString()));
      }
    }
  }

  private static void expand(
      JsonNode node, Optional<UUID> enclosingId, int depth, List<JsonDocument> documents) {
    JsonDocument document = new JsonDocument(node, idOf(node).or(() -> enclosingId));
    documents.add(document);
    if (depth < MAX_NESTING) {
      JsonDocument.descendants(node)
          .filter(JsonNode::isTextual)
          .map(JsonNode::textValue)
          .filter(text -> text.contains(BoundCiphertext.PREFIX))
          .map(Anchors::parseContainer)
          .flatMap(Optional::stream)
          .forEach(nested -> expand(nested, document.enclosingId(), depth + 1, documents));
    }
  }

  private static Optional<UUID> idOf(JsonNode node) {
    Optional<UUID> id = Optional.empty();
    if (node.isObject() && node.path(ID).isTextual()) {
      try {
        id = Optional.of(UUID.fromString(node.path(ID).textValue()));
      } catch (IllegalArgumentException e) {
        LOG.debug("An id that is not a UUID anchors no profile webhook");
      }
    }
    return id;
  }

  private static Optional<JsonNode> parseContainer(String text) {
    try {
      return Optional.of(JsonUtils.readTree(text)).filter(JsonNode::isContainerNode);
    } catch (JsonParsingException e) {
      LOG.debug("A string with a bound token is not JSON");
      return Optional.empty();
    }
  }
}
