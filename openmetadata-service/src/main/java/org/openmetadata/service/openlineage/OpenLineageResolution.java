/*
 *  Copyright 2021 Collate
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

package org.openmetadata.service.openlineage;

import org.openmetadata.schema.api.lineage.openlineage.UnresolvedReason;
import org.openmetadata.schema.type.EntityReference;

/** Outcome of mapping one OpenLineage dataset or job onto an OpenMetadata entity. */
public sealed interface OpenLineageResolution {

  record Resolved(EntityReference entity) implements OpenLineageResolution {}

  record Unresolved(UnresolvedReason reason, String message) implements OpenLineageResolution {}

  static OpenLineageResolution resolved(EntityReference entity) {
    return new Resolved(entity);
  }

  static OpenLineageResolution unresolved(UnresolvedReason reason, String message) {
    return new Unresolved(reason, message);
  }
}
