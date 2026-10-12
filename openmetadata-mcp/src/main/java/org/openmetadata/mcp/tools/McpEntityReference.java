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

package org.openmetadata.mcp.tools;

import java.util.Optional;
import java.util.UUID;
import java.util.regex.Pattern;

record McpEntityReference(UUID id, String type) {

  private static final Pattern ENTITY_TYPE = Pattern.compile("[A-Za-z][A-Za-z0-9]*");

  static McpEntityReference required(McpToolParameters parameters) {
    return parse(parameters.requiredString("entityId"), parameters.requiredString("entityType"));
  }

  static Optional<McpEntityReference> optional(McpToolParameters parameters) {
    String entityId = parameters.optionalString("entityId");
    String entityType = parameters.optionalString("entityType");
    boolean hasEntityId = !McpToolParameters.isBlank(entityId);
    boolean hasEntityType = !McpToolParameters.isBlank(entityType);

    if (hasEntityId != hasEntityType) {
      throw new IllegalArgumentException(
          "Both 'entityId' and 'entityType' are required when scoping by entity, or omit both for full-graph scope");
    }
    return hasEntityId ? Optional.of(parse(entityId, entityType)) : Optional.empty();
  }

  String uri(String baseUri) {
    return baseUri + "entity/" + type + "/" + id;
  }

  private static McpEntityReference parse(String entityId, String entityType) {
    UUID id = parseId(entityId);
    return new McpEntityReference(id, validateType(entityType));
  }

  static String validateType(String entityType) {
    if (!ENTITY_TYPE.matcher(entityType).matches()) {
      throw new IllegalArgumentException("'entityType' must be alphanumeric");
    }
    return entityType;
  }

  private static UUID parseId(String entityId) {
    try {
      return UUID.fromString(entityId);
    } catch (IllegalArgumentException exception) {
      throw new IllegalArgumentException("'entityId' must be a UUID", exception);
    }
  }
}
