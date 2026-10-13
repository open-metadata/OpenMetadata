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

package org.openmetadata.service.datacontract.odcs;

import static java.util.Map.entry;

import com.fasterxml.jackson.databind.JsonNode;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * Reports the fields of an ODCS document that OpenMetadata does not import, or keeps only so the
 * document can be exported again. This is the catalogue of how each ODCS field is treated: a field
 * is mapped onto the contract, stored for export, or not imported, and any key ODCS does not
 * define is reported as unknown.
 */
public final class ODCSFieldCoverage {
  private static final String SCHEMA = "schema";
  private static final String PROPERTIES = "properties";
  private static final String NAME = "name";
  private static final String LOGICAL_TYPE = "logicalType";
  private static final String OBJECT_TYPE = "object";
  private static final String POSITION_SUFFIX = "Position";
  private static final Set<String> MISSPELLED_QUALITY_KEYS =
      Set.of("qualityExpectations", "qualityRules", "qualityChecks", "expectations");
  private static final Set<String> V3_2_PROPERTY_FIELDS =
      Set.of("context", "synonyms", "enum", "semanticType", "deprecated");

  private enum Treatment {
    MAPPED,
    STORED,
    NOT_IMPORTED,
    NESTED
  }

  private enum Section {
    ROOT,
    DESCRIPTION,
    SCHEMA_OBJECT,
    PROPERTY,
    LOGICAL_TYPE_OPTIONS,
    TEAM,
    TEAM_MEMBER,
    ROLE,
    SLA_PROPERTY
  }

  private record FieldRule(Treatment treatment, String reason, Section nested) {
    static FieldRule mapped() {
      return new FieldRule(Treatment.MAPPED, null, null);
    }

    static FieldRule stored() {
      return new FieldRule(Treatment.STORED, null, null);
    }

    static FieldRule dropped(String reason) {
      return new FieldRule(Treatment.NOT_IMPORTED, reason, null);
    }

    static FieldRule nested(Section section) {
      return new FieldRule(Treatment.NESTED, null, section);
    }
  }

  private static final String NO_CONTRACT_EQUIVALENT = "OpenMetadata contracts have no equivalent.";
  private static final String NO_COLUMN_EQUIVALENT =
      "OpenMetadata contract columns have no equivalent.";
  private static final String ADDED_IN_V3_2 =
      "It was added in ODCS v3.2.0 and is not imported yet.";
  private static final String COLUMNS_ONLY =
      "Only the columns of the table object are imported into the contract.";

  private static final Map<Section, Map<String, FieldRule>> CATALOGUE = catalogue();

  private ODCSFieldCoverage() {}

  /**
   * @param importedObject name of the schema object whose properties become the contract's columns;
   *     the other schema objects are reported as not imported
   */
  public static void report(JsonNode document, String importedObject, ODCSImportIssues issues) {
    document
        .fields()
        .forEachRemaining(
            field -> {
              if (SCHEMA.equals(field.getKey())) {
                reportSchema(field.getValue(), importedObject, issues);
              } else {
                visit(field.getKey(), field.getValue(), Section.ROOT, "", issues);
              }
            });
  }

  private static void reportSchema(
      JsonNode schema, String importedObject, ODCSImportIssues issues) {
    if (schema != null && schema.isArray()) {
      boolean hasObjects = false;
      for (JsonNode element : schema) {
        hasObjects |= isSchemaObject(element);
      }
      for (int index = 0; index < schema.size(); index++) {
        String path = ODCSPaths.element(SCHEMA, index);
        JsonNode element = schema.get(index);
        if (!hasObjects) {
          walk(element, Section.PROPERTY, path, issues);
        } else if (isImportedObject(element, importedObject)) {
          walk(element, Section.SCHEMA_OBJECT, path, issues);
        } else if (isSchemaObject(element)) {
          reportOtherObject(element, importedObject, path, issues);
        }
      }
    }
  }

  private static void reportOtherObject(
      JsonNode element, String importedObject, String path, ODCSImportIssues issues) {
    issues.warning(
        ODCSPaths.category(path),
        SCHEMA,
        path,
        String.format(
            "Schema object `%s` is not imported: a contract covers one table, `%s`.",
            element.path(NAME).asText(), importedObject));
  }

  private static void walk(JsonNode node, Section section, String path, ODCSImportIssues issues) {
    if (node != null && node.isObject()) {
      node.fields()
          .forEachRemaining(
              field -> visit(field.getKey(), field.getValue(), section, path, issues));
    }
  }

  private static void visit(
      String key, JsonNode value, Section section, String path, ODCSImportIssues issues) {
    if (!isEmpty(key, value)) {
      apply(key, value, section, ODCSPaths.child(path, key), issues);
    }
  }

  private static void apply(
      String key, JsonNode value, Section section, String location, ODCSImportIssues issues) {
    FieldRule rule = CATALOGUE.get(section).get(key);
    if (rule == null) {
      reportUnknown(key, section, location, issues);
    } else {
      switch (rule.treatment()) {
        case MAPPED -> {}
        case STORED -> issues.info(
            ODCSPaths.category(location),
            key,
            location,
            String.format("`%s` is kept for ODCS export but not shown in OpenMetadata.", key));
        case NOT_IMPORTED -> issues.warning(
            ODCSPaths.category(location),
            key,
            location,
            String.format("`%s` is not imported. %s", key, rule.reason()));
        case NESTED -> visitNested(value, rule.nested(), location, issues);
      }
    }
  }

  /** A team is written either as a list of members (ODCS 3.0) or as an object (ODCS 3.1). */
  private static void visitNested(
      JsonNode value, Section section, String location, ODCSImportIssues issues) {
    if (value.isArray()) {
      Section elementSection = section == Section.TEAM ? Section.TEAM_MEMBER : section;
      for (int index = 0; index < value.size(); index++) {
        walk(value.get(index), elementSection, ODCSPaths.element(location, index), issues);
      }
    } else {
      walk(value, section, location, issues);
    }
  }

  private static void reportUnknown(
      String key, Section section, String location, ODCSImportIssues issues) {
    String message;
    if (section == Section.LOGICAL_TYPE_OPTIONS) {
      message =
          String.format("`%s` is not imported. Only maxLength becomes the column length.", key);
    } else if (MISSPELLED_QUALITY_KEYS.contains(key)) {
      message =
          String.format(
              "`%s` is not an ODCS field, so its rules are not imported; ODCS quality rules go under `quality`.",
              key);
    } else {
      message = String.format("`%s` is not an ODCS field, so it is not imported.", key);
    }
    issues.warning(ODCSPaths.category(location), key, location, message);
  }

  /** Nothing is lost by leaving out an empty value or a default like {@code false} or -1. */
  private static boolean isEmpty(String key, JsonNode value) {
    boolean emptyContainer = value.isContainerNode() && value.isEmpty();
    boolean emptyText = value.isTextual() && value.asText().isBlank();
    boolean unsetPosition = key.endsWith(POSITION_SUFFIX) && value.isNumber() && value.asInt() < 0;
    return value.isNull() || emptyContainer || emptyText || unsetPosition || isFalse(value);
  }

  private static boolean isFalse(JsonNode value) {
    return value.isBoolean() && !value.asBoolean();
  }

  private static boolean isSchemaObject(JsonNode element) {
    return OBJECT_TYPE.equals(element.path(LOGICAL_TYPE).asText())
        || (element.path(PROPERTIES).isArray() && !element.path(PROPERTIES).isEmpty());
  }

  private static boolean isImportedObject(JsonNode element, String importedObject) {
    return importedObject != null && importedObject.equals(element.path(NAME).asText());
  }

  private static Map<Section, Map<String, FieldRule>> catalogue() {
    Map<Section, Map<String, FieldRule>> catalogue = new HashMap<>();
    catalogue.put(Section.ROOT, rootFields());
    catalogue.put(Section.DESCRIPTION, descriptionFields());
    catalogue.put(Section.SCHEMA_OBJECT, schemaObjectFields());
    catalogue.put(Section.PROPERTY, propertyFields());
    catalogue.put(Section.LOGICAL_TYPE_OPTIONS, Map.of("maxLength", FieldRule.mapped()));
    catalogue.put(Section.TEAM, teamFields());
    catalogue.put(Section.TEAM_MEMBER, teamMemberFields());
    catalogue.put(Section.ROLE, roleFields());
    catalogue.put(Section.SLA_PROPERTY, slaPropertyFields());
    return Map.copyOf(catalogue);
  }

  private static Map<String, FieldRule> rootFields() {
    return Map.ofEntries(
        entry("apiVersion", FieldRule.mapped()),
        entry("kind", FieldRule.mapped()),
        entry("id", FieldRule.mapped()),
        entry(NAME, FieldRule.mapped()),
        entry("status", FieldRule.mapped()),
        entry("description", FieldRule.nested(Section.DESCRIPTION)),
        entry("team", FieldRule.nested(Section.TEAM)),
        entry("roles", FieldRule.nested(Section.ROLE)),
        entry("slaProperties", FieldRule.nested(Section.SLA_PROPERTY)),
        entry("quality", FieldRule.mapped()),
        entry("authoritativeDefinitions", FieldRule.stored()),
        entry("version", FieldRule.dropped("OpenMetadata versions the contract itself.")),
        entry("tenant", FieldRule.dropped(NO_CONTRACT_EQUIVALENT)),
        entry("domain", FieldRule.dropped("The contract takes its domain from the table.")),
        entry(
            "dataProduct",
            FieldRule.dropped("The contract takes its data product from the table.")),
        entry("tags", FieldRule.dropped(NO_CONTRACT_EQUIVALENT)),
        entry("support", FieldRule.dropped(NO_CONTRACT_EQUIVALENT)),
        entry("price", FieldRule.dropped(NO_CONTRACT_EQUIVALENT)),
        entry(
            "servers",
            FieldRule.dropped("OpenMetadata takes connection details from the table's service.")),
        entry("customProperties", FieldRule.dropped(NO_CONTRACT_EQUIVALENT)),
        entry("slaDefaultElement", FieldRule.dropped("It is deprecated since ODCS v3.1.0.")),
        entry(
            "contractCreatedTs",
            FieldRule.dropped("OpenMetadata records when it creates the contract.")),
        entry("context", FieldRule.dropped(ADDED_IN_V3_2)));
  }

  private static Map<String, FieldRule> descriptionFields() {
    return Map.of(
        "purpose", FieldRule.mapped(),
        "limitations", FieldRule.mapped(),
        "usage", FieldRule.mapped(),
        "authoritativeDefinitions", FieldRule.dropped(NO_CONTRACT_EQUIVALENT),
        "customProperties", FieldRule.dropped(NO_CONTRACT_EQUIVALENT));
  }

  private static Map<String, FieldRule> schemaObjectFields() {
    Map<String, FieldRule> fields = new HashMap<>();
    for (String key :
        Set.of(
            "physicalName",
            "businessName",
            "description",
            "physicalType",
            "dataGranularityDescription",
            "tags",
            "customProperties",
            "relationships",
            "id",
            "primaryKey",
            "required",
            "unique",
            "partitioned",
            "examples",
            "classification",
            "criticalDataElement",
            "logicalTypeOptions")) {
      fields.put(key, FieldRule.dropped(COLUMNS_ONLY));
    }
    V3_2_PROPERTY_FIELDS.forEach(key -> fields.put(key, FieldRule.dropped(ADDED_IN_V3_2)));
    fields.put(NAME, FieldRule.mapped());
    fields.put(LOGICAL_TYPE, FieldRule.mapped());
    fields.put("quality", FieldRule.mapped());
    fields.put("authoritativeDefinitions", FieldRule.stored());
    fields.put("transformSourceObjects", FieldRule.stored());
    fields.put(PROPERTIES, FieldRule.nested(Section.PROPERTY));
    return Map.copyOf(fields);
  }

  private static Map<String, FieldRule> propertyFields() {
    Map<String, FieldRule> fields = new HashMap<>();
    for (String key :
        Set.of(
            "physicalName",
            "businessName",
            "classification",
            "criticalDataElement",
            "examples",
            "partitioned",
            "partitionKeyPosition",
            "primaryKeyPosition",
            "encryptedName",
            "transformLogic",
            "transformDescription",
            "customProperties",
            "relationships",
            "id",
            "items")) {
      fields.put(key, FieldRule.dropped(NO_COLUMN_EQUIVALENT));
    }
    V3_2_PROPERTY_FIELDS.forEach(key -> fields.put(key, FieldRule.dropped(ADDED_IN_V3_2)));
    fields.put(
        "tags",
        FieldRule.dropped(
            "Tag the table's columns in OpenMetadata to classify or link glossary terms."));
    for (String key :
        Set.of(
            NAME,
            "description",
            "physicalType",
            LOGICAL_TYPE,
            "primaryKey",
            "unique",
            "required",
            "quality")) {
      fields.put(key, FieldRule.mapped());
    }
    fields.put("logicalTypeOptions", FieldRule.nested(Section.LOGICAL_TYPE_OPTIONS));
    fields.put(PROPERTIES, FieldRule.nested(Section.PROPERTY));
    fields.put("authoritativeDefinitions", FieldRule.stored());
    fields.put("transformSourceObjects", FieldRule.stored());
    return Map.copyOf(fields);
  }

  private static Map<String, FieldRule> teamFields() {
    return Map.of(
        "members",
        FieldRule.nested(Section.TEAM_MEMBER),
        NAME,
        FieldRule.dropped("Only the members who are owners are imported."),
        "description",
        FieldRule.dropped(NO_CONTRACT_EQUIVALENT),
        "tags",
        FieldRule.dropped(NO_CONTRACT_EQUIVALENT),
        "customProperties",
        FieldRule.dropped(NO_CONTRACT_EQUIVALENT),
        "authoritativeDefinitions",
        FieldRule.dropped(NO_CONTRACT_EQUIVALENT),
        "id",
        FieldRule.dropped(NO_CONTRACT_EQUIVALENT));
  }

  private static Map<String, FieldRule> teamMemberFields() {
    String ownersOnly = "OpenMetadata keeps the owners of the contract, not the rest of the team.";
    return Map.ofEntries(
        entry("username", FieldRule.mapped()),
        entry(NAME, FieldRule.mapped()),
        entry("role", FieldRule.mapped()),
        entry("description", FieldRule.dropped(ownersOnly)),
        entry("dateIn", FieldRule.dropped(ownersOnly)),
        entry("dateOut", FieldRule.dropped(ownersOnly)),
        entry("replacedByUsername", FieldRule.dropped(ownersOnly)),
        entry("tags", FieldRule.dropped(ownersOnly)),
        entry("customProperties", FieldRule.dropped(ownersOnly)),
        entry("authoritativeDefinitions", FieldRule.dropped(ownersOnly)),
        entry("id", FieldRule.dropped(ownersOnly)));
  }

  private static Map<String, FieldRule> roleFields() {
    String policyFields =
        "OpenMetadata access policies keep the role and its first-level approvers.";
    return Map.of(
        "role", FieldRule.mapped(),
        "firstLevelApprovers", FieldRule.mapped(),
        "access", FieldRule.dropped(policyFields),
        "description", FieldRule.dropped(policyFields),
        "secondLevelApprovers", FieldRule.dropped(policyFields),
        "customProperties", FieldRule.dropped(policyFields),
        "id", FieldRule.dropped(policyFields));
  }

  private static Map<String, FieldRule> slaPropertyFields() {
    String slaFields = "OpenMetadata SLAs keep the value, unit, timezone and column.";
    return Map.ofEntries(
        entry("property", FieldRule.mapped()),
        entry("value", FieldRule.mapped()),
        entry("unit", FieldRule.mapped()),
        entry("valueExt", FieldRule.mapped()),
        entry("element", FieldRule.mapped()),
        entry("driver", FieldRule.dropped(slaFields)),
        entry("description", FieldRule.dropped(slaFields)),
        entry("scheduler", FieldRule.dropped(slaFields)),
        entry("schedule", FieldRule.dropped(slaFields)),
        entry("customProperties", FieldRule.dropped(slaFields)),
        entry("authoritativeDefinitions", FieldRule.dropped(slaFields)),
        entry("id", FieldRule.dropped(slaFields)));
  }
}
