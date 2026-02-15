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

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import org.openmetadata.schema.api.data.ContractSLA;
import org.openmetadata.schema.api.data.ContractSecurity;
import org.openmetadata.schema.api.data.MaxLatency;
import org.openmetadata.schema.api.data.Policy;
import org.openmetadata.schema.api.data.RefreshFrequency;
import org.openmetadata.schema.api.data.Retention;
import org.openmetadata.schema.entity.data.DataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDataContract;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSDescription;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSLogicalTypeOptions;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSQualityRule;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSRole;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSTeamMember;
import org.openmetadata.schema.entity.teams.Team;
import org.openmetadata.schema.entity.teams.User;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.Include;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Utility class for converting between OpenMetadata DataContract and ODCS (Open Data Contract
 * Standard) v3.1.0 format.
 */
public class ODCSConverter {
  private static final Logger LOG = LoggerFactory.getLogger(ODCSConverter.class);
  private static final ObjectMapper MAPPER = new ObjectMapper();

  private ODCSConverter() {}

  /**
   * Export an OpenMetadata DataContract to ODCS v3.1.0 format.
   *
   * @param contract The OpenMetadata DataContract to export
   * @return ODCSDataContract in ODCS v3.1.0 format
   */
  public static ODCSDataContract toODCS(DataContract contract) {
    ODCSDataContract odcs = new ODCSDataContract();

    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_1_0);
    odcs.setKind(ODCSDataContract.OdcsKind.DATA_CONTRACT);
    odcs.setId(
        contract.getId() != null ? contract.getId().toString() : UUID.randomUUID().toString());
    odcs.setName(contract.getName());
    odcs.setVersion(contract.getVersion() != null ? contract.getVersion().toString() : "1.0.0");
    odcs.setStatus(mapContractStatusToODCS(contract.getEntityStatus()));

    if (contract.getDescription() != null) {
      ODCSDescription desc = new ODCSDescription();
      desc.setPurpose(contract.getDescription());
      odcs.setDescription(desc);
    }

    if (contract.getEntity() != null) {
      odcs.setDomain(extractDomainFromEntity(contract.getEntity()));
      odcs.setDataProduct(contract.getEntity().getFullyQualifiedName());
    }

    // ODCS v3.1.0: Schema is an array of objects (tables/datasets), each with properties (columns)
    // Wrap columns in a parent object representing the entity
    if (contract.getSchema() != null && !contract.getSchema().isEmpty()) {
      ODCSSchemaElement tableObject = new ODCSSchemaElement();
      String entityName =
          contract.getEntity() != null ? contract.getEntity().getName() : contract.getName();
      tableObject.setName(entityName);
      tableObject.setLogicalType(ODCSSchemaElement.LogicalType.OBJECT);
      tableObject.setPhysicalType("table");
      if (contract.getEntity() != null && contract.getEntity().getDescription() != null) {
        tableObject.setDescription(contract.getEntity().getDescription());
      }
      tableObject.setProperties(convertSchemaToODCS(contract.getSchema()));

      List<ODCSSchemaElement> schemaObjects = new ArrayList<>();
      schemaObjects.add(tableObject);
      odcs.setSchema(schemaObjects);
    }

    if (contract.getOwners() != null && !contract.getOwners().isEmpty()) {
      odcs.setTeam(convertOwnersToTeam(contract.getOwners()));
    }

    if (contract.getSecurity() != null) {
      odcs.setRoles(convertSecurityToRoles(contract.getSecurity()));
    }

    if (contract.getSla() != null) {
      odcs.setSlaProperties(convertSLAToODCS(contract.getSla()));
    }

    if (contract.getCreatedAt() != null) {
      odcs.setContractCreatedTs(new Date(contract.getCreatedAt()));
    }

    List<String> tags = new ArrayList<>();
    if (contract.getTermsOfUse() != null) {
      tags.add("terms-of-use");
    }
    if (!tags.isEmpty()) {
      odcs.setTags(tags);
    }

    if (contract.getOdcsQualityRules() != null && !contract.getOdcsQualityRules().isEmpty()) {
      distributeQualityRules(odcs, contract.getOdcsQualityRules());
    }

    return odcs;
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
        if (desc.length() > 0) desc.append("\n\n**Limitations:**\n");
        desc.append(odcs.getDescription().getLimitations());
      }
      if (odcs.getDescription().getUsage() != null) {
        if (desc.length() > 0) desc.append("\n\n**Usage:**\n");
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

    if (odcs.getTeam() != null && !odcs.getTeam().isEmpty()) {
      contract.setOwners(convertTeamToOwners(odcs.getTeam()));
    }

    if (odcs.getRoles() != null && !odcs.getRoles().isEmpty()) {
      contract.setSecurity(convertRolesToSecurity(odcs.getRoles()));
    }

    if (odcs.getSlaProperties() != null && !odcs.getSlaProperties().isEmpty()) {
      contract.setSla(convertODCSSLAToContract(odcs.getSlaProperties()));
    }

    List<ODCSQualityRule> allQualityRules = collectAllQualityRules(odcs);
    if (!allQualityRules.isEmpty()) {
      contract.setOdcsQualityRules(allQualityRules);
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
   * Extract columns from ODCS schema, handling both single-object and multi-object schemas. For
   * multi-object schemas, selects the object matching entityRef name or objectName parameter.
   */
  private static List<Column> extractColumnsFromODCSSchema(
      List<ODCSSchemaElement> schema, EntityReference entityRef, String objectName) {
    if (schema == null || schema.isEmpty()) {
      return new ArrayList<>();
    }

    // Check if schema contains object-type elements (tables/datasets)
    // Note: properties is initialized to empty ArrayList by default, so check for non-empty
    List<ODCSSchemaElement> objectElements =
        schema.stream()
            .filter(
                e ->
                    e.getLogicalType() == ODCSSchemaElement.LogicalType.OBJECT
                        || (e.getProperties() != null && !e.getProperties().isEmpty()))
            .collect(Collectors.toList());

    if (objectElements.isEmpty()) {
      // Legacy format: schema contains columns directly (not wrapped in objects)
      return convertODCSSchemaToColumns(schema);
    }

    // Multi-object or single-object schema: find the right object
    ODCSSchemaElement targetObject = null;

    // If objectName is explicitly specified, use it
    if (objectName != null && !objectName.isEmpty()) {
      targetObject =
          objectElements.stream()
              .filter(e -> objectName.equalsIgnoreCase(e.getName()))
              .findFirst()
              .orElse(null);

      if (targetObject == null) {
        throw new IllegalArgumentException(
            "Schema object '"
                + objectName
                + "' not found in ODCS contract. "
                + "Available objects: "
                + objectElements.stream().map(ODCSSchemaElement::getName).toList());
      }
    }

    // Try to match by entity name
    if (targetObject == null && entityRef != null && entityRef.getName() != null) {
      String entityName = entityRef.getName();
      targetObject =
          objectElements.stream()
              .filter(e -> entityName.equalsIgnoreCase(e.getName()))
              .findFirst()
              .orElse(null);
    }

    // Fall back to first object
    if (targetObject == null) {
      targetObject = objectElements.get(0);
      if (objectElements.size() > 1) {
        LOG.info(
            "ODCS contract has {} schema objects. Using first object '{}'. "
                + "Use objectName parameter to select a specific object.",
            objectElements.size(),
            targetObject.getName());
      }
    }

    // Extract properties (columns) from the selected object
    if (targetObject.getProperties() != null) {
      return convertODCSSchemaToColumns(targetObject.getProperties());
    }

    return new ArrayList<>();
  }

  private static ODCSDataContract.OdcsStatus mapContractStatusToODCS(EntityStatus status) {
    if (status == null) return ODCSDataContract.OdcsStatus.DRAFT;
    return switch (status) {
      case APPROVED -> ODCSDataContract.OdcsStatus.ACTIVE;
      case DEPRECATED -> ODCSDataContract.OdcsStatus.DEPRECATED;
      case DRAFT, IN_REVIEW, REJECTED, UNPROCESSED -> ODCSDataContract.OdcsStatus.DRAFT;
    };
  }

  private static EntityStatus mapODCSStatusToContract(ODCSDataContract.OdcsStatus status) {
    if (status == null) return EntityStatus.DRAFT;
    return switch (status) {
      case ACTIVE -> EntityStatus.APPROVED;
      case DEPRECATED, RETIRED -> EntityStatus.DEPRECATED;
      case PROPOSED, DRAFT -> EntityStatus.DRAFT;
    };
  }

  private static String extractDomainFromEntity(EntityReference entity) {
    if (entity == null || entity.getFullyQualifiedName() == null) return null;
    String fqn = entity.getFullyQualifiedName();
    String[] parts = fqn.split("\\.");
    if (parts.length >= 2) {
      return parts[0] + "." + parts[1];
    }
    return parts[0];
  }

  private static List<ODCSSchemaElement> convertSchemaToODCS(List<Column> columns) {
    if (columns == null) return new ArrayList<>();
    return columns.stream().map(ODCSConverter::convertColumnToODCS).collect(Collectors.toList());
  }

  private static ODCSSchemaElement convertColumnToODCS(Column column) {
    ODCSSchemaElement element = new ODCSSchemaElement();
    element.setName(column.getName());
    element.setPhysicalName(column.getName());
    element.setDescription(column.getDescription());
    element.setLogicalType(mapDataTypeToLogicalType(column.getDataType()));
    element.setPhysicalType(column.getDataType() != null ? column.getDataType().toString() : null);

    if (column.getConstraint() != null) {
      element.setPrimaryKey(column.getConstraint() == ColumnConstraint.PRIMARY_KEY);
      element.setUnique(column.getConstraint() == ColumnConstraint.UNIQUE);
      element.setRequired(column.getConstraint() == ColumnConstraint.NOT_NULL);
    }

    if (column.getDataLength() != null) {
      ODCSLogicalTypeOptions options = new ODCSLogicalTypeOptions();
      options.setMaxLength(column.getDataLength());
      element.setLogicalTypeOptions(options);
    }

    if (column.getTags() != null && !column.getTags().isEmpty()) {
      List<String> tags =
          column.getTags().stream().map(TagLabel::getTagFQN).collect(Collectors.toList());
      element.setTags(tags);

      for (TagLabel tag : column.getTags()) {
        String tagFqn = tag.getTagFQN();
        if (tagFqn != null && tagFqn.toLowerCase().contains("pii")) {
          element.setClassification("PII");
          break;
        } else if (tagFqn != null && tagFqn.toLowerCase().contains("sensitive")) {
          element.setClassification("sensitive");
          break;
        } else if (tagFqn != null && tagFqn.toLowerCase().contains("confidential")) {
          element.setClassification("confidential");
          break;
        } else if (tagFqn != null && tagFqn.toLowerCase().contains("restricted")) {
          element.setClassification("restricted");
          break;
        }
      }
    }

    if (column.getChildren() != null && !column.getChildren().isEmpty()) {
      element.setProperties(convertSchemaToODCS(column.getChildren()));
    }

    return element;
  }

  private static ODCSSchemaElement.LogicalType mapDataTypeToLogicalType(ColumnDataType dataType) {
    if (dataType == null) return ODCSSchemaElement.LogicalType.STRING;
    return switch (dataType) {
      case INT, SMALLINT, TINYINT, BYTEINT -> ODCSSchemaElement.LogicalType.INTEGER;
      case BIGINT -> ODCSSchemaElement.LogicalType.LONG;
      case FLOAT -> ODCSSchemaElement.LogicalType.FLOAT;
      case DOUBLE -> ODCSSchemaElement.LogicalType.DOUBLE;
      case DECIMAL, NUMERIC -> ODCSSchemaElement.LogicalType.DECIMAL;
      case NUMBER -> ODCSSchemaElement.LogicalType.NUMBER;
      case BOOLEAN -> ODCSSchemaElement.LogicalType.BOOLEAN;
      case DATE, DATETIME -> ODCSSchemaElement.LogicalType.DATE;
      case TIMESTAMP, TIMESTAMPZ -> ODCSSchemaElement.LogicalType.TIMESTAMP;
      case TIME -> ODCSSchemaElement.LogicalType.TIME;
      case ARRAY -> ODCSSchemaElement.LogicalType.ARRAY;
      case MAP, STRUCT, JSON -> ODCSSchemaElement.LogicalType.OBJECT;
      case BLOB, BYTEA, BINARY, VARBINARY, LONGBLOB, MEDIUMBLOB -> ODCSSchemaElement.LogicalType
          .BYTES;
      case TEXT, MEDIUMTEXT, CLOB, NTEXT -> ODCSSchemaElement.LogicalType.TEXT;
      default -> ODCSSchemaElement.LogicalType.STRING;
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

  private static List<ODCSTeamMember> convertOwnersToTeam(List<EntityReference> owners) {
    if (owners == null) return new ArrayList<>();
    return owners.stream()
        .map(
            owner -> {
              ODCSTeamMember member = new ODCSTeamMember();
              member.setUsername(owner.getName());
              member.setName(
                  owner.getDisplayName() != null ? owner.getDisplayName() : owner.getName());
              member.setRole("owner");
              return member;
            })
        .collect(Collectors.toList());
  }

  private static List<EntityReference> convertTeamToOwners(List<ODCSTeamMember> team) {
    if (team == null) return new ArrayList<>();

    List<EntityReference> owners = new ArrayList<>();
    for (ODCSTeamMember member : team) {
      if (!"owner".equalsIgnoreCase(member.getRole())) {
        continue;
      }

      EntityReference ref = resolveTeamMemberToEntity(member);
      if (ref != null) {
        owners.add(ref);
      }
    }
    return owners;
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

  private static List<ODCSRole> convertSecurityToRoles(ContractSecurity security) {
    List<ODCSRole> roles = new ArrayList<>();

    if (security.getPolicies() != null) {
      for (Policy policy : security.getPolicies()) {
        ODCSRole role = new ODCSRole();
        role.setRole(policy.getAccessPolicy() != null ? policy.getAccessPolicy() : "data-consumer");
        role.setAccess(ODCSRole.Access.READ);

        if (policy.getIdentities() != null) {
          role.setFirstLevelApprovers(new ArrayList<>(policy.getIdentities()));
        }

        roles.add(role);
      }
    }

    if (security.getDataClassification() != null) {
      ODCSRole classificationRole = new ODCSRole();
      classificationRole.setRole("classification-" + security.getDataClassification());
      classificationRole.setDescription("Data classification: " + security.getDataClassification());
      roles.add(classificationRole);
    }

    return roles;
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
        if (role.getFirstLevelApprovers() != null) {
          policy.setIdentities(new ArrayList<>(role.getFirstLevelApprovers()));
        }
        policies.add(policy);
      }
    }

    if (!policies.isEmpty()) {
      security.setPolicies(policies);
    }

    return security;
  }

  private static List<ODCSSlaProperty> convertSLAToODCS(ContractSLA sla) {
    List<ODCSSlaProperty> properties = new ArrayList<>();

    if (sla.getRefreshFrequency() != null) {
      ODCSSlaProperty prop = new ODCSSlaProperty();
      prop.setProperty("freshness"); // ODCS uses "freshness"
      prop.setValue(String.valueOf(sla.getRefreshFrequency().getInterval()));
      if (sla.getRefreshFrequency().getUnit() != null) {
        prop.setUnit(sla.getRefreshFrequency().getUnit().value());
      }
      properties.add(prop);
    }

    if (sla.getMaxLatency() != null) {
      ODCSSlaProperty prop = new ODCSSlaProperty();
      prop.setProperty("latency"); // ODCS uses "latency"
      prop.setValue(String.valueOf(sla.getMaxLatency().getValue()));
      if (sla.getMaxLatency().getUnit() != null) {
        prop.setUnit(sla.getMaxLatency().getUnit().value());
      }
      properties.add(prop);
    }

    if (sla.getRetention() != null) {
      ODCSSlaProperty prop = new ODCSSlaProperty();
      prop.setProperty("retention");
      prop.setValue(String.valueOf(sla.getRetention().getPeriod()));
      if (sla.getRetention().getUnit() != null) {
        prop.setUnit(sla.getRetention().getUnit().value());
      }
      properties.add(prop);
    }

    if (sla.getAvailabilityTime() != null) {
      ODCSSlaProperty prop = new ODCSSlaProperty();
      prop.setProperty("availabilityTime");
      prop.setValue(sla.getAvailabilityTime());
      if (sla.getTimezone() != null) {
        prop.setValueExt(sla.getTimezone().value());
      }
      properties.add(prop);
    }

    return properties;
  }

  private static ContractSLA convertODCSSLAToContract(List<ODCSSlaProperty> slaProperties) {
    ContractSLA sla = new ContractSLA();

    for (ODCSSlaProperty prop : slaProperties) {
      if (prop.getProperty() == null) continue;

      switch (prop.getProperty().toLowerCase()) {
        case "freshness", "refreshfrequency" -> {
          // ODCS uses "freshness", OpenMetadata uses "refreshFrequency"
          RefreshFrequency rf = new RefreshFrequency();
          rf.setInterval(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            rf.setUnit(RefreshFrequency.Unit.fromValue(normalizeTimeUnit(prop.getUnit())));
          }
          sla.setRefreshFrequency(rf);
        }
        case "latency", "maxlatency" -> {
          // ODCS uses "latency", OpenMetadata uses "maxLatency"
          MaxLatency ml = new MaxLatency();
          ml.setValue(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            ml.setUnit(MaxLatency.Unit.fromValue(normalizeTimeUnit(prop.getUnit())));
          }
          sla.setMaxLatency(ml);
        }
        case "retention" -> {
          Retention ret = new Retention();
          ret.setPeriod(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            ret.setUnit(Retention.Unit.fromValue(normalizeTimeUnit(prop.getUnit())));
          }
          sla.setRetention(ret);
        }
        case "availabilitytime" -> {
          sla.setAvailabilityTime(prop.getValue());
          if (prop.getValueExt() != null) {
            try {
              sla.setTimezone(ContractSLA.Timezone.fromValue(prop.getValueExt()));
            } catch (IllegalArgumentException ignored) {
              // Invalid timezone, ignore
            }
          }
        }
      }
    }

    return sla;
  }

  private static UUID parseUUID(String id) {
    if (id == null) return UUID.randomUUID();
    try {
      return UUID.fromString(id);
    } catch (IllegalArgumentException e) {
      return UUID.randomUUID();
    }
  }

  private static Integer parseInteger(String value) {
    if (value == null) return 0;
    try {
      return Integer.parseInt(value);
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static String normalizeTimeUnit(String unit) {
    if (unit == null) return null;
    String lower = unit.toLowerCase().trim();
    return switch (lower) {
      case "hours", "hrs", "h" -> "hour";
      case "days", "d" -> "day";
      case "weeks", "wks", "w" -> "week";
      case "months", "mos" -> "month";
      case "years", "yrs", "y" -> "year";
      case "minutes", "mins", "m" -> "minute";
      case "seconds", "secs", "s" -> "second";
      default -> lower;
    };
  }

  private static List<ODCSQualityRule> collectAllQualityRules(ODCSDataContract odcs) {
    List<ODCSQualityRule> allRules = new ArrayList<>();

    if (odcs.getQuality() != null && !odcs.getQuality().isEmpty()) {
      allRules.addAll(odcs.getQuality());
    }

    if (odcs.getSchema() != null) {
      for (ODCSSchemaElement schemaObject : odcs.getSchema()) {
        collectQualityRulesFromElement(schemaObject, allRules);
      }
    }

    return allRules;
  }

  private static void collectQualityRulesFromElement(
      ODCSSchemaElement element, List<ODCSQualityRule> allRules) {
    if (element.getQuality() != null && !element.getQuality().isEmpty()) {
      for (ODCSQualityRule rule : element.getQuality()) {
        if (rule.getColumn() == null || rule.getColumn().isEmpty()) {
          ODCSQualityRule copy = copyQualityRule(rule);
          copy.setColumn(element.getName());
          allRules.add(copy);
        } else {
          allRules.add(rule);
        }
      }
    }

    if (element.getProperties() != null) {
      for (ODCSSchemaElement property : element.getProperties()) {
        collectQualityRulesFromElement(property, allRules);
      }
    }
  }

  private static ODCSQualityRule copyQualityRule(ODCSQualityRule source) {
    return MAPPER.convertValue(source, ODCSQualityRule.class);
  }

  private static void distributeQualityRules(
      ODCSDataContract odcs, List<ODCSQualityRule> allRules) {
    List<ODCSQualityRule> topLevelRules = new ArrayList<>();

    for (ODCSQualityRule rule : allRules) {
      if (rule.getColumn() == null || rule.getColumn().isEmpty()) {
        topLevelRules.add(rule);
      } else if (odcs.getSchema() != null) {
        boolean placed = placeRuleInSchema(odcs.getSchema(), rule);
        if (!placed) {
          topLevelRules.add(rule);
        }
      } else {
        topLevelRules.add(rule);
      }
    }

    odcs.setQuality(topLevelRules.isEmpty() ? null : topLevelRules);
  }

  private static boolean placeRuleInSchema(
      List<ODCSSchemaElement> schemaElements, ODCSQualityRule rule) {
    for (ODCSSchemaElement element : schemaElements) {
      if (rule.getColumn().equals(element.getName())) {
        if (element.getQuality() == null) {
          element.setQuality(new ArrayList<>());
        }
        element.getQuality().add(rule);
        return true;
      }

      if (element.getProperties() != null) {
        if (placeRuleInSchema(element.getProperties(), rule)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Normalizes ODCS input to handle flexible representations. Converts: - team from object form
   * {members: [...]} to array form [...] - roles' firstLevelApprovers and secondLevelApprovers from
   * scalar strings to arrays
   */
  public static void normalizeODCSInput(JsonNode rootNode) {
    if (rootNode == null || !rootNode.isObject()) return;
    ObjectNode root = (ObjectNode) rootNode;

    normalizeTeamField(root);
    normalizeApproverFields(root);
  }

  private static void normalizeTeamField(ObjectNode root) {
    JsonNode teamNode = root.get("team");
    if (teamNode == null || !teamNode.isObject()) return;

    JsonNode membersNode = teamNode.get("members");
    if (membersNode != null && membersNode.isArray()) {
      root.set("team", membersNode);
    }
  }

  private static void normalizeApproverFields(ObjectNode root) {
    JsonNode rolesNode = root.get("roles");
    if (rolesNode == null || !rolesNode.isArray()) return;

    for (JsonNode roleNode : rolesNode) {
      if (!roleNode.isObject()) continue;
      ObjectNode role = (ObjectNode) roleNode;

      wrapScalarAsArray(role, "firstLevelApprovers");
      wrapScalarAsArray(role, "secondLevelApprovers");
    }
  }

  private static void wrapScalarAsArray(ObjectNode node, String fieldName) {
    JsonNode field = node.get(fieldName);
    if (field != null && field.isTextual()) {
      ArrayNode array = node.arrayNode();
      array.add(field.asText());
      node.set(fieldName, array);
    }
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

    merged.setExtension(
        imported.getExtension() != null ? imported.getExtension() : existing.getExtension());

    merged.setOdcsQualityRules(
        imported.getOdcsQualityRules() != null && !imported.getOdcsQualityRules().isEmpty()
            ? imported.getOdcsQualityRules()
            : existing.getOdcsQualityRules());

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
    replaced.setOdcsQualityRules(imported.getOdcsQualityRules());

    return replaced;
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

    return merged;
  }

  /**
   * Maps ODCS quality metric to OpenMetadata test definition name. This mapping is provided for
   * documentation and future use when creating test cases from ODCS quality rules.
   *
   * @param metric ODCS quality metric
   * @return OpenMetadata test definition name or null if no direct mapping exists
   */
  public static String mapODCSMetricToTestDefinition(ODCSQualityRule.OdcsQualityMetric metric) {
    if (metric == null) return null;
    return switch (metric) {
      case NULL_VALUES -> "columnValuesToBeNotNull";
      case ROW_COUNT -> "tableRowCountToEqual";
      case UNIQUE_VALUES -> "columnValuesToBeUnique";
      case MISSING_VALUES -> "columnValuesMissingCountToBeEqual";
      case COMPLETENESS -> "columnValuesToBeNotNull";
      default -> null;
    };
  }

  /**
   * Maps OpenMetadata test definition name to ODCS quality metric. This mapping is provided for
   * documentation and future use when exporting test cases to ODCS quality rules.
   *
   * @param testDefinitionName OpenMetadata test definition name
   * @return ODCS quality metric or null if no direct mapping exists
   */
  public static ODCSQualityRule.OdcsQualityMetric mapTestDefinitionToODCSMetric(
      String testDefinitionName) {
    if (testDefinitionName == null) return null;
    return switch (testDefinitionName.toLowerCase()) {
      case "columnvaluestobenotnull" -> ODCSQualityRule.OdcsQualityMetric.NULL_VALUES;
      case "tablerowcounttoequal", "tablerowcounttobebetween" -> ODCSQualityRule.OdcsQualityMetric
          .ROW_COUNT;
      case "columnvaluestobeunique" -> ODCSQualityRule.OdcsQualityMetric.UNIQUE_VALUES;
      case "columnvaluesmissingcounttobeequal" -> ODCSQualityRule.OdcsQualityMetric.MISSING_VALUES;
      default -> null;
    };
  }
}
