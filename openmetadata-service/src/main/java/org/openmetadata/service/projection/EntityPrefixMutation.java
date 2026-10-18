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

import org.openmetadata.service.Entity;
import org.openmetadata.service.util.FullyQualifiedName;

/**
 * One fact for a descendant FQN rewrite in one entity table. The changed identities are exactly the
 * rows under {@code newPrefix} once the transaction commits, so expansion enumerates them from
 * committed state instead of the request transaction recording one fact per descendant.
 */
public record EntityPrefixMutation(
    int formatVersion, String entityType, String oldPrefix, String newPrefix)
    implements MutationFacts {
  public EntityPrefixMutation {
    if (formatVersion != 1) {
      throw new IllegalArgumentException(
          "Unsupported entity prefix mutation version: " + formatVersion);
    }
    if (entityType == null || entityType.isBlank() || entityType.length() > 128) {
      throw new IllegalArgumentException("Entity type must contain 1 to 128 characters");
    }
    if (oldPrefix == null || oldPrefix.isBlank() || newPrefix == null || newPrefix.isBlank()) {
      throw new IllegalArgumentException("Prefix rewrites require both prefixes");
    }
  }

  public String oldPrefixHash() {
    return FullyQualifiedName.buildHash(oldPrefix);
  }

  public String newPrefixHash() {
    return FullyQualifiedName.buildHash(newPrefix);
  }

  /**
   * The descendant's locator before this rewrite, derived from its locator after it, or null when
   * the locator is not under the new prefix. A row already under the new prefix before the rewrite
   * also derives a locator; expansion treats the member set as a superset and refreshes by ID.
   */
  public String beforeFqnOf(final String afterFqn) {
    return afterFqn != null && afterFqn.startsWith(newPrefix + Entity.SEPARATOR)
        ? oldPrefix + afterFqn.substring(newPrefix.length())
        : null;
  }

  @Override
  public Kind kind() {
    return Kind.ENTITY_PREFIX;
  }
}
