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

package org.openmetadata.service.util;

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import lombok.Getter;
import org.openmetadata.schema.type.ChangeDescription;
import org.openmetadata.schema.type.FieldChange;
import org.openmetadata.schema.utils.JsonUtils;

public final class VersionFieldChangeUtil {
  private static final String CHANGE_DESCRIPTION = "changeDescription";
  private static final String FIELD_NAME = "name";
  private static final String FIELDS_ADDED = "fieldsAdded";
  private static final String FIELDS_UPDATED = "fieldsUpdated";
  private static final String FIELDS_DELETED = "fieldsDeleted";

  private VersionFieldChangeUtil() {}

  public static boolean matchesFieldChanged(
      ChangeDescription changeDescription, String fieldChanged) {
    if (nullOrEmpty(fieldChanged)) {
      return false;
    }
    return extractFieldChangeKeys(changeDescription).contains(fieldChanged);
  }

  public static boolean matchesFieldChanged(String entityJson, String fieldChanged) {
    if (nullOrEmpty(fieldChanged)) {
      return false;
    }
    return extractFieldChangeKeys(entityJson).contains(fieldChanged);
  }

  public static Set<String> extractFieldChangeKeys(ChangeDescription changeDescription) {
    Set<String> fieldChangeKeys = new LinkedHashSet<>();
    addFieldChangeKeys(
        fieldChangeKeys,
        listOrEmpty(changeDescription == null ? null : changeDescription.getFieldsAdded()));
    addFieldChangeKeys(
        fieldChangeKeys,
        listOrEmpty(changeDescription == null ? null : changeDescription.getFieldsUpdated()));
    addFieldChangeKeys(
        fieldChangeKeys,
        listOrEmpty(changeDescription == null ? null : changeDescription.getFieldsDeleted()));
    return fieldChangeKeys;
  }

  public static Set<String> extractFieldChangeKeys(String entityJson) {
    Set<String> fieldChangeKeys = new LinkedHashSet<>();
    JsonNode changeDescriptionNode = JsonUtils.readTree(entityJson).get(CHANGE_DESCRIPTION);
    if (changeDescriptionNode == null || changeDescriptionNode.isNull()) {
      return fieldChangeKeys;
    }

    addFieldChangeKeys(fieldChangeKeys, changeDescriptionNode.get(FIELDS_ADDED));
    addFieldChangeKeys(fieldChangeKeys, changeDescriptionNode.get(FIELDS_UPDATED));
    addFieldChangeKeys(fieldChangeKeys, changeDescriptionNode.get(FIELDS_DELETED));
    return fieldChangeKeys;
  }

  public static String getChangedFieldKeysJson(ChangeDescription changeDescription) {
    return JsonUtils.pojoToJson(new ArrayList<>(extractFieldChangeKeys(changeDescription)));
  }

  public static String getChangedFieldKeysJson(String entityJson) {
    return JsonUtils.pojoToJson(new ArrayList<>(extractFieldChangeKeys(entityJson)));
  }

  private static void addFieldChangeKeys(
      Set<String> fieldChangeKeys, List<FieldChange> fieldChanges) {
    for (FieldChange fieldChange : fieldChanges) {
      addFieldName(fieldChangeKeys, fieldChange.getName());
    }
  }

  private static void addFieldChangeKeys(Set<String> fieldChangeKeys, JsonNode fieldChanges) {
    if (fieldChanges == null || !fieldChanges.isArray()) {
      return;
    }

    for (JsonNode fieldChange : fieldChanges) {
      JsonNode fieldName = fieldChange.get(FIELD_NAME);
      if (fieldName != null && !fieldName.isNull()) {
        addFieldName(fieldChangeKeys, fieldName.asText());
      }
    }
  }

  private static void addFieldName(Set<String> fieldChangeKeys, String fieldName) {
    if (nullOrEmpty(fieldName)) {
      return;
    }
    fieldChangeKeys.add(fieldName);
  }

  @Getter
  public static class VersionExtensionRecord {
    private final UUID id;
    private final String extension;
    private final String jsonSchema;
    private final String json;
    private final Double versionNum;
    private final String changedFieldKeys;

    public VersionExtensionRecord(
        UUID id,
        String extension,
        String jsonSchema,
        String json,
        Double versionNum,
        String changedFieldKeys) {
      this.id = id;
      this.extension = extension;
      this.jsonSchema = jsonSchema;
      this.json = json;
      this.versionNum = versionNum;
      this.changedFieldKeys = changedFieldKeys;
    }
  }
}
