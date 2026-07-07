/*
 *  Copyright 2024 Collate.
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
package org.openmetadata.service.search.indexes;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Predicate;
import org.openmetadata.schema.type.Field;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.search.SearchFieldLimits;
import org.openmetadata.service.search.models.FlattenSchemaField;
import org.openmetadata.service.util.FullyQualifiedName;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Flattens recursive message/API schema fields (Topic {@code messageSchema}, API endpoint
 * request/response schemas) into a flat list, bounded by the configured depth and field-count limits
 * so a pathologically deep or wide schema can never explode the search document. Shared by the topic
 * and API-endpoint indexes, mirroring the column flatten cap in {@link ColumnIndex}.
 */
public final class SchemaFieldFlattener {

  private static final Logger LOG = LoggerFactory.getLogger(SchemaFieldFlattener.class);

  private SchemaFieldFlattener() {}

  public static void parseSchemaFields(
      List<Field> fields, List<FlattenSchemaField> flattenSchemaFields, String parentField) {
    parseSchemaFields(fields, flattenSchemaFields, parentField, 1, SearchFieldLimits.active());
  }

  private static void parseSchemaFields(
      List<Field> fields,
      List<FlattenSchemaField> flattenSchemaFields,
      String parentField,
      int depth,
      SearchFieldLimits limits) {
    if (depth > limits.getDepthLimit()) {
      LOG.warn(
          "Dropping schema fields under '{}' beyond mapping depth limit {}",
          parentField,
          limits.getDepthLimit());
    } else {
      addFieldsWithinLimit(fields, flattenSchemaFields, parentField, depth, limits);
    }
  }

  private static void addFieldsWithinLimit(
      List<Field> fields,
      List<FlattenSchemaField> flattenSchemaFields,
      String parentField,
      int depth,
      SearchFieldLimits limits) {
    Optional<String> optParentField =
        Optional.ofNullable(parentField).filter(Predicate.not(String::isEmpty));
    int index = 0;
    boolean capReached = false;
    while (index < fields.size() && !capReached) {
      if (flattenSchemaFields.size() >= limits.getMaxColumns()) {
        LOG.warn(
            "Reached max indexed schema fields {}; dropping remaining under '{}'",
            limits.getMaxColumns(),
            parentField);
        capReached = true;
      } else {
        Field field = fields.get(index);
        List<TagLabel> tags = field.getTags() != null ? field.getTags() : new ArrayList<>();
        String fieldName = addFlattenField(field, optParentField, tags, flattenSchemaFields);
        if (field.getChildren() != null) {
          parseSchemaFields(field.getChildren(), flattenSchemaFields, fieldName, depth + 1, limits);
        }
        index++;
      }
    }
  }

  private static String addFlattenField(
      Field field,
      Optional<String> optParentField,
      List<TagLabel> tags,
      List<FlattenSchemaField> flattenSchemaFields) {
    String fieldName = field.getName();
    if (optParentField.isPresent()) {
      fieldName = FullyQualifiedName.add(optParentField.get(), fieldName);
    }
    FlattenSchemaField flattenSchemaField =
        FlattenSchemaField.builder().name(fieldName).description(field.getDescription()).build();
    if (!tags.isEmpty()) {
      flattenSchemaField.setTags(tags);
    }
    flattenSchemaFields.add(flattenSchemaField);
    return fieldName;
  }
}
