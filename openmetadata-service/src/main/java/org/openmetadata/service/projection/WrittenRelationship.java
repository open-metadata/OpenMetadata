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

import java.util.Arrays;
import java.util.UUID;
import org.openmetadata.schema.type.Relationship;
import org.openmetadata.service.Entity;

/** A relationship row a point write stores, taken from the DAO call's own arguments. */
record WrittenRelationship(
    UUID fromId, UUID toId, String fromEntity, String toEntity, int relation, String relationType) {
  private static final String PIPELINE_KEY = "\"pipeline\"";

  BufferedMembership membership() {
    return new BufferedMembership(
        BufferedMembership.Table.RELATIONSHIPS,
        Arrays.asList(
            fromId.toString(),
            toId.toString(),
            fromEntity,
            toEntity,
            relation,
            relationType,
            null,
            null,
            null));
  }

  /**
   * A plain upsert's arguments name every dependency it changes unless its former row can carry one
   * they do not: a lineage pipeline in the former JSON, or metric-group membership, which MySQL can
   * resolve through a secondary unique key to a different row. Those keep the before/after capture.
   */
  static boolean formerRowMayAddDependencies(
      final String fromEntity, final String toEntity, final int relation, final String json) {
    return relation == Relationship.UPSTREAM.ordinal()
        || (json != null && json.contains(PIPELINE_KEY))
        || (Entity.METRIC_GROUP.equals(fromEntity)
            && Entity.METRIC.equals(toEntity)
            && relation == Relationship.HAS.ordinal());
  }
}
