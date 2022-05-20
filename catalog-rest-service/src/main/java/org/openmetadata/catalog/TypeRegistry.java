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

package org.openmetadata.catalog;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;

import com.networknt.schema.JsonSchema;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import lombok.extern.slf4j.Slf4j;
import org.openmetadata.catalog.entity.Type;
import org.openmetadata.catalog.entity.type.CustomField;
import org.openmetadata.catalog.util.FullyQualifiedName;
import org.openmetadata.catalog.util.JsonUtils;

/** Type registry used for storing Types in OpenMetadata and customFields of entity types. */
@Slf4j
public class TypeRegistry {
  /** Type map used for extending entities with customFields */
  public static final Map<String, Type> TYPES = new ConcurrentHashMap<>();

  /** Custom field map (fully qualified customFieldName) to (customField) */
  public static final Map<String, CustomField> CUSTOM_FIELDS = new ConcurrentHashMap<>();

  /** Custom field map (fully qualified customFieldName) to (jsonSchema) */
  public static final Map<String, JsonSchema> CUSTOM_FIELD_SCHEMAS = new ConcurrentHashMap<>();

  public static final TypeRegistry INSTANCE = new TypeRegistry();

  private TypeRegistry() {
    /* Singleton instance */
  }

  public static TypeRegistry instance() {
    return INSTANCE;
  }

  public void addType(Type type) {
    TYPES.put(type.getName(), type);
    LOG.info("Updated type {}\n", type.getName());

    // Store custom fields added to a type
    for (CustomField field : type.getCustomFields()) {
      TypeRegistry.instance().addCustomField(type.getName(), field.getName(), field);
    }
  }

  public void getType(String typeName) {
    TYPES.get(typeName);
  }

  public static void removeType(String typeName) {
    TYPES.remove(typeName);
    LOG.info("Deleted type {}\n", typeName);
    // TODO cleanup custom fields
  }

  private void addCustomField(String entityType, String fieldName, CustomField customField) {
    String customFieldFQN = getCustomFieldFQN(entityType, fieldName);
    CUSTOM_FIELDS.put(customFieldFQN, customField);
    LOG.info("Adding custom field {}\n", customFieldFQN);

    JsonSchema jsonSchema = JsonUtils.getJsonSchema(TYPES.get(customField.getFieldType().getName()).getSchema());
    CUSTOM_FIELD_SCHEMAS.put(customFieldFQN, jsonSchema);
    LOG.info("Adding json schema for {} {}\n", customField, jsonSchema);
  }

  public JsonSchema getSchema(String entityType, String fieldName) {
    String customFieldFQN = getCustomFieldFQN(entityType, fieldName);
    return CUSTOM_FIELD_SCHEMAS.get(customFieldFQN);
  }

  public void validateCustomFields(Type type) {
    // Validate custom fields added to a type
    for (CustomField field : listOrEmpty(type.getCustomFields())) {
      if (TYPES.get(field.getFieldType().getName()) == null) {
        throw new IllegalArgumentException(
            String.format("Type %s not found for custom field %s", field.getFieldType().getName(), field.getName()));
      }
    }
  }

  public static String getCustomFieldFQNPrefix(String entityType) {
    return FullyQualifiedName.build(entityType, "customFields");
  }

  public static String getCustomFieldFQN(String entityType, String fieldName) {
    return FullyQualifiedName.build(entityType, "customFields", fieldName);
  }

  public static String getFieldName(String fieldFQN) {
    return FullyQualifiedName.split(fieldFQN)[2];
  }
}
