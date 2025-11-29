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

import java.util.ArrayList;
import java.util.Date;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;
import lombok.extern.slf4j.Slf4j;
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
import org.openmetadata.schema.entity.datacontract.odcs.ODCSRole;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSchemaElement;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSSlaProperty;
import org.openmetadata.schema.entity.datacontract.odcs.ODCSTeamMember;
import org.openmetadata.schema.type.Column;
import org.openmetadata.schema.type.ColumnConstraint;
import org.openmetadata.schema.type.ColumnDataType;
import org.openmetadata.schema.type.EntityReference;
import org.openmetadata.schema.type.EntityStatus;
import org.openmetadata.schema.type.TagLabel;
import org.openmetadata.service.Entity;

/**
 * Utility class for converting between OpenMetadata DataContract and ODCS (Open Data Contract
 * Standard) v3.0.2 format.
 */
@Slf4j
public class ODCSConverter {

  private ODCSConverter() {}

  /**
   * Export an OpenMetadata DataContract to ODCS v3.0.2 format.
   *
   * @param contract The OpenMetadata DataContract to export
   * @return ODCSDataContract in ODCS v3.0.2 format
   */
  public static ODCSDataContract toODCS(DataContract contract) {
    ODCSDataContract odcs = new ODCSDataContract();

    odcs.setApiVersion(ODCSDataContract.OdcsApiVersion.V_3_0_2);
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

    if (contract.getSchema() != null && !contract.getSchema().isEmpty()) {
      odcs.setSchema(convertSchemaToODCS(contract.getSchema()));
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

    return odcs;
  }

  /**
   * Import an ODCS v3.0.2 data contract to OpenMetadata DataContract format.
   *
   * @param odcs The ODCS data contract to import
   * @param entityRef Reference to the target entity (table, topic, etc.)
   * @return OpenMetadata DataContract
   */
  public static DataContract fromODCS(ODCSDataContract odcs, EntityReference entityRef) {
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

    if (odcs.getSchema() != null && !odcs.getSchema().isEmpty()) {
      contract.setSchema(convertODCSSchemaToColumns(odcs.getSchema()));
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

    return contract;
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
          element.setClassification(ODCSSchemaElement.Classification.SENSITIVE);
          break;
        } else if (tagFqn != null && tagFqn.toLowerCase().contains("confidential")) {
          element.setClassification(ODCSSchemaElement.Classification.CONFIDENTIAL);
          break;
        } else if (tagFqn != null && tagFqn.toLowerCase().contains("restricted")) {
          element.setClassification(ODCSSchemaElement.Classification.RESTRICTED);
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
      case INT, BIGINT, SMALLINT, TINYINT, BYTEINT -> ODCSSchemaElement.LogicalType.INTEGER;
      case FLOAT, DOUBLE, DECIMAL, NUMERIC, NUMBER -> ODCSSchemaElement.LogicalType.NUMBER;
      case BOOLEAN -> ODCSSchemaElement.LogicalType.BOOLEAN;
      case DATE, DATETIME, TIMESTAMP, TIMESTAMPZ, TIME -> ODCSSchemaElement.LogicalType.DATE;
      case ARRAY -> ODCSSchemaElement.LogicalType.ARRAY;
      case MAP, STRUCT, JSON -> ODCSSchemaElement.LogicalType.OBJECT;
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
      case NUMBER -> ColumnDataType.DECIMAL;
      case BOOLEAN -> ColumnDataType.BOOLEAN;
      case DATE -> ColumnDataType.DATE;
      case ARRAY -> ColumnDataType.ARRAY;
      case OBJECT -> ColumnDataType.STRUCT;
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
    return team.stream()
        .filter(member -> "owner".equalsIgnoreCase(member.getRole()))
        .map(
            member -> {
              EntityReference ref = new EntityReference();
              ref.setType(Entity.USER);
              ref.setName(member.getUsername());
              ref.setDisplayName(member.getName());
              return ref;
            })
        .collect(Collectors.toList());
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
      prop.setProperty("refreshFrequency");
      prop.setValue(String.valueOf(sla.getRefreshFrequency().getInterval()));
      if (sla.getRefreshFrequency().getUnit() != null) {
        prop.setUnit(sla.getRefreshFrequency().getUnit().value());
      }
      properties.add(prop);
    }

    if (sla.getMaxLatency() != null) {
      ODCSSlaProperty prop = new ODCSSlaProperty();
      prop.setProperty("maxLatency");
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
        case "refreshfrequency" -> {
          RefreshFrequency rf = new RefreshFrequency();
          rf.setInterval(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            rf.setUnit(RefreshFrequency.Unit.fromValue(prop.getUnit()));
          }
          sla.setRefreshFrequency(rf);
        }
        case "maxlatency" -> {
          MaxLatency ml = new MaxLatency();
          ml.setValue(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            ml.setUnit(MaxLatency.Unit.fromValue(prop.getUnit()));
          }
          sla.setMaxLatency(ml);
        }
        case "retention" -> {
          Retention ret = new Retention();
          ret.setPeriod(parseInteger(prop.getValue()));
          if (prop.getUnit() != null) {
            ret.setUnit(Retention.Unit.fromValue(prop.getUnit()));
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

  private static String generateContractName(EntityReference entity) {
    if (entity == null || entity.getName() == null) {
      return "contract_" + UUID.randomUUID().toString().substring(0, 8);
    }
    return entity.getName() + "_contract";
  }
}
