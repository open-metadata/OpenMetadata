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

/** Typed journal facts; retained membership belongs to the same transaction as this fact. */
public sealed interface MutationFacts
    permits EntityMutation,
        EntityPrefixMutation,
        RelationshipMutation,
        TagUsageMutation,
        FieldRelationshipMutation,
        ExtensionMutation {
  int formatVersion();

  Kind kind();

  enum Kind {
    ENTITY,
    ENTITY_PREFIX,
    RELATIONSHIPS,
    TAG_USAGE,
    FIELD_RELATIONSHIPS,
    EXTENSIONS
  }
}
