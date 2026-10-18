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

package org.openmetadata.service.projection;

import java.util.Objects;
import java.util.UUID;

/** Affected identities, not a command to replay an old relationship into a target. */
public record RelationshipSnapshot(
    long id, Endpoint from, Endpoint to, Relation relation, RelatedIds relatedIds) {
  public record Endpoint(UUID id, String type) {
    public Endpoint {
      Objects.requireNonNull(id, "id");
      if (type == null || type.isBlank() || type.length() > 256) {
        throw new IllegalArgumentException("Endpoint type must contain 1 to 256 characters");
      }
    }
  }

  public record Relation(int code, String type) {
    public Relation {
      if (code < 0 || type == null || type.length() > 256) {
        throw new IllegalArgumentException(
            "Relationship requires a nonnegative code and a type of at most 256 characters");
      }
    }
  }

  public record RelatedIds(UUID relationshipId, UUID relationshipTypeId, UUID pipelineId) {}
}
