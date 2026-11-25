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

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;
import org.openmetadata.schema.exception.JsonParsingException;
import org.openmetadata.schema.utils.JsonUtils;

/**
 * A stored value parsed as JSON, or JSON held in one of its strings.
 *
 * @param root the parsed document
 * @param enclosingId the UUID {@code id} at the root of this document or, when it has none, of the
 *     nearest document it is held in; the holder of a profile's webhooks
 */
public record JsonDocument(JsonNode root, Optional<UUID> enclosingId) {
  private static final String ID = "id";

  /** Every object node of the document, the root included, parents before children. */
  public Stream<JsonNode> objectNodes() {
    return descendants(root).filter(JsonNode::isObject);
  }

  /** {@code node} and every node under it, parents before children. */
  public static Stream<JsonNode> descendants(JsonNode node) {
    Stream<JsonNode> children =
        node.isContainerNode()
            ? StreamSupport.stream(node.spliterator(), false).flatMap(JsonDocument::descendants)
            : Stream.empty();
    return Stream.concat(Stream.of(node), children);
  }

  /** Parses {@code text} as a JSON object or array, or returns empty if it is neither. */
  public static Optional<JsonNode> parseContainer(String text) {
    try {
      return Optional.of(JsonUtils.readTree(text)).filter(JsonNode::isContainerNode);
    } catch (JsonParsingException e) {
      return Optional.empty();
    }
  }

  /** Parses {@code node} as a UUID when it is a valid UUID string. */
  public static Optional<UUID> uuidOf(JsonNode node) {
    if (!node.isTextual()) {
      return Optional.empty();
    }
    try {
      return Optional.of(UUID.fromString(node.textValue()));
    } catch (IllegalArgumentException e) {
      return Optional.empty();
    }
  }

  /** Parses an object's {@code id} field as a UUID when present and valid. */
  public static Optional<UUID> idOf(JsonNode node) {
    return node.isObject() ? uuidOf(node.path(ID)) : Optional.empty();
  }
}
