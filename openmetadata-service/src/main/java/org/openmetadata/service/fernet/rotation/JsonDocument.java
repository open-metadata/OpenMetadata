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

/**
 * A stored value parsed as JSON, or JSON held in one of its strings.
 *
 * @param root the parsed document
 * @param enclosingId the UUID {@code id} at the root of this document or, when it has none, of the
 *     nearest document it is held in; the holder of a profile's webhooks
 */
public record JsonDocument(JsonNode root, Optional<UUID> enclosingId) {

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
}
