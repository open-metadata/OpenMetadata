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

import static org.openmetadata.common.utils.CommonUtil.listOrEmpty;
import static org.openmetadata.common.utils.CommonUtil.nullOrEmpty;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.UUID;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.datacontract.odcs.v310.CustomProperty;
import org.openmetadata.schema.type.datacontract.odcs.v310.DataQuality;
import org.openmetadata.schema.type.datacontract.odcs.v310.Description;
import org.openmetadata.schema.type.datacontract.odcs.v310.LogicalTypeOptions;
import org.openmetadata.schema.type.datacontract.odcs.v310.OdcsContract;
import org.openmetadata.schema.type.datacontract.odcs.v310.Role;
import org.openmetadata.schema.type.datacontract.odcs.v310.SchemaItemProperty;
import org.openmetadata.schema.type.datacontract.odcs.v310.SchemaObject;
import org.openmetadata.schema.type.datacontract.odcs.v310.SchemaProperty;
import org.openmetadata.schema.type.datacontract.odcs.v310.ServiceLevelAgreementProperty;
import org.openmetadata.schema.type.datacontract.odcs.v310.Team;
import org.openmetadata.schema.type.datacontract.odcs.v310.TeamMember;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.util.FullyQualifiedName;

/** Writes the v3.1.0 model directly; the reader's compatibility fields never become output. */
public final class ODCSV31Mapper implements ODCSVersionAdapter {
  private static final ObjectMapper JSON =
      new ObjectMapper()
          .setSerializationInclusion(JsonInclude.Include.NON_NULL)
          .disable(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES)
          .enable(DeserializationFeature.READ_UNKNOWN_ENUM_VALUES_AS_NULL);
  private static final String VERSION = "v3.1.0";
  private static final String CLASSIFICATION_PREFIX = "classification-";

  private record RuleMetadata(List<String> scope, int index, JsonNode fields) {}

  @Override
  public String version() {
    return VERSION;
  }

  @Override
  public String schemaLocation() {
    return "classpath:odcs/v3.1.0/schema.json";
  }

  @Override
  public JsonNode write(DataContract contract, List<ODCSQualityRule> nativeRules) {
    return write(contract, nativeRules, null);
  }

  JsonNode write(DataContract contract, List<ODCSQualityRule> nativeRules, String sourceObject) {
    OdcsContract document = document(contract);
    List<ODCSQualityRule> rules = new ArrayList<>(ODCSQualityRuleExporter.importedRules(contract));
    rules.addAll(listOrEmpty(nativeRules));
    List<RuleMetadata> metadata = new ArrayList<>();
    if (!nullOrEmpty(contract.getSchema()) || !rules.isEmpty()) {
      SchemaObject table = table(contract);
      if (sourceObject != null) table.setName(sourceObject);
      document.setSchema(List.of(table));
      for (ODCSQualityRule rule : rules) placeRule(table, rule, metadata);
    }
    ObjectNode result = JSON.valueToTree(document);
    metadata.forEach(extra -> restoreRuleMetadata(result, extra));
    return result;
  }

  @Override
  public ODCSNormalizationResult normalizeLegacy(JsonNode source) {
    return ODCSImportCompatibility.projectQualityForValidation(
        ODCSImportCompatibility.normalizeObjectSchema(source));
  }

  @Override
  public JsonNode materialize(JsonNode view, DataContract contract) {
    ObjectNode document = view.deepCopy();
    // The metadata overlay can restore source-version rule names after native serialization.
    ODCSImportQuality.normalize(document, false);
    ODCSImportCompatibility.finalizeQuality(document);
    if (contract.getOdcsPreservedFields() != null)
      ODCSImportCompatibility.embedImportedRules(document);
    return document;
  }

  private static OdcsContract document(DataContract contract) {
    OdcsContract document =
        new OdcsContract()
            .withKind(OdcsContract.Kind.fromValue("DataContract"))
            .withApiVersion(OdcsContract.ApiVersion.fromValue(VERSION))
            .withId(
                contract.getId() == null
                    ? UUID.randomUUID().toString()
                    : contract.getId().toString())
            .withName(contract.getName())
            .withVersion(contract.getVersion() == null ? "1.0.0" : contract.getVersion().toString())
            .withStatus(status(contract.getEntityStatus()));
    if (contract.getDescription() != null)
      document.setDescription(new Description().withPurpose(contract.getDescription()));
    if (contract.getEntity() != null) {
      String name = contract.getEntity().getFullyQualifiedName();
      document.setDataProduct(name);
      if (name != null) {
        String[] parts = FullyQualifiedName.split(name);
        document.setDomain(parts.length >= 2 ? parts[0] + "." + parts[1] : parts[0]);
      }
    }
    if (!nullOrEmpty(contract.getOwners())) document.setTeam(team(contract.getOwners()));
    if (contract.getSecurity() != null) document.setRoles(roles(contract));
    if (contract.getSla() != null) {
      document.setSlaProperties(
          ODCSSlaMapper.toOdcs(contract.getSla()).stream()
              .map(value -> JSON.convertValue(value, ServiceLevelAgreementProperty.class))
              .toList());
    }
    if (contract.getCreatedAt() != null)
      document.setContractCreatedTs(Instant.ofEpochMilli(contract.getCreatedAt()).toString());
    if (contract.getTermsOfUse() != null) document.setTags(List.of("terms-of-use"));
    JsonNode extension = JsonUtils.valueToTree(contract.getExtension());
    if (extension != null && extension.isObject() && !extension.isEmpty()) {
      List<CustomProperty> properties = new ArrayList<>();
      extension
          .fields()
          .forEachRemaining(
              entry ->
                  properties.add(
                      new CustomProperty()
                          .withProperty(entry.getKey())
                          .withValue(entry.getValue())));
      document.setCustomProperties(properties);
    }
    return document;
  }

  private static String status(EntityStatus status) {
    if (status == null) return "draft";
    return switch (status) {
      case DRAFT -> "draft";
      case APPROVED -> "active";
      case DEPRECATED -> "deprecated";
      case ARCHIVED -> "retired";
      default -> "draft";
    };
  }

  private static SchemaObject table(DataContract contract) {
    String name =
        contract.getEntity() == null || contract.getEntity().getName() == null
            ? contract.getName()
            : contract.getEntity().getName();
    SchemaObject table =
        new SchemaObject()
            .withName(name)
            .withLogicalType(SchemaObject.LogicalType.OBJECT)
            .withPhysicalType("table");
    if (contract.getEntity() != null) table.setDescription(contract.getEntity().getDescription());
    if (!nullOrEmpty(contract.getSchema()))
      table.setProperties(contract.getSchema().stream().map(ODCSV31Mapper::column).toList());
    return table;
  }

  private static SchemaProperty column(Column column) {
    SchemaProperty property =
        new SchemaProperty()
            .withName(column.getName())
            .withPhysicalName(column.getName())
            .withDescription(column.getDescription())
            .withLogicalType(logicalType(column.getDataType()))
            .withPhysicalType(
                column.getDataType() == null ? null : column.getDataType().toString());
    if (column.getConstraint() != null) {
      property.setPrimaryKey(column.getConstraint() == ColumnConstraint.PRIMARY_KEY);
      property.setUnique(column.getConstraint() == ColumnConstraint.UNIQUE);
      property.setRequired(column.getConstraint() == ColumnConstraint.NOT_NULL);
    }
    if (property.getLogicalType() == SchemaProperty.LogicalType.STRING
        && column.getDataLength() != null
        && column.getDataLength() >= 0) {
      property.setLogicalTypeOptions(
          new LogicalTypeOptions().withMaxLength(column.getDataLength()));
    }
    if (!nullOrEmpty(column.getChildren())
        && (property.getLogicalType() == SchemaProperty.LogicalType.OBJECT
            || property.getLogicalType() == SchemaProperty.LogicalType.ARRAY)) {
      List<SchemaProperty> children =
          column.getChildren().stream().map(ODCSV31Mapper::column).toList();
      if (property.getLogicalType() == SchemaProperty.LogicalType.ARRAY) {
        property.setItems(
            new SchemaItemProperty()
                .withLogicalType(SchemaItemProperty.LogicalType.OBJECT)
                .withProperties(children));
      } else property.setProperties(children);
    } else if (property.getLogicalType() == SchemaProperty.LogicalType.ARRAY
        && column.getArrayDataType() != null) {
      property.setItems(
          new SchemaItemProperty()
              .withLogicalType(
                  SchemaItemProperty.LogicalType.fromValue(
                      logicalType(column.getArrayDataType()).toString()))
              .withPhysicalType(column.getArrayDataType().toString()));
    }
    if (!nullOrEmpty(column.getTags())) {
      property.setTags(column.getTags().stream().map(tag -> tag.getTagFQN()).toList());
      property.setClassification(classification(property.getTags()));
    }
    return property;
  }

  private static SchemaProperty.LogicalType logicalType(ColumnDataType type) {
    if (type == null) return SchemaProperty.LogicalType.STRING;
    return switch (type) {
      case INT, SMALLINT, TINYINT, BYTEINT, BIGINT -> SchemaProperty.LogicalType.INTEGER;
      case FLOAT, DOUBLE, DECIMAL, NUMERIC, NUMBER -> SchemaProperty.LogicalType.NUMBER;
      case BOOLEAN -> SchemaProperty.LogicalType.BOOLEAN;
      case DATE, DATETIME -> SchemaProperty.LogicalType.DATE;
      case TIMESTAMP, TIMESTAMPZ -> SchemaProperty.LogicalType.TIMESTAMP;
      case TIME -> SchemaProperty.LogicalType.TIME;
      case ARRAY -> SchemaProperty.LogicalType.ARRAY;
      case MAP, STRUCT, JSON -> SchemaProperty.LogicalType.OBJECT;
      default -> SchemaProperty.LogicalType.STRING;
    };
  }

  private static String classification(List<String> tags) {
    for (String tag : tags) {
      if (tag == null) continue;
      String value = tag.toLowerCase(Locale.ROOT);
      if (value.contains("pii")) return "PII";
      if (value.contains("sensitive")) return "sensitive";
      if (value.contains("confidential")) return "confidential";
      if (value.contains("restricted")) return "restricted";
    }
    return null;
  }

  private static Team team(List<EntityReference> owners) {
    return new Team()
        .withMembers(
            owners.stream()
                .map(
                    owner ->
                        new TeamMember()
                            .withUsername(owner.getName())
                            .withName(
                                owner.getDisplayName() == null
                                    ? owner.getName()
                                    : owner.getDisplayName())
                            .withRole("owner"))
                .toList());
  }

  private static List<Role> roles(DataContract contract) {
    List<Role> roles = new ArrayList<>();
    for (var policy : listOrEmpty(contract.getSecurity().getPolicies())) {
      Role role =
          new Role()
              .withRole(
                  policy.getAccessPolicy() == null ? "data-consumer" : policy.getAccessPolicy())
              .withAccess("read");
      if (!nullOrEmpty(policy.getIdentities()))
        role.setFirstLevelApprovers(String.join(",", policy.getIdentities()));
      roles.add(role);
    }
    String classification = contract.getSecurity().getDataClassification();
    if (classification != null)
      roles.add(
          new Role()
              .withRole(CLASSIFICATION_PREFIX + classification)
              .withDescription("Data classification: " + classification));
    return roles.isEmpty() ? null : roles;
  }

  private static void placeRule(
      SchemaObject table, ODCSQualityRule source, List<RuleMetadata> metadata) {
    ObjectNode wireRule = ODCSImportCompatibility.qualityRule(JSON.valueToTree(source), false);
    DataQuality rule = JSON.convertValue(wireRule, DataQuality.class);
    collapseEqualBounds(source, rule);
    List<String> scope =
        nullOrEmpty(source.getColumn()) || source.getColumn().equals(table.getName())
            ? List.of()
            : Arrays.stream(FullyQualifiedName.split(source.getColumn()))
                .map(FullyQualifiedName::unquoteName)
                .toList();
    List<DataQuality> target;
    if (scope.isEmpty()) {
      if (table.getQuality() == null) table.setQuality(new ArrayList<>());
      target = table.getQuality();
    } else {
      SchemaProperty property = propertyTarget(table, scope);
      if (property.getQuality() == null) property.setQuality(new ArrayList<>());
      target = property.getQuality();
    }
    ObjectNode original = wireRule;
    original.remove("column");
    if (equalBounds(source.getMustBeBetween())) {
      original.remove("mustBeBetween");
      original.set("mustBe", JSON.valueToTree(source.getMustBeBetween().getFirst()));
    }
    if (equalBounds(source.getMustNotBeBetween())) {
      original.remove("mustNotBeBetween");
      original.set("mustNotBe", JSON.valueToTree(source.getMustNotBeBetween().getFirst()));
    }
    metadata.add(new RuleMetadata(scope, target.size(), original));
    target.add(rule);
  }

  private static void collapseEqualBounds(ODCSQualityRule source, DataQuality target) {
    if (equalBounds(source.getMustBeBetween())) {
      target.setMustBeBetween(null);
      target.setMustBe(source.getMustBeBetween().getFirst());
    }
    if (equalBounds(source.getMustNotBeBetween())) {
      target.setMustNotBeBetween(null);
      target.setMustNotBe(source.getMustNotBeBetween().getFirst());
    }
  }

  private static boolean equalBounds(List<Double> bounds) {
    return bounds != null
        && bounds.size() == 2
        && Objects.equals(bounds.getFirst(), bounds.getLast());
  }

  private static SchemaProperty propertyTarget(SchemaObject table, List<String> path) {
    if (table.getProperties() == null) table.setProperties(new ArrayList<>());
    else table.setProperties(new ArrayList<>(table.getProperties()));
    List<SchemaProperty> siblings = table.getProperties();
    SchemaProperty result = null;
    for (int index = 0; index < path.size(); index++) {
      String name = path.get(index);
      result =
          siblings.stream()
              .filter(property -> name.equals(property.getName()))
              .findFirst()
              .orElse(null);
      if (result == null) {
        result = new SchemaProperty().withName(name);
        siblings.add(result);
      }
      if (index < path.size() - 1) siblings = children(result);
    }
    return result;
  }

  private static List<SchemaProperty> children(SchemaProperty parent) {
    if (parent.getLogicalType() == SchemaProperty.LogicalType.ARRAY) {
      if (parent.getItems() == null)
        parent.setItems(
            new SchemaItemProperty().withLogicalType(SchemaItemProperty.LogicalType.OBJECT));
      if (parent.getItems().getProperties() == null)
        parent.getItems().setProperties(new ArrayList<>());
      else parent.getItems().setProperties(new ArrayList<>(parent.getItems().getProperties()));
      return parent.getItems().getProperties();
    }
    if (parent.getLogicalType() == null) parent.setLogicalType(SchemaProperty.LogicalType.OBJECT);
    if (parent.getProperties() == null) parent.setProperties(new ArrayList<>());
    else parent.setProperties(new ArrayList<>(parent.getProperties()));
    return parent.getProperties();
  }

  private static void restoreRuleMetadata(ObjectNode document, RuleMetadata metadata) {
    JsonNode scope = document.path("schema").path(0);
    for (int index = 0; index < metadata.scope().size(); index++) {
      String name = metadata.scope().get(index);
      JsonNode parent = scope;
      scope = null;
      for (JsonNode property : parent.path("properties"))
        if (name.equals(property.path("name").asText())) {
          scope = property;
          break;
        }
      if (scope == null)
        throw new IllegalStateException("ODCS quality scope disappeared: " + metadata.scope());
      if (index < metadata.scope().size() - 1 && scope.has("items")) scope = scope.path("items");
    }
    ObjectNode rule = (ObjectNode) scope.path("quality").get(metadata.index());
    metadata
        .fields()
        .fields()
        .forEachRemaining(field -> rule.set(field.getKey(), field.getValue().deepCopy()));
  }
}
