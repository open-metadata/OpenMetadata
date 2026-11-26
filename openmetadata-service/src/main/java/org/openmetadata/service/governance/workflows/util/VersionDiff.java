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
package org.openmetadata.service.governance.workflows.util;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.HashSet;
import java.util.Set;
import java.util.TreeSet;
import org.openmetadata.schema.EntityInterface;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.governance.approval.ApprovalGate;
import org.openmetadata.service.governance.approval.MutationOps;
import org.openmetadata.service.governance.approval.MutationPlanner;

/**
 * The net change between two stored versions of an entity, found by comparing the versions rather
 * than by folding the changes recorded between them, so it needs neither the versions in between
 * nor their count. Fields are named as a change request's preview names them: a list of tags,
 * references or synonyms by the elements it gained and lost, an extension property by its own name,
 * and any other field by its old and new value. A field nested inside a list, such as one column's
 * tags, shows as a change to the whole list.
 */
public final class VersionDiff {
  // Fields every write moves, a rename derives, or a follow or vote changes without a new version.
  private static final Set<String> UNREVIEWED_FIELDS = unreviewedFields();
  private static final String EXTENSION_PROPERTY_PREFIX = Entity.FIELD_EXTENSION + Entity.SEPARATOR;

  private VersionDiff() {}

  /** What changed from {@code before} to {@code after}, as one change made from {@code before}. */
  public static ChangeDescription between(EntityInterface<?> before, EntityInterface<?> after) {
    ObjectNode beforeFields = reviewedFields(before);
    ObjectNode afterFields = reviewedFields(after);
    Set<String> names = new TreeSet<>();
    beforeFields.fieldNames().forEachRemaining(names::add);
    afterFields.fieldNames().forEachRemaining(names::add);
    return MutationOps.toChangeDescription(
        MutationPlanner.plan(beforeFields, afterFields, names, Set.of()), before.getVersion());
  }

  private static ObjectNode reviewedFields(EntityInterface<?> version) {
    ObjectNode fields =
        (ObjectNode) ApprovalGate.withoutDerivedTags(JsonUtils.valueToTree(version));
    fields.remove(UNREVIEWED_FIELDS);
    JsonNode extension = fields.remove(Entity.FIELD_EXTENSION);
    if (extension instanceof ObjectNode properties) {
      properties
          .properties()
          .forEach(
              property ->
                  fields.set(EXTENSION_PROPERTY_PREFIX + property.getKey(), property.getValue()));
    }
    return fields;
  }

  private static Set<String> unreviewedFields() {
    Set<String> unreviewed = new HashSet<>(ApprovalGate.BOOKKEEPING_FIELDS);
    unreviewed.add(Entity.FIELD_FULLY_QUALIFIED_NAME);
    unreviewed.add(Entity.FIELD_FOLLOWERS);
    unreviewed.add(Entity.FIELD_VOTES);
    return Set.copyOf(unreviewed);
  }
}
