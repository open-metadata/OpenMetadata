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

package org.openmetadata.service.rdf.translator;

import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;

/** Shape-aware access to optional fields in entity JSON trees. */
final class RdfJsonNode {

  private RdfJsonNode() {}

  static Optional<JsonNode> field(JsonNode parent, String fieldName) {
    return object(parent).map(value -> value.get(fieldName)).filter(value -> !nullOrEmpty(value));
  }

  static Optional<JsonNode> object(JsonNode value) {
    return Optional.ofNullable(value).filter(node -> !nullOrEmpty(node)).filter(JsonNode::isObject);
  }

  static Optional<JsonNode> object(JsonNode parent, String fieldName) {
    return field(parent, fieldName).filter(JsonNode::isObject);
  }

  static Optional<JsonNode> array(JsonNode parent, String fieldName) {
    return field(parent, fieldName).filter(JsonNode::isArray);
  }

  static Optional<JsonNode> array(JsonNode value) {
    return Optional.ofNullable(value).filter(node -> !nullOrEmpty(node)).filter(JsonNode::isArray);
  }
}
