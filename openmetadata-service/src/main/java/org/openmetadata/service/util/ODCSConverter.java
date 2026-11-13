/*
 *  Copyright 2025 Collate
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

import com.fasterxml.jackson.annotation.JsonInclude;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.api.data.Policy;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSElementExtension;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSImportIssueCategory;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSRole;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSTeamMember;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.utils.JsonUtils;
import org.openmetadata.service.Entity;
import org.openmetadata.service.datacontract.odcs.ODCSExportService;
import org.openmetadata.service.datacontract.odcs.ODCSImportIssues;
import org.openmetadata.service.datacontract.odcs.ODCSPreservedFields;
import org.openmetadata.service.datacontract.odcs.ODCSShapeNormalizer;
import org.openmetadata.service.datacontract.odcs.ODCSSlaMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for converting between OpenMetadata DataContract and ODCS (Open Data Contract
 * Standard) v3.1.0 format.
 */
public class ODCSConverter {
  private static final Logger LOG = LoggerFactory.getLogger(ODCSConverter.class);
  private static final ObjectMapper MAPPER =
      new ObjectMapper().setSerializationInclusion(JsonInclude.Include.NON_NULL);
  private static final String OWNER_ROLE = "owner";

  private ODCSConverter() {}

  /**
   * Export an OpenMetadata DataContract to ODCS v3.1.0 format.
   *
   * @param contract The OpenMetadata DataContract to export
   * @return ODCSDataContract in ODCS v3.1.0 format
   */
  public static ODCSDataContract toODCS(DataContract contract) {
    return toODCS(contract, List.of());
  }

  /**
   * Export an OpenMetadata DataContract to ODCS v3.1.0 format, adding quality rules that are not
   * stored on the contract, such as the ones describing its own test cases.
   *
   * @param contract The OpenMetadata DataContract to export
   * @param additionalQualityRules Rules exported after the contract's stored ODCS rules
   * @return ODCSDataContract in ODCS v3.1.0 format
   */
  public static ODCSDataContract toODCS(
      DataContract contract, List<ODCSQualityRule> additionalQualityRules) {
    return MAPPER.convertValue(
        toODCSDocument(contract, additionalQualityRules), ODCSDataContract.class);
  }

  public static JsonNode toODCSDocument(
      DataContract contract, List<ODCSQualityRule> additionalQualityRules) {
    return toODCSDocument(contract, additionalQualityRules, Set.of());
  }

  public static JsonNode toODCSDocument(
      DataContract contract,
      List<ODCSQualityRule> additionalQualityRules,
      Set<String> managedNames) {
    return ODCSExportService.document(contract, additionalQualityRules, managedNames);
  }

  private static JsonNode captureBaseline(DataContract contract, String sourceTable) {
    ObjectNode applied = (ObjectNode) ODCSExportService.importBaseline(contract, sourceTable);
    ODCSShapeNormalizer.projectArrayItemsForReader(applied);
    if (contract.getOdcsQualityRules() != null && !contract.getOdcsQualityRules().isEmpty()) {
      applied.set("quality", MAPPER.valueToTree(contract.getOdcsQualityRules()));
    }
    return applied;
  }

  /**
   * Import an ODCS data contract to OpenMetadata DataContract format. Supports v3.0.2 and v3.1.0.
   * Automatically selects the schema object matching the entity name, or the first object if no
   * match is found.
   *
   * @param odcs The ODCS data contract to import
   * @param entityRef Reference to the target entity (table, topic, etc.)
   * @return OpenMetadata DataContract
   * @throws IllegalArgumentException if required ODCS fields are missing
   */
  public static DataContract fromODCS(ODCSDataContract odcs, EntityReference entityRef) {
    return fromODCS(odcs, entityRef, null);
  }

  /**
   * Import an ODCS data contract to OpenMetadata DataContract format. Supports v3.0.2 and v3.1.0.
   * For multi-object ODCS contracts, use objectName to specify which object to import.
   *
   * @param odcs The ODCS data contract to import
   * @param entityRef Reference to the target entity (table, topic, etc.)
   * @param objectName Name of the schema object to import (null for auto-selection)
   * @return OpenMetadata DataContract
   * @throws IllegalArgumentException if required ODCS fields are missing or objectName not found
   */
  public static DataContract fromODCS(
      ODCSDataContract odcs, EntityReference entityRef, String objectName) {
    return fromODCS(odcs, entityRef, objectName, ODCSImportIssues.discarding());
  }

  /**
   * Import an ODCS data contract, recording in {@code issues} what the import changes or leaves
   * out: owners that do not resolve and SLA properties the contract SLA cannot represent.
   */
  public static DataContract fromODCS(
      ODCSDataContract odcs,
      EntityReference entityRef,
      String objectName,
      ODCSImportIssues issues) {
    return fromODCS(odcs, entityRef, objectName, issues, MAPPER.valueToTree(odcs));
  }

  public static DataContract fromODCS(
      ODCSDataContract odcs,
      EntityReference entityRef,
      String objectName,
      ODCSImportIssues issues,
      JsonNode original) {
    validateRequiredODCSFields(odcs);

    DataContract contract = new DataContract();

    contract.setId(parseUUID(odcs.getId()));
    contract.setName(odcs.getName() != null ? odcs.getName() : generateContractName(entityRef));
    contract.setEntityStatus(mapODCSStatusToContract(odcs.getStatus()));

    if (odcs.getDescription() != null) {
      StringBuilder desc = new StringBuilder();
      if (odcs.getDescription().getPurpose() != null) {
        desc.append(odcs.getDescription().getPurpose());
      }
      if (odcs.getDescription().getLimitations() != null) {
        if (!desc.isEmpty()) desc.append("\n\n**Limitations:**\n");
        desc.append(odcs.getDescription().getLimitations());
      }
      if (odcs.getDescription().getUsage() != null) {
        if (!desc.isEmpty()) desc.append("\n\n**Usage:**\n");
        desc.append(odcs.getDescription().getUsage());
      }
      contract.setDescription(desc.toString());
    }

    contract.setEntity(entityRef);

    // Handle multi-object ODCS schema
    if (odcs.getSchema() != null && !odcs.getSchema().isEmpty()) {
      List<Column> columns = extractColumnsFromODCSSchema(odcs.getSchema(), entityRef, objectName);
      contract.setSchema(columns);
    }

    if (odcs.getTeam() != null && !nullOrEmpty(odcs.getTeam().getMembers())) {
      contract.setOwners(convertTeamToOwners(odcs.getTeam().getMembers(), issues));
    }

    if (odcs.getRoles() != null && !odcs.getRoles().isEmpty()) {
      contract.setSecurity(convertRolesToSecurity(odcs.getRoles()));
    }

    if (odcs.getSlaProperties() != null && !odcs.getSlaProperties().isEmpty()) {
      contract.setSla(ODCSSlaMapper.toContractSla(odcs.getSlaProperties(), issues));
    }

    String importedObject = importedSchemaObjectName(odcs, entityRef, objectName).orElse(null);
    List<ODCSQualityRule> allQualityRules = collectAllQualityRules(odcs, importedObject);
    if (!allQualityRules.isEmpty()) {
      contract.setOdcsQualityRules(allQualityRules);
    }

    contract.setOdcsPreservedFields(
        ODCSPreservedFields.capture(
            original, captureBaseline(contract, importedObject), importedObject));
    List<ODCSElementExtension> elementExtensions = collectElementExtensions(odcs);
    if (!elementExtensions.isEmpty()) {
      contract.setOdcsElementExtensions(elementExtensions);
    }

    return contract;
  }

  /**
   * Extract the list of schema object names from an ODCS contract. Used by UI to let users select
   * which object to import when the contract contains multiple objects.
   *
   * @param odcs The ODCS data contract
   * @return List of object names in the schema
   */
  public static List<String> getSchemaObjectNames(ODCSDataContract odcs) {
    if (odcs == null || odcs.getSchema() == null || odcs.getSchema().isEmpty()) {
      return new ArrayList<>();
    }

    return odcs.getSchema().stream()
        .filter(element -> element.getName() != null)
        .filter(
            element ->
                element.getLogicalType() == ODCSSchemaElement.LogicalType.OBJECT
                    || (element.getProperties() != null && !element.getProperties().isEmpty()))
        .map(ODCSSchemaElement::getName)
        .collect(Collectors.toList());
  }

  /**
   * Check if an ODCS contract has multiple schema objects (tables/datasets).
   *
   * @param odcs The ODCS data contract
   * @return true if the contract has more than one schema object
   */
  public static boolean hasMultipleSchemaObjects(ODCSDataContract odcs) {
    return getSchemaObjectNames(odcs).size() > 1;
  }

  /**
   * Name of the schema object whose properties become the contract's columns: the one named
   * {@code objectName}, else the one named like the entity, else the first. Empty when the schema
   * lists columns directly instead of objects.
   *
   * @throws IllegalArgumentException if {@code objectName} names no object of the schema
   */
  public static Optional<String> importedSchemaObjectName(
      ODCSDataContract odcs, EntityReference entityRef, String objectName) {
    return selectSchemaObject(listOrEmpty(odcs.getSchema()), entityRef, objectName)
        .map(ODCSSchemaElement::getName);
  }

  /**
   * Extract columns from ODCS schema, handling both single-object and multi-object schemas. For
   * multi-object schemas, selects the object matching entityRef name or objectName parameter.
   */
  private static List<Column> extractColumnsFromODCSSchema(
      List<ODCSSchemaElement> schema, EntityReference entityRef, String objectName) {
    List<Column> columns;
    if (schemaObjects(schema).isEmpty()) {
      // Legacy format: schema contains columns directly (not wrapped in objects)
      columns = convertODCSSchemaToColumns(schema);
    } else {
      columns =
          selectSchemaObject(schema, entityRef, objectName)
              .map(object -> convertODCSSchemaToColumns(object.getProperties()))
              .orElseGet(ArrayList::new);
    }
    return columns;
  }

  private static List<ODCSSchemaElement> schemaObjects(List<ODCSSchemaElement> schema) {
    // Note: properties is initialized to empty ArrayList by default, so check for non-empty
    return schema.stream()
        .filter(
            e ->
                e.getLogicalType() == ODCSSchemaElement.LogicalType.OBJECT
                    || (e.getProperties() != null && !e.getProperties().isEmpty()))
        .collect(Collectors.toList());
  }

  private static Optional<ODCSSchemaElement> selectSchemaObject(
      List<ODCSSchemaElement> schema, EntityReference entityRef, String objectName) {
    List<ODCSSchemaElement> objectElements = schemaObjects(schema);
    Optional<ODCSSchemaElement> selected = Optional.empty();
    if (!objectElements.isEmpty()) {
      selected =
          Optional.of(
              nullOrEmpty(objectName)
                  ? objectMatchingEntityOrFirst(objectElements, entityRef)
                  : namedObject(objectElements, objectName));
    }
    return selected;
  }

  private static ODCSSchemaElement namedObject(
      List<ODCSSchemaElement> objectElements, String objectName) {
    return objectElements.stream()
        .filter(e -> objectName.equalsIgnoreCase(e.getName()))
        .findFirst()
        .orElseThrow(
            () ->
                new IllegalArgumentException(
                    "Schema object '"
                        + objectName
                        + "' not found in ODCS contract. "
                        + "Available objects: "
                        + objectElements.stream().map(ODCSSchemaElement::getName).toList()));
  }

  private static ODCSSchemaElement objectMatchingEntityOrFirst(
      List<ODCSSchemaElement> objectElements, EntityReference entityRef) {
    String entityName = entityRef == null ? null : entityRef.getName();
    ODCSSchemaElement target =
        objectElements.stream()
            .filter(e -> entityName != null && entityName.equalsIgnoreCase(e.getName()))
            .findFirst()
            .orElse(objectElements.get(0));
    if (objectElements.size() > 1 && target == objectElements.get(0)) {
      LOG.info(
          "ODCS contract has {} schema objects. Using first object '{}'. "
              + "Use objectName parameter to select a specific object.",
          objectElements.size(),
          target.getName());
    }
    return target;
  }

  private static EntityStatus mapODCSStatusToContract(ODCSDataContract.OdcsStatus status) {
    if (status == null) return EntityStatus.DRAFT;
    return switch (status) {
      case ACTIVE -> EntityStatus.APPROVED;
      case DEPRECATED -> EntityStatus.DEPRECATED;
      case RETIRED -> EntityStatus.ARCHIVED;
      case PROPOSED, DRAFT -> EntityStatus.DRAFT;
    };
  }

  private static List<Column> convertODCSSchemaToColumns(List<ODCSSchemaElement> elements) {
    if (elements == null) return new ArrayList<>();
    return elements.stream()
        .map(ODCSConverter::convertODCSElementToColumn)
        .collect(Collectors.toList());
  }

  private static Column convertODCSElementToColumn(ODCSSchemaElement element) {
    Column column = new Column();
    column.setName(element.getName());
    column.setDescription(element.getDescription());
    column.setDataType(
        mapLogicalTypeToDataType(element.getLogicalType(), element.getPhysicalType()));

    if (column.getDataType() == ColumnDataType.ARRAY && element.getItems() != null) {
      column.setArrayDataType(
          mapLogicalTypeToDataType(
              element.getItems().getLogicalType(), element.getItems().getPhysicalType()));
    }

    if (Boolean.TRUE.equals(element.getPrimaryKey())) {
      column.setConstraint(ColumnConstraint.PRIMARY_KEY);
    } else if (Boolean.TRUE.equals(element.getUnique())) {
      column.setConstraint(ColumnConstraint.UNIQUE);
    } else if (Boolean.TRUE.equals(element.getRequired())) {
      column.setConstraint(ColumnConstraint.NOT_NULL);
    }

    if (element.getLogicalTypeOptions() != null
        && element.getLogicalTypeOptions().getMaxLength() != null) {
      column.setDataLength(element.getLogicalTypeOptions().getMaxLength());
    }

    if (element.getProperties() != null && !element.getProperties().isEmpty()) {
      column.setChildren(convertODCSSchemaToColumns(element.getProperties()));
    }

    return column;
  }

  private static ColumnDataType mapLogicalTypeToDataType(
      ODCSSchemaElement.LogicalType logicalType, String physicalType) {
    if (physicalType != null) {
      try {
        return ColumnDataType.valueOf(physicalType.toUpperCase());
      } catch (IllegalArgumentException ignored) {
      }
    }

    if (logicalType == null) return ColumnDataType.STRING;
    return switch (logicalType) {
      case INTEGER -> ColumnDataType.INT;
      case LONG -> ColumnDataType.BIGINT;
      case FLOAT -> ColumnDataType.FLOAT;
      case DOUBLE -> ColumnDataType.DOUBLE;
      case DECIMAL -> ColumnDataType.DECIMAL;
      case NUMBER -> ColumnDataType.NUMBER;
      case BOOLEAN -> ColumnDataType.BOOLEAN;
      case DATE -> ColumnDataType.DATE;
      case TIMESTAMP -> ColumnDataType.TIMESTAMP;
      case TIME -> ColumnDataType.TIME;
      case ARRAY -> ColumnDataType.ARRAY;
      case OBJECT -> ColumnDataType.STRUCT;
      case TEXT -> ColumnDataType.TEXT;
      case BYTES -> ColumnDataType.BINARY;
      case NULL -> ColumnDataType.NULL;
      case STRING -> ColumnDataType.STRING;
    };
  }

  private static List<EntityReference> convertTeamToOwners(
      List<ODCSTeamMember> members, ODCSImportIssues issues) {
    List<EntityReference> owners = new ArrayList<>();
    for (int index = 0; index < members.size(); index++) {
      ODCSTeamMember member = members.get(index);
      String path = "team.members[" + index + "]";
      if (!OWNER_ROLE.equalsIgnoreCase(member.getRole())) {
        issues.warning(
            ODCSImportIssueCategory.TEAM,
            "role",
            path + ".role",
            "Team members whose role is not `owner` are not imported; OpenMetadata keeps the contract's owners.");
      } else {
        addOwner(owners, member, path, issues);
      }
    }
    return owners;
  }

  private static void addOwner(
      List<EntityReference> owners, ODCSTeamMember member, String path, ODCSImportIssues issues) {
    EntityReference ref = resolveTeamMemberToEntity(member);
    if (ref == null) {
      issues.warning(
          ODCSImportIssueCategory.TEAM,
          "username",
          path,
          String.format(
              "Owner `%s` is not an OpenMetadata user or team, so the contract does not get this owner.",
              member.getUsername() != null ? member.getUsername() : member.getName()));
    } else {
      owners.add(ref);
    }
  }

  private static EntityReference resolveTeamMemberToEntity(ODCSTeamMember member) {
    String username = member.getUsername();
    String name = member.getName();

    // Try to find by username first (if provided)
    if (username != null && !username.isEmpty()) {
      try {
        User user = Entity.getEntityByName(Entity.USER, username, "", Include.NON_DELETED);
        if (user != null) {
          return user.getEntityReference();
        }
      } catch (Exception e) {
        LOG.debug("User not found by username '{}': {}", username, e.getMessage());
      }
    }

    // Try to find user by name
    if (name != null && !name.isEmpty()) {
      try {
        User user = Entity.getEntityByName(Entity.USER, name, "", Include.NON_DELETED);
        if (user != null) {
          return user.getEntityReference();
        }
      } catch (Exception e) {
        LOG.debug("User not found by name '{}': {}", name, e.getMessage());
      }

      // Try to find team by name
      try {
        Team team = Entity.getEntityByName(Entity.TEAM, name, "", Include.NON_DELETED);
        if (team != null) {
          return team.getEntityReference();
        }
      } catch (Exception e) {
        LOG.debug("Team not found by name '{}': {}", name, e.getMessage());
      }
    }

    LOG.warn(
        "Could not resolve ODCS team member to OpenMetadata user or team: username='{}', name='{}'",
        username,
        name);
    return null;
  }

  private static ContractSecurity convertRolesToSecurity(List<ODCSRole> roles) {
    ContractSecurity security = new ContractSecurity();
    List<Policy> policies = new ArrayList<>();

    for (ODCSRole role : roles) {
      if (role.getRole() != null && role.getRole().startsWith("classification-")) {
        security.setDataClassification(role.getRole().replace("classification-", ""));
      } else {
        Policy policy = new Policy();
        policy.setAccessPolicy(role.getRole());
        if (!nullOrEmpty(role.getFirstLevelApprovers())) {
          policy.setIdentities(splitApprovers(role.getFirstLevelApprovers()));
        }
        policies.add(policy);
      }
    }

    if (!policies.isEmpty()) {
      security.setPolicies(policies);
    }

    return security;
  }

  /** ODCS types the approvers as one string; the policy keeps them as a list. */
  private static List<String> splitApprovers(String approvers) {
    return Arrays.stream(approvers.split(","))
        .map(String::trim)
        .filter(identity -> !identity.isEmpty())
        .collect(Collectors.toList());
  }

  private static UUID parseUUID(String id) {
    if (id == null) return UUID.randomUUID();
    try {
      return UUID.fromString(id);
    } catch (IllegalArgumentException e) {
      return UUID.randomUUID();
    }
  }

  private static List<ODCSQualityRule> collectAllQualityRules(
      ODCSDataContract odcs, String selectedObject) {
    List<ODCSQualityRule> allRules = new ArrayList<>();

    if (odcs.getQuality() != null && !odcs.getQuality().isEmpty()) {
      allRules.addAll(odcs.getQuality());
    }

    if (odcs.getSchema() != null) {
      for (ODCSSchemaElement schemaObject : odcs.getSchema()) {
        if (selectedObject != null && !selectedObject.equals(schemaObject.getName())) continue;
        boolean table =
            schemaObject.getLogicalType() == ODCSSchemaElement.LogicalType.OBJECT
                || !nullOrEmpty(schemaObject.getProperties());
        collectQualityRulesFromElement(schemaObject, allRules, table ? null : "");
      }
    }

    return allRules;
  }

  private static void collectQualityRulesFromElement(
      ODCSSchemaElement element, List<ODCSQualityRule> allRules, String parentPath) {
    String columnPath =
        parentPath == null
            ? element.getName()
            : parentPath.isEmpty()
                ? FullyQualifiedName.quoteName(element.getName())
                : FullyQualifiedName.add(parentPath, element.getName());
    if (element.getQuality() != null && !element.getQuality().isEmpty()) {
      for (ODCSQualityRule rule : element.getQuality()) {
        if (rule.getColumn() == null || rule.getColumn().isEmpty()) {
          ODCSQualityRule copy = copyQualityRule(rule);
          copy.setColumn(columnPath);
          allRules.add(copy);
        } else {
          allRules.add(rule);
        }
      }
    }

    if (element.getProperties() != null) {
      for (ODCSSchemaElement property : element.getProperties()) {
        collectQualityRulesFromElement(property, allRules, parentPath == null ? "" : columnPath);
      }
    }
  }

  private static ODCSQualityRule copyQualityRule(ODCSQualityRule source) {
    return MAPPER.convertValue(source, ODCSQualityRule.class);
  }

  /**
   * Collects the ODCS attributes that OpenMetadata does not model on its own Column type, so that an
   * imported contract can be exported back without losing them. Each entry is anchored by the name
   * of the element it came from; an empty anchor means the attributes belong to the contract itself.
   */
  private static List<ODCSElementExtension> collectElementExtensions(ODCSDataContract odcs) {
    List<ODCSElementExtension> extensions = new ArrayList<>();

    if (!nullOrEmpty(odcs.getAuthoritativeDefinitions())) {
      ODCSElementExtension contractExtension = new ODCSElementExtension();
      contractExtension.setAuthoritativeDefinitions(odcs.getAuthoritativeDefinitions());
      extensions.add(contractExtension);
    }

    if (odcs.getSchema() != null) {
      for (ODCSSchemaElement schemaObject : odcs.getSchema()) {
        collectElementExtensionsFromElement(schemaObject, extensions);
      }
    }

    return extensions;
  }

  private static void collectElementExtensionsFromElement(
      ODCSSchemaElement element, List<ODCSElementExtension> extensions) {
    ODCSElementExtension extension = toElementExtension(element);
    if (extension != null) {
      extensions.add(extension);
    }

    if (element.getProperties() != null) {
      for (ODCSSchemaElement property : element.getProperties()) {
        collectElementExtensionsFromElement(property, extensions);
      }
    }
  }

  private static ODCSElementExtension toElementExtension(ODCSSchemaElement element) {
    boolean hasDefinitions = !nullOrEmpty(element.getAuthoritativeDefinitions());
    boolean hasTransformSources = !nullOrEmpty(element.getTransformSourceObjects());

    ODCSElementExtension extension = null;
    if (hasDefinitions || hasTransformSources) {
      extension = new ODCSElementExtension();
      extension.setElement(element.getName());
      if (hasDefinitions) {
        extension.setAuthoritativeDefinitions(element.getAuthoritativeDefinitions());
      }
      if (hasTransformSources) {
        extension.setTransformSourceObjects(element.getTransformSourceObjects());
      }
    }
    return extension;
  }

  /**
   * Normalizes ODCS input to handle flexible representations without reporting the changes, for
   * callers like the parse endpoint that return no import report: a team written in the deprecated
   * ODCS v3.0.2 bare-array form into the v3.1.0 object form, legacy arrays of approvers back into
   * the conformant scalar strings, and the legacy map-form customProperties into the ODCS array
   * form. Import endpoints that report use {@link ODCSShapeNormalizer#normalize} instead.
   */
  public static void normalizeODCSInput(JsonNode rootNode) {
    if (rootNode == null || !rootNode.isObject()) return;
    ODCSShapeNormalizer.normalize((ObjectNode) rootNode, ODCSImportIssues.discarding());
  }

  private static void validateRequiredODCSFields(ODCSDataContract odcs) {
    List<String> missingFields = new ArrayList<>();

    // Note: apiVersion has a default value in the generated class, so it can never be null
    if (odcs.getKind() == null) {
      missingFields.add("kind");
    }
    if (odcs.getStatus() == null) {
      missingFields.add("status");
    }

    if (!missingFields.isEmpty()) {
      throw new IllegalArgumentException(
          "Missing required ODCS fields: " + String.join(", ", missingFields));
    }
  }

  private static String generateContractName(EntityReference entity) {
    if (entity == null || entity.getName() == null) {
      return "contract_" + UUID.randomUUID().toString().substring(0, 8);
    }
    return entity.getName() + "_contract";
  }

  /**
   * Smart merge an imported ODCS contract with an existing DataContract. Fields from the imported
   * contract take precedence, but fields not present in the import are preserved from the existing
   * contract.
   *
   * @param existing The existing DataContract
   * @param imported The imported DataContract from ODCS
   * @return Merged DataContract
   */
  private static Object mergeNativeExtensions(Object existing, Object imported) {
    if (imported == null) return existing;
    if (existing == null) return imported;
    ObjectNode merged = (ObjectNode) JsonUtils.valueToTree(existing);
    JsonNode incoming = JsonUtils.valueToTree(imported);
    incoming
        .fields()
        .forEachRemaining(field -> merged.set(field.getKey(), field.getValue().deepCopy()));
    return JsonUtils.treeToValue(merged, Object.class);
  }

  public static DataContract smartMerge(DataContract existing, DataContract imported) {
    if (existing == null) return imported;
    if (imported == null) return existing;

    DataContract merged = new DataContract();

    // Preserve existing identity fields to maintain FQN integrity
    merged.setId(existing.getId());
    merged.setName(existing.getName());
    merged.setFullyQualifiedName(existing.getFullyQualifiedName());
    merged.setDescription(
        imported.getDescription() != null ? imported.getDescription() : existing.getDescription());
    merged.setEntityStatus(
        imported.getEntityStatus() != null
            ? imported.getEntityStatus()
            : existing.getEntityStatus());
    merged.setEntity(existing.getEntity());

    merged.setSchema(
        imported.getSchema() != null && !imported.getSchema().isEmpty()
            ? imported.getSchema()
            : existing.getSchema());

    merged.setSla(
        imported.getSla() != null
            ? mergeSLA(existing.getSla(), imported.getSla())
            : existing.getSla());

    merged.setSecurity(
        imported.getSecurity() != null ? imported.getSecurity() : existing.getSecurity());

    merged.setOwners(
        imported.getOwners() != null && !imported.getOwners().isEmpty()
            ? imported.getOwners()
            : existing.getOwners());

    merged.setReviewers(existing.getReviewers());

    merged.setTermsOfUse(
        imported.getTermsOfUse() != null ? imported.getTermsOfUse() : existing.getTermsOfUse());

    merged.setExtension(mergeNativeExtensions(existing.getExtension(), imported.getExtension()));

    merged.setOdcsQualityRules(
        !nullOrEmpty(imported.getOdcsQualityRules())
            ? imported.getOdcsQualityRules()
            : existing.getOdcsQualityRules());

    merged.setQualityExpectations(
        mergeQualityExpectations(
            existing.getQualityExpectations(), imported.getQualityExpectations()));

    merged.setSemantics(
        !nullOrEmpty(imported.getSemantics()) ? imported.getSemantics() : existing.getSemantics());

    merged.setOdcsElementExtensions(
        !nullOrEmpty(imported.getOdcsElementExtensions())
            ? imported.getOdcsElementExtensions()
            : existing.getOdcsElementExtensions());

    merged.setOdcsPreservedFields(
        ODCSPreservedFields.merge(
            existing.getOdcsPreservedFields(), imported.getOdcsPreservedFields()));
    merged.setVersion(existing.getVersion());
    merged.setCreatedAt(existing.getCreatedAt());
    merged.setCreatedBy(existing.getCreatedBy());

    return merged;
  }

  /**
   * Performs a full replace of the existing contract with imported data, preserving only identity
   * fields and execution history. This is used when the user wants to completely overwrite the
   * contract without losing the contract ID and run history.
   *
   * @param existing The existing DataContract
   * @param imported The imported DataContract from ODCS
   * @return Replaced DataContract with preserved identity
   */
  public static DataContract fullReplace(DataContract existing, DataContract imported) {
    if (existing == null) return imported;
    if (imported == null) return existing;

    // Start with imported data
    DataContract replaced = new DataContract();

    // Preserve identity fields from existing (critical for maintaining history)
    replaced.setId(existing.getId());
    replaced.setName(existing.getName());
    replaced.setFullyQualifiedName(existing.getFullyQualifiedName());
    replaced.setEntity(existing.getEntity());
    replaced.setVersion(existing.getVersion());
    replaced.setCreatedAt(existing.getCreatedAt());
    replaced.setCreatedBy(existing.getCreatedBy());

    // Preserve execution history reference
    replaced.setLatestResult(existing.getLatestResult());
    replaced.setTestSuite(existing.getTestSuite());

    // Replace all other fields from imported
    replaced.setDescription(imported.getDescription());
    replaced.setEntityStatus(imported.getEntityStatus());
    replaced.setSchema(imported.getSchema());
    replaced.setSla(imported.getSla());
    replaced.setSecurity(imported.getSecurity());
    replaced.setOwners(imported.getOwners());
    replaced.setReviewers(imported.getReviewers());
    replaced.setTermsOfUse(imported.getTermsOfUse());
    replaced.setExtension(imported.getExtension());
    replaced.setSemantics(imported.getSemantics());
    // An empty list is how a replace says "the re-imported document declares none of these".
    // Leaving null would read as "not specified" and be carried forward on the next write.
    replaced.setOdcsQualityRules(listOrEmpty(imported.getOdcsQualityRules()));
    replaced.setOdcsElementExtensions(listOrEmpty(imported.getOdcsElementExtensions()));
    replaced.setOdcsPreservedFields(
        imported.getOdcsPreservedFields() == null
            ? MAPPER.createObjectNode()
            : imported.getOdcsPreservedFields());
    replaced.setQualityExpectations(listOrEmpty(imported.getQualityExpectations()));

    return replaced;
  }

  /**
   * Test cases the contract links today stay linked; the ones the import produced are added, and a
   * test case linked by both is kept once, in the position it already had.
   */
  private static List<EntityReference> mergeQualityExpectations(
      List<EntityReference> existing, List<EntityReference> imported) {
    Map<UUID, EntityReference> byId = new LinkedHashMap<>();
    listOrEmpty(existing).forEach(reference -> byId.putIfAbsent(reference.getId(), reference));
    listOrEmpty(imported).forEach(reference -> byId.putIfAbsent(reference.getId(), reference));
    return byId.isEmpty() ? existing : new ArrayList<>(byId.values());
  }

  private static ContractSLA mergeSLA(ContractSLA existing, ContractSLA imported) {
    if (existing == null) return imported;
    if (imported == null) return existing;

    ContractSLA merged = new ContractSLA();

    merged.setRefreshFrequency(
        imported.getRefreshFrequency() != null
            ? imported.getRefreshFrequency()
            : existing.getRefreshFrequency());
    merged.setMaxLatency(
        imported.getMaxLatency() != null ? imported.getMaxLatency() : existing.getMaxLatency());
    merged.setRetention(
        imported.getRetention() != null ? imported.getRetention() : existing.getRetention());
    merged.setAvailabilityTime(
        imported.getAvailabilityTime() != null
            ? imported.getAvailabilityTime()
            : existing.getAvailabilityTime());
    merged.setTimezone(
        imported.getTimezone() != null ? imported.getTimezone() : existing.getTimezone());
    merged.setColumnName(
        imported.getColumnName() != null ? imported.getColumnName() : existing.getColumnName());

    return merged;
  }
}
