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

package org.openmetadata.service.governance.approval;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.Optional;
import java.util.UUID;
import java.util.stream.Stream;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.schema.governance.changeRequest.MutationOp;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;

/**
 * How a change reads to people: its field and, for an element of a list field, the element's
 * name instead of its stored identity. A domain or an owner is stored by id; reviewers know it by
 * its name.
 */
@Slf4j
final class ChangeNames {
  private static final String TAG_FQN = "tagFQN";
  private static final String TERM = "term";
  private static final String ID = "id";
  private static final String TYPE = "type";
  private static final String[] NAME_FIELDS = {"displayName", "fullyQualifiedName", "name"};

  private ChangeNames() {}

  /** For example {@code description}, {@code tags PII.Sensitive} or {@code domains Finance}. */
  static String of(MutationOp op) {
    return op.getKey() == null ? op.getField() : "%s %s".formatted(op.getField(), elementOf(op));
  }

  private static String elementOf(MutationOp op) {
    JsonNode value = op.getValue() == null ? null : JsonUtils.readTree(op.getValue());
    String name = op.getKey();
    if (value != null && value.isObject()) {
      name =
          text(value, TAG_FQN)
              .or(() -> nameIn(value.path(TERM)))
              .or(() -> nameIn(value))
              .or(() -> referenceName(value))
              .orElse(op.getKey());
    }
    return name;
  }

  private static Optional<String> nameIn(JsonNode value) {
    return Stream.of(NAME_FIELDS)
        .map(field -> text(value, field))
        .flatMap(Optional::stream)
        .findFirst();
  }

  private static Optional<String> text(JsonNode value, String field) {
    JsonNode node = value.path(field);
    return node.isTextual() && !node.asText().isBlank()
        ? Optional.of(node.asText())
        : Optional.empty();
  }

  // An element submitted as a bare reference carries only its id and type; its name is read from
  // the catalog. A reference that no longer resolves keeps its stored identity.
  private static Optional<String> referenceName(JsonNode value) {
    Optional<String> name = Optional.empty();
    if (value.hasNonNull(ID) && value.hasNonNull(TYPE)) {
      try {
        EntityReference reference =
            Entity.getEntityReferenceById(
                value.get(TYPE).asText(), UUID.fromString(value.get(ID).asText()), Include.ALL);
        name =
            Stream.of(
                    reference.getDisplayName(),
                    reference.getFullyQualifiedName(),
                    reference.getName())
                .filter(candidate -> candidate != null && !candidate.isBlank())
                .findFirst();
      } catch (RuntimeException e) {
        LOG.debug("[ChangeRequest] No name for {} {}", value.get(TYPE), value.get(ID), e);
      }
    }
    return name;
  }
}
